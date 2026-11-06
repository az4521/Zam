// Now playing: what a media player is playing, shown as "Listening to" in rich
// presence (richPresence.cjs). Windows reads the system's media transport
// controls (SMTC); Linux reads MPRIS on the session bus. macOS has no system
// API for other apps' now-playing info, so it asks Spotify and Music (the two
// apps with a scripting dictionary) through osascript.
//
// Only players that are PLAYING are reported. A paused, stopped or closed player
// is reported as null. onTrack({ playerId, playerName, track }) gets
//   track: { title, artist, album, durationMs, positionMs, startedAt }
// or null, where startedAt = Date.now() - positionMs.
//
// Windows reads go through one long-lived PowerShell helper, since the WinRT
// API is only reachable from .NET. Its output is one JSON line per session and
// an end marker after each poll.

const { spawn, execFile } = require("child_process");
const { connectStream, readVardict } = require("./portalShortcuts.cjs");

const POLL_MS = 2000;
// A position further than this from where the last report puts it is a seek.
const SEEK_MS = 3000;
const CALL_TIMEOUT_MS = 5000;
// The helper may die once; a second death is given up on.
const RESTART_LIMIT = 1;
const MPRIS_PREFIX = "org.mpris.MediaPlayer2.";
const MPRIS_PATH = "/org/mpris/MediaPlayer2";
const ROOT_IFACE = "org.mpris.MediaPlayer2";
const PLAYER_IFACE = "org.mpris.MediaPlayer2.Player";

// Reads every session's media, timeline and playback state, prints one JSON
// line per session, then {"end":true}, and repeats every two seconds.
const SMTC_SCRIPT = `
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null =[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -like 'IAsyncOperation*' } | Select-Object -First 1
function AwaitWinRt($op, $type) {
    $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
    $task.Wait(-1) | Out-Null
    $task.Result
}
$mgr = AwaitWinRt ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$out = [Console]::Out
while ($true) {
    foreach ($s in $mgr.GetSessions()) {
        try {
            $media = AwaitWinRt ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
            $timeline = $s.GetTimelineProperties()
            $status = [string]$s.GetPlaybackInfo().PlaybackStatus
            $pos = $timeline.Position.TotalMilliseconds
            if ($status -eq 'Playing') { $pos += ([DateTimeOffset]::UtcNow - $timeline.LastUpdatedTime).TotalMilliseconds }
            $line = [pscustomobject]@{
                SourceAppUserModelId = $s.SourceAppUserModelId
                title = $media.Title
                artist = $media.Artist
                albumTitle = $media.AlbumTitle
                playbackStatus = $status
                positionMs = [math]::Round($pos)
                endTimeMs = [math]::Round($timeline.EndTime.TotalMilliseconds)
            } | ConvertTo-Json -Compress
            $out.WriteLine($line)
        } catch {}
    }
    $out.WriteLine('{"end":true}')
    Start-Sleep -Seconds 2
}
`;

const text = (v) => (typeof v === "string" ? v.trim() : "");
/** A whole, non-negative number of milliseconds, or 0 when there is none. */
const ms = (v) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * A name for a player from its app id: "Spotify.exe" -> "Spotify", a packaged
 * app "Publisher.Name_hash!App" -> "Name", a path -> its file name.
 */
function friendlyName(appId) {
    const raw = String(appId);
    let name = raw
        .split(/[\\/]/)
        .pop()
        .replace(/\.exe$/i, "");
    if (raw.includes("!")) {
        name = name
            .split("!")[0]
            .replace(/_[^.]*$/, "")
            .split(".")
            .pop();
    }
    return name.trim() || raw;
}

/**
 * One line from the PowerShell helper: a session as { end: false, playerId,
 * playerName, playing, title, artist, album, durationMs, positionMs }, the end
 * of a poll as { end: true }, or null for anything else.
 */
