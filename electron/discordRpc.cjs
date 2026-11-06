// Discord's local RPC servers, so apps that report Discord Rich Presence can
// report to Zam. Apps find Discord by connecting to a named pipe or Unix
// socket called discord-ipc-0 to -9, or to a WebSocket on port 6463 to 6472;
// we listen on the first of each that nothing else (such as Discord itself)
// has. Only SET_ACTIVITY is acted on.
//
// Apps use the first slot that answers, so when Zam holds a lower slot than a
// running Discord the apps report to Zam and never to Discord. Each app's
// handshake and frames are therefore also passed on to the real Discord, so
// it keeps working. (Started the other way round, Discord holds the lowest
// slot and the apps never reach Zam; nothing here can change that.)
//
// The wire formats follow arRPC (https://github.com/OpenAsar/arrpc, MIT).

const net = require("net");
const http = require("http");
const fs = require("fs");
const path = require("path");

const WS_PORTS = [6463, 6472];
const MAX_FRAME = 64 * 1024;
const DISCORD_ORIGINS = [
    "https://discord.com",
    "https://ptb.discord.com",
    "https://canary.discord.com",
];

const Op = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };
const ErrorCodes = { INVALID_CLIENTID: 4000, INVALID_VERSION: 4004 };

/** Flatpak Discord's folder in the runtime dir; Discord libraries look there. */
const FLATPAK_DISCORD_DIR = path.join("app", "com.discordapp.Discord");

/**
 * Where discord-ipc-N goes. In a Flatpak the sandbox's own runtime dir is
 * invisible to other apps, but app/com.discordapp.Discord is shared with the
 * host when the manifest grants it (flatpak/moe.crafty.matrix.yml).
 */
function ipcBase({
    platform = process.platform,
    env = process.env,
    inFlatpak = false,
} = {}) {
    if (platform === "win32") return "\\\\?\\pipe\\discord-ipc";
    const dir =
        env.XDG_RUNTIME_DIR || env.TMPDIR || env.TMP || env.TEMP || "/tmp";
    return inFlatpak && env.XDG_RUNTIME_DIR
        ? path.join(dir, FLATPAK_DISCORD_DIR, "discord-ipc")
        : path.join(dir, "discord-ipc");
}

/**
 * Where a real Discord may keep its discord-ipc-N: where apps look first, and
 * on Linux the folders a Flatpak or Snap Discord shares with the host.
 */
function discordIpcBases({
    platform = process.platform,
    env = process.env,
    inFlatpak = false,
} = {}) {
    const bases = [ipcBase({ platform, env, inFlatpak })];
    if (platform === "linux" && !inFlatpak && env.XDG_RUNTIME_DIR) {
        const dir = env.XDG_RUNTIME_DIR;
        bases.push(
            path.join(dir, FLATPAK_DISCORD_DIR, "discord-ipc"),
            path.join(dir, "snap.discord", "discord-ipc"),
        );
    }
    return bases;
}

function encode(op, data) {
    const body = Buffer.from(JSON.stringify(data));
    const out = Buffer.alloc(8 + body.length);
    out.writeInt32LE(op, 0);
    out.writeInt32LE(body.length, 4);
    body.copy(out, 8);
    return out;
}

/** Whether something already answers at `target`. */
function inUse(target) {
    return new Promise((resolve) => {
        const probe = net.createConnection(target);
        const done = (used) => {
            probe.destroy();
            resolve(used);
        };
        probe.once("connect", () => done(true));
        probe.once("error", () => done(false));
        probe.setTimeout(1000, () => done(true));
    });
}

// Discord replies to a handshake with who you are. Nobody here has an account.
const READY = {
    cmd: "DISPATCH",
    evt: "READY",
    nonce: null,
    data: {
        v: 1,
        config: {
            cdn_host: "cdn.discordapp.com",
            api_endpoint: "//discord.com/api",
            environment: "production",
        },
        user: {
            id: "1",
            username: "zam",
            discriminator: "0",
            global_name: "Zam",
            avatar: null,
            bot: false,
            flags: 0,
            premium_type: 0,
        },
    },
};

/** Seconds to milliseconds, for apps that send either. */
function toMillis(ts) {
    if (!ts || typeof ts !== "object") return undefined;
    const out = {};
    for (const key of ["start", "end"]) {
        const n = ts[key];
        if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) continue;
        out[key] =
            String(Date.now()).length - String(Math.floor(n)).length > 2
                ? Math.floor(n * 1000)
                : Math.floor(n);
    }
    return out;
}

/**
 * `onActivity({ socketId, clientId, activity })` is called with the activity
 * an app set, or with `activity: null` when it cleared it or went away.
 */
