// Rich presence sources (MSC4544), run in the main process because they listen
// on the local machine. Three feed the renderer, which owns the policy (which
// apps may be shown, what is published to the profile):
//
//   MSC4544 transport   apps talk to us directly (add_presence /
//                       remove_presence) over a WebSocket on
//                       ws://127.0.0.1:<port>/presence and, off Windows, over
//                       a Unix socket at /tmp/.zam_<id>/presence.sock.
//   Discord RPC         apps that only know Discord Rich Presence report to
//                       the local servers in discordRpc.cjs.
//   Game scanner        gameScanner.cjs finds known games by their executable.
//   Media               mediaSession.cjs reports what media players are playing
//                       (SMTC on Windows, MPRIS on Linux, MediaRemote on
//                       macOS) as "Listening to".
//
// Everything is off until the renderer asks (Settings > General). Nothing is
// interpreted here beyond framing: the renderer validates every payload.
//
// Events sent to the renderer:
//   { source, app: { id, name }, presenceId, presence }
// `presence` is the raw payload to add or replace, or null to remove it.
// For "msc4544" it is a PresenceDataObject; for "arrpc" (Discord RPC and the
// scanner) a Discord activity.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { createDiscordRpc } = require("./discordRpc.cjs");
const {
    createGameScanner,
    hostAccessAllowed,
    listPrograms,
} = require("./gameScanner.cjs");
const { createKnownGames } = require("./knownGames.cjs");
const { createMediaSession } = require("./mediaSession.cjs");
const { restartDiscord } = require("./discordRestart.cjs");
const { createFakeDiscord } = require("./fakeDiscord.cjs");

const PORT_RANGE = [44190, 45190];
const WS_PATH = "/presence";
const MAX_PAYLOAD = 16 * 1024;
// A misbehaving app should not be able to flood the renderer.
const MAX_MESSAGES_PER_SECOND = 20;

/**
 * Where the MSC4544 Unix socket lives. The MSC says /tmp/.zam_<id>/, but a
 * Flatpak's /tmp is private; its runtime dir app/<id> is shared with the host,
 * so the socket goes there (no permission needed).
 */
function socketLocation({ inFlatpak, env, id }) {
    if (inFlatpak && env.XDG_RUNTIME_DIR) {
        const dir = path.join(
            env.XDG_RUNTIME_DIR,
            "app",
            env.FLATPAK_ID || "moe.crafty.matrix",
        );
        return { dir, sock: path.join(dir, "presence.sock"), owned: false };
    }
    const dir = path.join("/tmp", `.zam_${id}`);
    return { dir, sock: path.join(dir, "presence.sock"), owned: true };
}

/**
 * The cover of each media player's track, for the renderer to ask for by a
 * reference. put() keeps a player's cover and returns its reference
 * "media:<player>:<hash>" (the hash changes with the picture, so a new album is
 * a new reference), or null when there is none; get() gives the cover behind a
 * reference while it is still the player's current one.
 */
function createCoverStore() {
    const covers = new Map(); // player id -> { hash, type, data }
    return {
        put(playerId, cover) {
            if (!cover) {
                covers.delete(playerId);
                return null;
            }
            const hash = crypto
                .createHash("sha1")
                .update(cover.data)
                .digest("hex")
                .slice(0, 12);
            covers.set(playerId, { hash, type: cover.type, data: cover.data });
            return `media:${playerId}:${hash}`;
        },
        get(ref) {
            const m = /^media:(.+):([0-9a-f]{12})$/.exec(String(ref));
            const held = m && covers.get(m[1]);
            if (!held || held.hash !== m[2]) return null;
            return { type: held.type, data: held.data };
        },
        clear(playerId) {
            covers.delete(playerId);
        },
        clearAll() {
            covers.clear();
        },
    };
}