function parseSmtcLine(line) {
    let msg;
    try {
        // A UTF-8 byte order mark may come first.
        msg = JSON.parse(String(line).replace(/^﻿/, ""));
    } catch {
        return null;
    }
    if (msg?.end === true) return { end: true };
    const appId = msg?.SourceAppUserModelId;
    if (typeof appId !== "string" || !appId) return null;
    return {
        end: false,
        playerId: appId.toLowerCase(),
        playerName: friendlyName(appId),
        playing: msg.playbackStatus === "Playing",
        title: text(msg.title),
        artist: text(msg.artist),
        album: text(msg.albumTitle),
        durationMs: ms(msg.endTimeMs),
        positionMs: ms(msg.positionMs),
    };
}

/** "org.mpris.MediaPlayer2.vlc.instance42" -> "vlc". */
function mprisId(busName) {
    return busName
        .slice(MPRIS_PREFIX.length)
        .replace(/\.instance\d+$/, "")
        .toLowerCase();
}

/**
 * A player as a session, from its Player properties (read with readVardict,
 * so Metadata may still be the pairs it came in) and its MPRIS Identity.
 */
function parseMprisProps(busName, props, identity = "") {
    const md = Array.isArray(props.Metadata)
        ? readVardict(props.Metadata)
        : props.Metadata || {};
    const artist = md["xesam:artist"];
    const playerId = mprisId(busName);
    return {
        end: false,
        playerId,
        playerName: text(identity) || playerId,
        playing: props.PlaybackStatus === "Playing",
        title: text(md["xesam:title"]),
        // xesam:artist is a list of names.
        artist: Array.isArray(artist)
            ? artist.map(text).filter(Boolean).join(", ")
            : text(artist),
        album: text(md["xesam:album"]),
        // MPRIS counts in microseconds.
        durationMs: ms(Number(md["mpris:length"]) / 1000),
        positionMs: ms(Number(props.Position) / 1000),
    };
}

/**
 * Turns each poll's sessions into onTrack calls, sending only what changed: a
 * new track, a resume, a seek, or a player that stopped. update() takes every
 * session seen in one poll; `now` is for tests.
 */
function createTrackDiffer(onTrack) {
    const shown = new Map(); // playerId -> { name, key, positionMs, at }
    return {
        update(sessions, now = Date.now()) {
            const seen = new Set();
            for (const s of sessions) {
                if (seen.has(s.playerId)) continue;
                seen.add(s.playerId);
                const prev = shown.get(s.playerId);
                // A player with nothing to show is not listening to anything.
                if (!s.playing || !s.title) {
                    if (prev) {
                        shown.delete(s.playerId);
                        onTrack({
                            playerId: s.playerId,
                            playerName: s.playerName,
                            track: null,
                        });
                    }
                    continue;
                }
                const key = [s.title, s.artist, s.album, s.durationMs].join(
                    "\n",
                );
                if (
                    prev &&
                    prev.key === key &&
                    Math.abs(
                        s.positionMs - (prev.positionMs + now - prev.at),
                    ) <= SEEK_MS
                )
                    continue;
                shown.set(s.playerId, {
                    name: s.playerName,
                    key,
                    positionMs: s.positionMs,
                    at: now,
                });
                onTrack({
                    playerId: s.playerId,
                    playerName: s.playerName,
                    track: {
                        title: s.title,
                        artist: s.artist,
                        album: s.album,
                        durationMs: s.durationMs,
                        positionMs: s.positionMs,
                        startedAt: now - s.positionMs,
                    },
                });
            }
            for (const [playerId, prev] of shown) {
                if (seen.has(playerId)) continue;
                shown.delete(playerId);
                onTrack({ playerId, playerName: prev.name, track: null });
            }
        },
    };
}