function createDiscordRpc({ onActivity, inFlatpak = false, log = () => {} }) {
    let nextSocketId = 0;
    const sessions = new Set();
    let ipcServer = null;
    let ipcPath = null;
    let wsServer = null;
    let wsHttp = null;
    let wsPort = null;
    let stopped = true;
    const status = { ipcPath: null, ipcSlot: null, wsPort: null, error: null };

    /**
     * One connected app. `send(msg)` writes a message to it, `close(code)` ends
     * the connection; the transports supply both.
     */
    function openSession(send, close, clientId) {
        const session = {
            id: String(nextSocketId++),
            clientId,
            active: false,
            close,
        };
        sessions.add(session);
        send(READY);

        session.handle = (msg) => {
            if (!msg || typeof msg !== "object") return;
            const { cmd, args, nonce } = msg;
            if (cmd === "SET_ACTIVITY") {
                const activity = args?.activity;
                if (!activity || typeof activity !== "object") {
                    session.active = false;
                    send({ cmd, data: null, evt: null, nonce });
                    onActivity({
                        socketId: session.id,
                        clientId,
                        activity: null,
                    });
                    return;
                }
                const timestamps = toMillis(activity.timestamps);
                const full = {
                    ...activity,
                    ...(timestamps ? { timestamps } : {}),
                    application_id: clientId,
                    type: typeof activity.type === "number" ? activity.type : 0,
                };
                session.active = true;
                send({
                    cmd,
                    data: { ...full, name: "" },
                    evt: null,
                    nonce,
                });
                onActivity({ socketId: session.id, clientId, activity: full });
            } else if (cmd === "SUBSCRIBE" || cmd === "UNSUBSCRIBE") {
                send({ cmd, data: { evt: msg.evt }, evt: null, nonce });
            } else {
                // Nothing here can invite, deep-link or browse. Say so, so the
                // app's promise settles instead of waiting forever.
                send({
                    cmd,
                    data: { code: 4000, message: "Not supported" },
                    evt: "ERROR",
                    nonce,
                });
            }
        };
        session.end = () => {
            sessions.delete(session);
            if (session.active) {
                session.active = false;
                onActivity({ socketId: session.id, clientId, activity: null });
            }
        };
        return session;
    }

    // ── Named pipe / Unix socket ───────────────────────────────────────────

    /**
     * A connection to the real Discord on another slot, handshaken as
     * `clientId` and ready for frames, or null if there is none.
     */
    function connectDiscord(clientId) {
        const targets = discordIpcBases({ inFlatpak }).flatMap((base) =>
            Array.from({ length: 10 }, (_, n) => `${base}-${n}`),
        );
        return new Promise((resolve) => {
            const next = () => {
                const target = targets.shift();
                if (!target) {
                    log("no real discord to pass activity to");
                    return resolve(null);
                }
                if (target === ipcPath) return next();
                const sock = net.createConnection(target);
                sock.setTimeout(2000, () =>
                    sock.destroy(new Error("timed out")),
                );
                sock.once("error", next);
                sock.once("connect", () => {
                    sock.setTimeout(0);
                    sock.removeListener("error", next);
                    sock.on("error", () => {});
                    // Discord drops a frame that arrives before it has answered
                    // the handshake (with READY), so hold the app's frames
                    // until it has.
                    let ready = false;
                    const settle = () => {
                        if (ready) return;
                        ready = true;
                        clearTimeout(timer);
                        resolve(sock);
                    };
                    const timer = setTimeout(settle, 3000);
                    sock.on("data", () => {
                        settle();
                    });
                    sock.on("close", settle);
                    log("passing", clientId, "on to", target);
                    sock.write(
                        encode(Op.HANDSHAKE, { v: 1, client_id: clientId }),
                    );
                });
            };
            next();
        });
    }

    function onIpcConnection(socket) {
        let buf = Buffer.alloc(0);
        let session = null;
        let discord = null; // promise of the real Discord's socket
        const send = (msg) => {
            if (!socket.destroyed) socket.write(encode(Op.FRAME, msg));
        };
        const close = (code = 1000, message = "") => {
            socket.end(encode(Op.CLOSE, { code, message }));
            socket.destroy();
        };
        socket.on("error", () => {});
        socket.on("close", () => {
            session?.end();
            void discord?.then((d) => d?.destroy());
        });
        socket.on("data", (chunk) => {
            buf = Buffer.concat([buf, chunk]);
            while (buf.length >= 8) {
                const op = buf.readInt32LE(0);
                const len = buf.readInt32LE(4);
                if (len < 0 || len > MAX_FRAME || op < 0 || op > Op.PONG)
                    return close(1003, "bad frame");
                if (buf.length < 8 + len) return;
                let data;
                try {
                    data = JSON.parse(
                        buf.subarray(8, 8 + len).toString("utf8"),
                    );
                } catch {
                    return close(1003, "bad json");
                }
                buf = buf.subarray(8 + len);

                if (op === Op.PING) {
                    socket.write(encode(Op.PONG, data));
                } else if (op === Op.CLOSE) {
                    socket.destroy();
                    return;
                } else if (op === Op.HANDSHAKE) {
                    if (session) return close(1003, "already handshook");
                    if (parseInt(data?.v ?? 1) !== 1)
                        return close(ErrorCodes.INVALID_VERSION);
                    const clientId = String(data?.client_id ?? "");
                    if (!clientId) return close(ErrorCodes.INVALID_CLIENTID);
                    session = openSession(send, close, clientId);
                    discord = connectDiscord(clientId);
                } else if (op === Op.FRAME) {
                    if (!session) return close(1003, "handshake first");
                    session.handle(data);
                    void discord?.then(
                        (d) =>
                            d &&
                            !d.destroyed &&
                            d.write(encode(Op.FRAME, data)),
                    );
                }
            }
        });
    }

    async function startIpc() {
        const base = ipcBase({ inFlatpak });
        if (inFlatpak) {
            try {
                fs.mkdirSync(path.dirname(base), { recursive: true });
            } catch {}
        }
        for (let n = 0; n < 10; n++) {
            const target = `${base}-${n}`;
            if (await inUse(target)) continue;
            // A leftover socket file from a crash; nothing answers on it.
            if (process.platform !== "win32") {
                try {
                    fs.unlinkSync(target);
                } catch {}
            }
            const server = net.createServer(onIpcConnection);
            const ok = await new Promise((resolve) => {
                server.once("error", () => resolve(false));
                server.listen(target, () => resolve(true));
            });
            if (!ok) continue;
            if (stopped) {
                server.close();
                return;
            }
            server.on("error", () => {});
            ipcServer = server;
            ipcPath = target;
            status.ipcPath = target;
            status.ipcSlot = n;
            log("discord ipc listening at", target);
            return;
        }
        status.error = "no free discord-ipc slot";
    }

    // ── WebSocket ──────────────────────────────────────────────────────────

    function onWsConnection(socket, req) {
        let params;
        try {
            params = new URL(req.url, "http://localhost").searchParams;
        } catch {
            return socket.close();
        }
        const origin = req.headers.origin ?? "";
        if (origin !== "" && !DISCORD_ORIGINS.includes(origin))
            return socket.close();
        if ((params.get("encoding") ?? "json") !== "json")
            return socket.close();
        if (parseInt(params.get("v") ?? "1") !== 1) return socket.close();
        const clientId = params.get("client_id") ?? "";
        if (!clientId) return socket.close();

        socket.on("error", () => {});
        const session = openSession(
            (msg) =>
                socket.readyState === 1 && socket.send(JSON.stringify(msg)),
            () => socket.close(),
            clientId,
        );
        // Browser apps arrive here; pass them on to the real Discord too.
        const discord = connectDiscord(clientId);
        socket.on("close", () => {
            session.end();
            void discord.then((d) => d?.destroy());
        });
        socket.on("message", (raw) => {
            try {
                const data = JSON.parse(raw.toString("utf8"));
                session.handle(data);
                void discord.then(
                    (d) => d && !d.destroyed && d.write(encode(Op.FRAME, data)),
                );
            } catch {}
        });
    }

    async function startWs() {
        const { WebSocketServer } = require("ws");
        for (let port = WS_PORTS[0]; port <= WS_PORTS[1]; port++) {
            const server = http.createServer((_req, res) => {
                res.statusCode = 426;
                res.end();
            });
            const ok = await new Promise((resolve) => {
                server.once("error", () => resolve(false));
                server.listen(port, "127.0.0.1", () => resolve(true));
            });
            if (!ok) continue;
            if (stopped) {
                server.close();
                return;
            }
            const wss = new WebSocketServer({ server, maxPayload: MAX_FRAME });
            wss.on("error", () => {});
            wss.on("connection", onWsConnection);
            wsHttp = server;
            wsServer = wss;
            wsPort = port;
            status.wsPort = port;
            log("discord websocket listening on", port);
            return;
        }
        status.error = status.error ?? "no free port for Discord RPC";
    }

    return {
        async start() {
            stopped = false;
            status.error = null;
            await Promise.all([startIpc(), startWs()]);
        },
        stop() {
            stopped = true;
            for (const s of [...sessions]) {
                s.end();
                try {
                    s.close();
                } catch {}
            }
            sessions.clear();
            try {
                ipcServer?.close();
            } catch {}
            try {
                for (const c of wsServer?.clients ?? []) c.terminate();
                wsServer?.close();
                wsHttp?.close();
            } catch {}
            ipcServer = wsServer = wsHttp = null;
            ipcPath = null;
            wsPort = null;
            status.ipcPath = null;
            status.ipcSlot = null;
            status.wsPort = null;
        },
        status: () => ({ ...status, ipcPath, wsPort }),
    };
}

module.exports = { createDiscordRpc, ipcBase, discordIpcBases };