function createRichPresence({
    send,
    userDataDir,
    inFlatpak = false,
    // Whether a Flatpak may run commands on the host (needs the user to have
    // granted org.freedesktop.Flatpak); asked once, as it cannot change
    // without a restart.
    hostAccess = hostAccessAllowed,
    // Downloads Discord's game list (net.fetch). Without it the list is only
    // read from disk.
    fetch,
    // Where the macOS MediaRemote adapter lives (see mediaSession.cjs).
    mediaDir,
    log = () => {},
}) {
    const knownGames = createKnownGames({
        file: path.join(userDataDir, "known-games.bin"),
        fetch,
        log,
    });
    const loadGames = () => knownGames.load();
    let generation = 0;
    let hostAccessCheck = null;
    // Only a success is kept: a failed check is asked again on the next
    // configure, so granting access later does not need a restart.
    const checkHostAccess = () =>
        (hostAccessCheck ??= hostAccess().then(
            (ok) => {
                if (!ok) hostAccessCheck = null;
                return ok;
            },
            () => {
                hostAccessCheck = null;
                return false;
            },
        ));
    let hostAllowed = !inFlatpak;
    let tcp = null;
    let unix = null; // { server, wss, dir, key }
    let discord = null;
    // The automatic Discord restart happens once per run of Zam, so a Discord
    // that keeps coming back first can't make us restart it in a loop.
    let autoRestartTried = false;
    let scanner = null;
    let media = null;
    // Media players currently shown (player id -> name), so stop() clears them.
    const mediaPlayers = new Map();
    const covers = createCoverStore();
    // A process named Discord, for apps that look for one; see fakeDiscord.cjs.
    const fake = createFakeDiscord({ userDataDir, inFlatpak, log });
    // Games the user added by hand; the scanner reads this on every pass.
    let customGames = [];
    const status = {
        msc4544: { listening: false, port: null, socket: null, error: null },
        arrpc: { running: false, ipcPath: null, wsPort: null, error: null },
        scan: { running: false, error: null, needsPermission: false },
    };

    // ── MSC4544 transports ─────────────────────────────────────────────────

    /** Speaks MSC4544 on one connection from a local app. */
    function onMscConnection(socket) {
        // Presences this connection added, so they go when it does.
        const owned = new Map(); // presenceId -> app
        let windowStart = Date.now();
        let count = 0;

        socket.on("error", () => {});
        socket.on("message", (raw) => {
            const now = Date.now();
            if (now - windowStart >= 1000) {
                windowStart = now;
                count = 0;
            }
            if (++count > MAX_MESSAGES_PER_SECOND) return;

            let msg;
            try {
                msg = JSON.parse(raw.toString("utf8"));
            } catch {
                return;
            }
            const app = msg?.app_id;
            if (typeof app?.id !== "string" || typeof app?.name !== "string")
                return;
            const id = msg.data?.id;
            if (typeof id !== "string") return;
            const who = { id: app.id, name: app.name };

            if (msg.type === "add_presence") {
                owned.set(id, who);
                send({
                    source: "msc4544",
                    app: who,
                    presenceId: id,
                    presence: msg.data,
                });
            } else if (msg.type === "remove_presence") {
                owned.delete(id);
                send({
                    source: "msc4544",
                    app: who,
                    presenceId: id,
                    presence: null,
                });
            }
        });
        socket.on("close", () => {
            for (const [presenceId, app] of owned) {
                send({ source: "msc4544", app, presenceId, presence: null });
            }
            owned.clear();
        });
    }

    function startTcp(gen) {
        const { WebSocketServer } = require("ws");
        const http = require("http");

        return new Promise((resolve) => {
            const tryPort = (port) => {
                if (gen !== generation) return resolve(null);
                if (port > PORT_RANGE[1]) {
                    status.msc4544.error = "no free port";
                    return resolve(null);
                }
                const server = http.createServer((_req, res) => {
                    res.statusCode = 426;
                    res.end();
                });
                const wss = new WebSocketServer({
                    server,
                    path: WS_PATH,
                    maxPayload: MAX_PAYLOAD,
                    // A web page can open sockets to localhost too, and a
                    // native app never sends an Origin header. Refuse any
                    // request that has one.
                    verifyClient: (info) => !info.origin,
                });
                wss.on("error", () => {});
                server.once("error", (e) => {
                    if (e.code === "EADDRINUSE") return tryPort(port + 1);
                    status.msc4544.error = String(e.message || e);
                    resolve(null);
                });
                server.listen(port, "127.0.0.1", () => {
                    if (gen !== generation) {
                        wss.close();
                        server.close();
                        return resolve(null);
                    }
                    wss.on("connection", onMscConnection);
                    status.msc4544.listening = true;
                    status.msc4544.port = port;
                    status.msc4544.error = null;
                    log("rich presence listening on", port);
                    resolve({ server, wss });
                });
            };
            tryPort(PORT_RANGE[0]);
        });
    }

    function stopTcp() {
        const t = tcp;
        tcp = null;
        status.msc4544.listening = false;
        status.msc4544.port = null;
        if (!t) return;
        for (const client of t.wss.clients) client.terminate();
        t.wss.close();
        t.server.close();
    }

    /**
     * The id in the socket's path. It must not lead back to the Matrix user, so
     * it is a keyed hash with a secret that stays on this computer.
     */
    function opaqueId(userId) {
        const file = path.join(userDataDir, "rich-presence-salt");
        let salt;
        try {
            salt = fs.readFileSync(file);
        } catch {
            salt = crypto.randomBytes(32);
            fs.mkdirSync(userDataDir, { recursive: true });
            fs.writeFileSync(file, salt, { mode: 0o600 });
        }
        return crypto
            .createHmac("sha256", salt)
            .update(userId)
            .digest("hex")
            .slice(0, 16);
    }

    async function startUnix(gen, userId) {
        if (process.platform === "win32" || !userId) return null;
        const { WebSocketServer } = require("ws");
        const http = require("http");

        const { dir, sock, owned } = socketLocation({
            inFlatpak,
            env: process.env,
            id: opaqueId(userId),
        });
        if (!owned) {
            // The Flatpak runtime dir is made and guarded by Flatpak itself.
            fs.mkdirSync(dir, { recursive: true });
        } else {
            try {
                // Only we may enter the folder: another user (or a program
                // run as one) must not be able to feed our profile. If
                // something else made the folder first, leave it alone.
                fs.mkdirSync(dir, { mode: 0o700 });
            } catch (e) {
                if (e.code !== "EEXIST") throw e;
                const st = fs.lstatSync(dir);
                if (
                    !st.isDirectory() ||
                    st.isSymbolicLink() ||
                    (process.getuid && st.uid !== process.getuid())
                )
                    throw new Error(`${dir} is not ours`);
                fs.chmodSync(dir, 0o700);
            }
        }
        try {
            fs.unlinkSync(sock); // left over from a crash
        } catch {}

        const server = http.createServer((_req, res) => {
            res.statusCode = 426;
            res.end();
        });
        const wss = new WebSocketServer({
            server,
            maxPayload: MAX_PAYLOAD,
            verifyClient: (info) => !info.origin,
        });
        wss.on("error", () => {});
        await new Promise((resolve, reject) => {
            server.once("error", reject);
            server.listen(sock, resolve);
        });
        try {
            fs.chmodSync(sock, 0o600);
        } catch {}
        if (gen !== generation) {
            wss.close();
            server.close();
            return null;
        }
        wss.on("connection", onMscConnection);
        status.msc4544.socket = sock;
        log("rich presence socket at", sock);
        return { server, wss, dir, owned, key: userId };
    }

    function stopUnix() {
        const u = unix;
        unix = null;
        status.msc4544.socket = null;
        if (!u) return;
        for (const client of u.wss.clients) client.terminate();
        u.wss.close();
        u.server.close();
        try {
            fs.rmSync(path.join(u.dir, "presence.sock"), { force: true });
            if (u.owned) fs.rmdirSync(u.dir);
        } catch {}
    }

    // ── Discord RPC and the game scanner ───────────────────────────────────

    // Games reported over RPC, so the scanner doesn't announce them twice.
    const rpcClients = new Map(); // client id -> Set of socket ids
    // Where the scanner last saw each game's executable (for its icon).
    const exePaths = new Map();

    // Application names from Discord, by client id (null: none found). Asked
    // once per app; a pending lookup is shared so updates keep their order.
    const appNames = new Map();

    /** The name the app registered with Discord, which is what Discord shows. */
    function applicationName(clientId) {
        if (!fetch || !/^\d{1,25}$/.test(clientId))
            return Promise.resolve(null);
        let found = appNames.get(clientId);
        if (!found) {
            found = (async () => {
                try {
                    const res = await fetch(
                        `https://discord.com/api/v10/applications/${clientId}/rpc`,
                        { signal: AbortSignal.timeout(5000) },
                    );
                    if (!res.ok) return null;
                    const name = (await res.json())?.name;
                    return typeof name === "string" && name.trim()
                        ? name.trim()
                        : null;
                } catch {
                    return null;
                }
            })();
            appNames.set(clientId, found);
            // A failed lookup (offline, rate limited) is worth another try.
            void found.then((name) => {
                if (name === null && appNames.get(clientId) === found)
                    appNames.delete(clientId);
            });
        }
        return found;
    }

    /** Forward a Discord-style activity under a stable app identity. */
    async function forwardActivity(
        { socketId, clientId, activity, exe },
        viaScan,
    ) {
        const { byId } = await loadGames();
        const known = byId.get(clientId);
        const given = typeof activity?.name === "string" && activity.name;
        const app = {
            id: clientId,
            name:
                given ||
                known?.name ||
                (await applicationName(clientId)) ||
                "Discord app",
        };

        if (!viaScan) {
            let ids = rpcClients.get(clientId);
            if (activity) {
                if (!ids) rpcClients.set(clientId, (ids = new Set()));
                if (ids.size === 0) {
                    // The app reports for itself now: drop the scanner's copy.
                    send({
                        source: "arrpc",
                        app,
                        presenceId: `scan-${clientId}`,
                        presence: null,
                    });
                }
                ids.add(socketId);
            } else if (ids) {
                ids.delete(socketId);
                if (ids.size === 0) rpcClients.delete(clientId);
            }
        } else if (rpcClients.get(clientId)?.size) {
            return;
        }

        let presence = activity;
        if (exe) exePaths.set(clientId, exe);
        if (
            presence &&
            !presence.assets?.large_image &&
            (known?.icon || exePaths.has(clientId))
        ) {
            // Discord's list has the icon for most games; otherwise use the
            // icon of the game's executable, when we know where it is.
            presence = {
                ...presence,
                assets: {
                    ...presence.assets,
                    large_image: known?.icon
                        ? `icon:${known.icon}`
                        : "exe-icon",
                },
            };
        }
        send({
            source: "arrpc",
            app,
            presenceId: socketId,
            presence: presence ?? null,
        });
    }

    async function startDiscord(gen) {
        const rpc = createDiscordRpc({
            onActivity: (a) => void forwardActivity(a, false),
            inFlatpak,
            log,
        });
        await rpc.start();
        if (gen !== generation) {
            rpc.stop();
            return null;
        }
        return rpc;
    }

    function stopDiscord() {
        const d = discord;
        discord = null;
        d?.stop();
        rpcClients.clear();
    }

    function startScanner() {
        const s = createGameScanner({
            onActivity: (a) => void forwardActivity(a, true),
            loadGames,
            viaHost: inFlatpak,
            getCustomGames: () => customGames,
            log,
        });
        s.start();
        return s;
    }

    function stopScanner() {
        const s = scanner;
        scanner = null;
        s?.stop();
    }

    // ── Media players ──────────────────────────────────────────────────────

    /**
     * A player's track as a "Listening to" activity, or its removal. Its picture
     * is the track's cover, or else the player's own icon (see mediaCover and
     * presenceImages.cjs).
     */
    function forwardMedia({ playerId, playerName, track }) {
        const presenceId = `media-${playerId}`;
        if (track) mediaPlayers.set(playerId, playerName);
        else mediaPlayers.delete(playerId);
        const coverRef = covers.put(playerId, track?.cover);
        send({
            source: "arrpc",
            app: { id: presenceId, name: playerName },
            presenceId,
            presence: track
                ? {
                      application_id: presenceId,
                      name: playerName,
                      type: 2,
                      details: track.title,
                      state: track.artist || undefined,
                      assets: {
                          large_image: coverRef ?? `media-icon:${playerId}`,
                          large_text: track.album || undefined,
                      },
                      timestamps: track.durationMs
                          ? {
                                start: track.startedAt,
                                end: track.startedAt + track.durationMs,
                            }
                          : { start: track.startedAt },
                  }
                : null,
        });
    }

    function stopMedia() {
        const m = media;
        media = null;
        m?.stop();
        covers.clearAll();
        // Whatever the listener did not clear itself.
        for (const [playerId, playerName] of mediaPlayers) {
            mediaPlayers.delete(playerId);
            send({
                source: "arrpc",
                app: { id: `media-${playerId}`, name: playerName },
                presenceId: `media-${playerId}`,
                presence: null,
            });
        }
    }

    // ── Control ────────────────────────────────────────────────────────────

    /**
     * Start or stop each source to match `want` ({ local, arrpc, scan, media,
     * autoRestartDiscord, userId });
     * resolves to the status.
     */
    async function configure(want) {
        const gen = ++generation;
        customGames = (Array.isArray(want?.games) ? want.games : [])
            .filter(
                (g) =>
                    typeof g?.id === "string" &&
                    typeof g.name === "string" &&
                    typeof g.exe === "string" &&
                    g.exe,
            )
            .slice(0, 100)
            .map((g) => ({ id: g.id, name: g.name, exe: g.exe }));
        const local = !!want?.local;
        const userId = typeof want?.userId === "string" ? want.userId : "";

        // Discord's game list is only fetched once something needs it.
        if (local && (want.arrpc || want.scan)) void knownGames.load();

        if (!local) {
            stopTcp();
            stopUnix();
        }
        if (!local || !want.arrpc) stopDiscord();
        if (!local || !want.scan) stopScanner();
        if (!local || !want.media) stopMedia();
        if (unix && unix.key !== userId) stopUnix();

        if (local && !tcp) {
            try {
                tcp = await startTcp(gen);
            } catch (e) {
                status.msc4544.error = String(e?.message || e);
            }
        }
        if (local && !unix && userId) {
            try {
                unix = await startUnix(gen, userId);
            } catch (e) {
                status.msc4544.error = String(e?.message || e);
            }
        }
        if (local && want.arrpc && !discord) {
            try {
                discord = await startDiscord(gen);
                status.arrpc.error = null;
            } catch (e) {
                status.arrpc.error = String(e?.message || e);
            }
        }
        if (inFlatpak && local && want.arrpc) {
            // Controlling Discord or starting a process outside the sandbox.
            hostAllowed = await checkHostAccess();
            fake.setHostAccess(hostAllowed);
        }
        if (local && want.arrpc && want.fake) await fake.start();
        else await fake.stop();
        if (local && want.scan && !scanner) {
            // A Flatpak sandbox cannot see the host's processes; it can ask
            // the host to list them, if the user allowed that.
            const allowed = !inFlatpak || (await checkHostAccess());
            status.scan.needsPermission = !allowed;
            if (allowed && gen === generation) scanner = startScanner();
        } else if (!want.scan) {
            status.scan.needsPermission = false;
        }
        if (local && want.media && !media) {
            media = createMediaSession({
                onTrack: forwardMedia,
                inFlatpak,
                log,
                fetch,
                mediaDir,
            });
            media.start();
        }
        if (
            local &&
            want.arrpc &&
            want.autoRestartDiscord &&
            !autoRestartTried &&
            discord &&
            hostAllowed &&
            gen === generation &&
            (discord.status()?.ipcSlot ?? 0) > 0
        ) {
            // Something else (Discord) holds the first slot.
            autoRestartTried = true;
            const res = await restartDiscordApp();
            if (!res.ok) log("automatic Discord restart failed", res.error);
        }
        return getStatus();
    }

    function getStatus() {
        const d = discord?.status();
        return JSON.parse(
            JSON.stringify({
                msc4544: status.msc4544,
                arrpc: {
                    running: !!discord,
                    ipcPath: d?.ipcPath ?? null,
                    wsPort: d?.wsPort ?? null,
                    // 0 is the slot apps try first; a higher one means
                    // something else (usually Discord) answers before us.
                    slot: d?.ipcSlot ?? null,
                    // A Flatpak reaches the host's Discord only if allowed.
                    canRestartDiscord: hostAllowed,
                    needsPermission: inFlatpak && !hostAllowed,
                    error: status.arrpc.error ?? d?.error ?? null,
                },
                scan: {
                    ...(scanner
                        ? scanner.status()
                        : { running: false, error: null }),
                    needsPermission: status.scan.needsPermission,
                },
                media: media ? media.status() : { running: false, error: null },
                games: knownGames.status(),
                fake: fake.status(),
            }),
        );
    }

    /**
     * Close Discord, take the first discord-ipc slot and start Discord again
     * (so apps report to us and we pass them on). The caller has asked the
     * user first.
     */
    async function restartDiscordApp() {
        if (!discord) return { ok: false, error: "Discord support is off" };
        // The stand-in would be taken for Discord and closed with it.
        await fake.stop();
        return restartDiscord({
            log,
            inFlatpak,
            rebind: async () => {
                stopDiscord();
                discord = await startDiscord(generation);
            },
        });
    }

    function stop() {
        generation++;
        stopTcp();
        stopUnix();
        stopDiscord();
        stopScanner();
        stopMedia();
        void fake.stop();
    }

    return {
        configure,
        getStatus,
        restartDiscord: restartDiscordApp,
        stop,
        programs: () => listPrograms(inFlatpak),
        /** The cover behind a "media:" reference, or null (see createCoverStore). */
        mediaCover: (ref) => covers.get(ref),
        /** Where a game's executable was last seen, or null. */
        gameExe: (id) =>
            exePaths.get(id) ??
            customGames.find((g) => g.id === id)?.exe ??
            null,
    };
}

module.exports = { createCoverStore, createRichPresence, socketLocation };