function startSmtc({ diff, status, log }) {
    let stopping = false;
    let child = null;
    let restarts = 0;

    const spawnHelper = () => {
        // The script is passed as an argument: PowerShell reads nothing from a
        // stdin that Node gives it, and reports the end of input at once.
        const encoded = Buffer.from(SMTC_SCRIPT, "utf16le").toString("base64");
        const proc = spawn(
            "powershell.exe",
            ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
            { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
        );
        child = proc;
        let buf = "";
        let batch = [];
        let stderr = "";
        proc.stdout.setEncoding("utf8");
        proc.stdout.on("data", (chunk) => {
            buf += chunk;
            for (let nl = buf.indexOf("\n"); nl >= 0; nl = buf.indexOf("\n")) {
                const msg = parseSmtcLine(buf.slice(0, nl));
                buf = buf.slice(nl + 1);
                if (msg?.end) {
                    diff.update(batch);
                    batch = [];
                } else if (msg) batch.push(msg);
            }
        });
        proc.stderr.on("data", (d) => {
            stderr = (stderr + d).slice(-500);
        });

        let dead = false;
        const died = (reason) => {
            if (dead || stopping) return;
            dead = true;
            if (restarts++ < RESTART_LIMIT) {
                log("media helper stopped, restarting:", reason);
                spawnHelper();
                return;
            }
            status.running = false;
            status.error = `media helper stopped: ${reason}`;
            diff.update([]);
        };
        proc.on("error", (e) => died(e.message));
        proc.on("exit", (code) => died(`exit ${code} ${stderr.trim()}`.trim()));
    };

    spawnHelper();
    return {
        stop() {
            stopping = true;
            child?.kill();
            child = null;
            diff.update([]);
        },
    };
}

/** A D-Bus method call as a promise of its reply's values. */
function call(bus, msg, onBus = false) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`${msg.member} timed out`)),
            CALL_TIMEOUT_MS,
        );
        const done = (err, ...res) => {
            clearTimeout(timer);
            if (err)
                reject(
                    new Error(`${err.name || "Error"}: ${err.message || ""}`),
                );
            else resolve(res);
        };
        if (onBus) bus.invokeDbus(msg, done);
        else bus.invoke(msg, done);
    });
}

const PROPS_IFACE = "org.freedesktop.DBus.Properties";

const MACOS_POLL_MS = 3000;
const MACOS_DENIED = /-1743|Not authorized to send Apple events/;

// One JXA run: prints a JSON array with a session per playing or paused player
// and an { error: true, app, denied, message } element per failure. Spotify and
// Music are only asked when NSWorkspace says they are running, because
// talking to an app that is not running launches it (NSWorkspace needs no
// Automation permission, unlike System Events). Spotify reports its
// duration in milliseconds, Music in seconds; positions are seconds in both.
const MACOS_SCRIPT = `
function run() {
    const out = [];
    const fail = (app, e) => {
        const message = String((e && e.message) || e);
        const denied = (e && e.errorNumber === -1743) || /-1743|Not authorized to send Apple events/.test(message);
        out.push({ error: true, app, denied: !!denied, message });
    };
    const running = [];
    try {
        ObjC.import("AppKit");
        const apps = $.NSWorkspace.sharedWorkspace.runningApplications;
        for (let i = 0; i < apps.count; i++) {
            const id = ObjC.unwrap(apps.objectAtIndex(i).bundleIdentifier);
            if (id) running.push(id);
        }
    } catch (e) {
        fail("NSWorkspace", e);
    }
    const players = [
        {
            playerId: "spotify",
            playerName: "Spotify",
            bundleId: "com.spotify.client",
            durationScale: 1,
        },
        {
            playerId: "music",
            playerName: "Music",
            bundleId: "com.apple.Music",
            durationScale: 1000,
        },
    ];
    for (const p of players) {
        if (running.indexOf(p.bundleId) < 0) continue;
        try {
            const app = Application(p.bundleId);
            const state = String(app.playerState()).toLowerCase();
            const playing = state.indexOf("playing") >= 0;
            const session = {
                playerId: p.playerId,
                playerName: p.playerName,
                playing,
                title: "",
                artist: "",
                album: "",
                durationMs: 0,
                positionMs: 0,
            };
            if (playing || state.indexOf("paused") >= 0) {
                const t = app.currentTrack;
                session.title = String(t.name());
                session.artist = String(t.artist());
                session.album = String(t.album());
                session.durationMs = Math.round(t.duration() * p.durationScale);
                session.positionMs = Math.round(app.playerPosition() * 1000);
            }
            out.push(session);
        } catch (e) {
            fail(p.playerName, e);
        }
    }
    return JSON.stringify(out);
}
`;

function startMpris({ diff, status, log }) {
    let bus = null;
    let polling = false;
    let stopping = false;
    // Bus name -> its Identity (the name people know it by).
    const identities = new Map();

    async function connect() {
        const dbus = require("@homebridge/dbus-native");
        const b = dbus.createClient({
            stream: connectStream(process.env.DBUS_SESSION_BUS_ADDRESS),
            direct: true,
        });
        const drop = () => {
            if (bus === b) bus = null;
        };
        b.connection.on("error", drop);
        b.connection.on("end", drop);
        try {
            await call(b, { member: "Hello" }, true);
        } catch (e) {
            try {
                b.connection.end();
            } catch {}
            throw e;
        }
        bus = b;
    }

    async function readPlayer(name) {
        const [raw] = await call(bus, {
            destination: name,
            path: MPRIS_PATH,
            interface: PROPS_IFACE,
            member: "GetAll",
            signature: "s",
            body: [PLAYER_IFACE],
        });
        let identity = identities.get(name);
        if (identity === undefined) {
            // Only remembered once it is read; a failure is tried again later.
            try {
                const [root] = await call(bus, {
                    destination: name,
                    path: MPRIS_PATH,
                    interface: PROPS_IFACE,
                    member: "GetAll",
                    signature: "s",
                    body: [ROOT_IFACE],
                });
                identity = text(readVardict(root).Identity);
                identities.set(name, identity);
            } catch {
                identity = "";
            }
        }
        return parseMprisProps(name, readVardict(raw), identity);
    }

    async function poll() {
        if (polling || stopping) return;
        polling = true;
        try {
            if (!bus) await connect();
            const [names] = await call(bus, { member: "ListNames" }, true);
            const players = names.filter((n) => n.startsWith(MPRIS_PREFIX));
            for (const name of [...identities.keys()])
                if (!players.includes(name)) identities.delete(name);
            // One player failing must not stop the others being reported.
            const sessions = await Promise.all(
                players.map((name) =>
                    readPlayer(name).catch((e) => {
                        log("media player", name, "unreadable:", e.message);
                        return null;
                    }),
                ),
            );
            if (stopping) return;
            diff.update(sessions.filter(Boolean));
            status.error = null;
        } catch (e) {
            if (stopping) return;
            status.error = String(e?.message || e);
            // Reconnect on the next poll.
            const dead = bus;
            bus = null;
            try {
                dead?.connection.end();
            } catch {}
        } finally {
            polling = false;
        }
    }

    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return {
        stop() {
            stopping = true;
            clearInterval(timer);
            const b = bus;
            bus = null;
            try {
                b?.connection.end();
            } catch {}
            diff.update([]);
        },
    };
}

/**
 * The sessions in one osascript run's stdout (the array MACOS_SCRIPT prints),
 * as parseSmtcLine would give them minus `end`. Garbage, a non-array, or an
 * element without a playerId gives nothing.
 */
function parseMacosOutput(stdout) {
    const list = parseMacosList(stdout);
    const sessions = [];
    for (const m of list) {
        if (m.error === true) continue;
        const playerId = text(m.playerId).toLowerCase();
        if (!playerId) continue;
        sessions.push({
            playerId,
            playerName: text(m.playerName) || playerId,
            playing: m.playing === true,
            title: text(m.title),
            artist: text(m.artist),
            album: text(m.album),
            durationMs: ms(m.durationMs),
            positionMs: ms(m.positionMs),
        });
    }
    return sessions;
}

/** The failures in one osascript run's stdout: [{ app, denied, message }]. */
function parseMacosErrors(stdout) {
    return parseMacosList(stdout)
        .filter((m) => m.error === true)
        .map((m) => ({
            app: text(m.app) || "macOS",
            denied: m.denied === true,
            message: text(m.message),
        }));
}

function parseMacosList(stdout) {
    let list;
    try {
        list = JSON.parse(String(stdout ?? "").trim());
    } catch {
        return [];
    }
    if (!Array.isArray(list)) return [];
    return list.filter((m) => m && typeof m === "object");
}

function startMacos({ diff, status, log }) {
    let polling = false;
    let stopping = false;
    let child = null;
    // Each distinct failure is logged once, not on every poll.
    const logged = new Set();

    /** Sets status.error from one poll's failures; none clears it. */
    const report = (errors) => {
        const denied = errors.filter((e) => e.denied).map((e) => e.app);
        const parts = [];
        if (denied.length)
            parts.push(
                `macOS blocked access to ${denied.join(" and ")}: allow Zam under System Settings > Privacy & Security > Automation`,
            );
        for (const e of errors) {
            if (e.denied) continue;
            parts.push(`${e.app}: ${e.message}`);
        }
        for (const e of errors) {
            const key = e.denied ? `denied ${e.app}` : `${e.app} ${e.message}`;
            if (logged.has(key)) continue;
            logged.add(key);
            log("media", e.app, e.denied ? "not authorized" : e.message);
        }
        status.error = parts.length ? parts.join("; ") : null;
    };

    function poll() {
        if (polling || stopping) return;
        polling = true;
        child = execFile(
            "osascript",
            ["-l", "JavaScript", "-e", MACOS_SCRIPT],
            { timeout: CALL_TIMEOUT_MS, windowsHide: true },
            (err, stdout, stderr) => {
                polling = false;
                child = null;
                if (stopping) return;
                if (err) {
                    // The script catches its own failures, so this is osascript
                    // itself failing: the whole poll is lost.
                    const errText = String(stderr || "").trim();
                    const denied = MACOS_DENIED.test(errText);
                    const message = err.killed
                        ? "timed out"
                        : errText.split("\n")[0] || err.message;
                    report([
                        {
                            app: denied ? "Spotify or Music" : "osascript",
                            denied,
                            message,
                        },
                    ]);
                    return;
                }
                diff.update(parseMacosOutput(stdout));
                report(parseMacosErrors(stdout));
            },
        );
    }

    poll();
    const timer = setInterval(poll, MACOS_POLL_MS);
    return {
        stop() {
            stopping = true;
            clearInterval(timer);
            try {
                child?.kill();
            } catch {}
            child = null;
            diff.update([]);
        },
    };
}

/**
 * The media listener. `inFlatpak` changes nothing: the session bus and the
 * SMTC helper are both reachable from inside a Flatpak.
 */
function createMediaSession({ onTrack, inFlatpak = false, log = () => {} }) {
    const diff = createTrackDiffer(onTrack);
    const status = { running: false, error: null };
    let impl = null;
    return {
        start() {
            if (status.running) return;
            impl?.stop();
            impl = null;
            status.error = null;
            if (process.platform === "win32")
                impl = startSmtc({ diff, status, log });
            else if (process.platform === "linux")
                impl = startMpris({ diff, status, log });
            else if (process.platform === "darwin")
                impl = startMacos({ diff, status, log });
            else return;
            status.running = true;
        },
        stop() {
            impl?.stop();
            impl = null;
            status.running = false;
            status.error = null;
        },
        status: () => ({ ...status }),
    };
}

module.exports = {
    createMediaSession,
    createTrackDiffer,
    friendlyName,
    mprisId,
    parseMacosErrors,
    parseMacosOutput,
    parseMprisProps,
    parseSmtcLine,
    SMTC_SCRIPT,
};
