// Now playing: what a media player is playing, shown as "Listening to" in rich
// presence (richPresence.cjs). Windows reads the system's media transport
// controls (SMTC); Linux reads MPRIS on the session bus. macOS has no system
// API for other apps' now-playing info, so it asks Spotify and Music (the two
// apps with a scripting dictionary) through osascript.
//
// Only players that are PLAYING are reported. A paused, stopped or closed player
// is reported as null. onTrack({ playerId, playerName, track }) gets
//   track: { title, artist, album, durationMs, positionMs, startedAt, cover }
// or null, where startedAt = Date.now() - positionMs and cover is { type, data }
// (the album art, PNG/JPEG/WebP) or undefined.
//
// Windows reads go through one long-lived PowerShell helper, since the WinRT
// API is only reachable from .NET. Its output is one JSON line per session and
// an end marker after each poll.

const { spawn, execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { fileURLToPath } = require("url");
const { connectStream, readVardict } = require("./portalShortcuts.cjs");

const POLL_MS = 2000;
// Cover art: a file or download at most this big, and a Windows thumbnail
// (sent base64 in its line) at most SMTC_COVER_MAX bytes.
const ART_MAX_BYTES = 4 * 1024 * 1024;
const ART_TIMEOUT_MS = 10_000;
const SMTC_COVER_MAX = 1536 * 1024;
const SMTC_COVER_B64_MAX = Math.ceil(SMTC_COVER_MAX / 3) * 4;
// The only host a player's https art is fetched from (Spotify's covers).
const ART_HOST = "i.scdn.co";
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
// line per session, then {"end":true}, and repeats every two seconds. When a
// session's title, artist or album changed since its last line, the line also
// carries its thumbnail as base64 `cover` and `coverType` (PNG or JPEG only).
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
function ReadCover($ref) {
    if ($null -eq $ref) { return $null }
    $stream = AwaitWinRt ($ref.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
    # Called by reflection: PowerShell will not convert the COM object to IRandomAccessStream.
    $asStream = [System.IO.WindowsRuntimeStreamExtensions].GetMethod('AsStream', [type[]]@([Windows.Storage.Streams.IRandomAccessStream]))
    $net = $asStream.Invoke($null, @($stream))
    $mem = New-Object System.IO.MemoryStream
    $net.CopyTo($mem)
    if ($mem.Length -gt ${SMTC_COVER_MAX}) { return $null }
    $bytes = $mem.ToArray()
    if ($bytes.Length -ge 8 -and $bytes[0] -eq 137 -and $bytes[1] -eq 80 -and $bytes[2] -eq 78 -and $bytes[3] -eq 71) { $type = 'image/png' }
    elseif ($bytes.Length -ge 3 -and $bytes[0] -eq 255 -and $bytes[1] -eq 216 -and $bytes[2] -eq 255) { $type = 'image/jpeg' }
    else { return $null }
    return @{ type = $type; b64 = [Convert]::ToBase64String($bytes) }
}
$mgr = AwaitWinRt ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$out = [Console]::Out
$coverKeys = @{}
while ($true) {
    foreach ($s in $mgr.GetSessions()) {
        try {
            $media = AwaitWinRt ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
            $timeline = $s.GetTimelineProperties()
            $status = [string]$s.GetPlaybackInfo().PlaybackStatus
            $pos = $timeline.Position.TotalMilliseconds
            if ($status -eq 'Playing') { $pos += ([DateTimeOffset]::UtcNow - $timeline.LastUpdatedTime).TotalMilliseconds }
            $id = [string]$s.SourceAppUserModelId
            $cover = $null
            $trackKey = [string]$media.Title + [char]10 + [string]$media.Artist + [char]10 + [string]$media.AlbumTitle
            if ($coverKeys[$id] -ne $trackKey) {
                $coverKeys[$id] = $trackKey
                try { $cover = ReadCover $media.Thumbnail } catch {}
            }
            $line = [pscustomobject]@{
                SourceAppUserModelId = $s.SourceAppUserModelId
                title = $media.Title
                artist = $media.Artist
                albumTitle = $media.AlbumTitle
                playbackStatus = $status
                positionMs = [math]::Round($pos)
                endTimeMs = [math]::Round($timeline.EndTime.TotalMilliseconds)
            }
            if ($null -ne $cover) {
                $line | Add-Member -NotePropertyName cover -NotePropertyValue $cover.b64
                $line | Add-Member -NotePropertyName coverType -NotePropertyValue $cover.type
            }
            $out.WriteLine(($line | ConvertTo-Json -Compress))
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

/** The image type of some bytes by their magic numbers, or null. */
function sniffImage(b) {
    if (
        b.length >= 8 &&
        b[0] === 0x89 &&
        b[1] === 0x50 &&
        b[2] === 0x4e &&
        b[3] === 0x47 &&
        b[4] === 0x0d &&
        b[5] === 0x0a &&
        b[6] === 0x1a &&
        b[7] === 0x0a
    )
        return "image/png";
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
        return "image/jpeg";
    if (
        b.length >= 12 &&
        b.toString("latin1", 0, 4) === "RIFF" &&
        b.toString("latin1", 8, 12) === "WEBP"
    )
        return "image/webp";
    return null;
}

/** { type, data } for bytes that are an image of one of `types`, else undefined. */
function coverOf(bytes, types = ["image/png", "image/jpeg", "image/webp"]) {
    const type = sniffImage(bytes);
    if (!type || !types.includes(type)) return undefined;
    return { type, data: new Uint8Array(bytes) };
}

/**
 * One line from the PowerShell helper: a session as { end: false, playerId,
 * playerName, playing, title, artist, album, durationMs, positionMs, cover }, the
 * end of a poll as { end: true }, or null for anything else. `cover` is { type,
 * data } when the line carried a PNG or JPEG thumbnail that is not too big.
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
    let cover;
    if (
        typeof msg.cover === "string" &&
        msg.cover.length <= SMTC_COVER_B64_MAX
    ) {
        const bytes = Buffer.from(msg.cover, "base64");
        if (bytes.length <= SMTC_COVER_MAX)
            cover = coverOf(bytes, ["image/png", "image/jpeg"]);
    }
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
        cover,
    };
}

/** Folders a player may keep cover art in, for file:// art URLs. */
function artFolders(env = process.env) {
    const home = os.homedir();
    return [
        os.tmpdir(),
        "/tmp",
        "/var/tmp",
        env.XDG_RUNTIME_DIR,
        env.XDG_CACHE_HOME || path.join(home, ".cache"),
        path.join(home, ".local", "share"),
        path.join(home, ".var", "app"),
        path.join(home, "snap"),
    ].filter(Boolean);
}

async function inArtFolder(file) {
    for (const dir of artFolders()) {
        let real;
        try {
            real = await fs.promises.realpath(dir);
        } catch {
            continue;
        }
        const rel = path.relative(real, file);
        if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) return true;
    }
    return false;
}

/**
 * The picture at an art URL as { type, data }, or undefined. A file:// URL is
 * read from disk, but only from a cache or temp folder (see artFolders). An https URL is fetched only from i.scdn.co, and
 * open.spotify.com/image/<id> is mapped to i.scdn.co/image/<id>; any other
 * host, scheme or port is refused, so an app cannot point this at the user's
 * network. Bytes that are not a PNG, JPEG or WebP are refused too.
 */
async function readArt(raw, doFetch) {
    let url;
    try {
        url = new URL(String(raw));
    } catch {
        return undefined;
    }
    if (url.protocol === "file:") {
        const file = await fs.promises.realpath(fileURLToPath(url));
        // Players keep covers in a cache or temp folder. Anywhere else (a photo
        // in Pictures, say) is not theirs to put on the profile.
        if (!(await inArtFolder(file))) return undefined;
        const st = await fs.promises.stat(file);
        if (!st.isFile() || st.size > ART_MAX_BYTES) return undefined;
        return coverOf(await fs.promises.readFile(file));
    }
    if (url.protocol !== "https:" || typeof doFetch !== "function")
        return undefined;
    if (url.hostname === "open.spotify.com") {
        const m = /^\/image\/([A-Za-z0-9]{8,64})$/.exec(url.pathname);
        if (!m) return undefined;
        url = new URL(`https://${ART_HOST}/image/${m[1]}`);
    }
    if (url.hostname !== ART_HOST || url.port || url.username || url.password)
        return undefined;
    const res = await doFetch(url.href, {
        signal: AbortSignal.timeout(ART_TIMEOUT_MS),
    });
    if (!res.ok) return undefined;
    // Redirects are followed, so check where it ended up.
    if (res.url && new URL(res.url).hostname !== ART_HOST) return undefined;
    if (Number(res.headers.get("content-length")) > ART_MAX_BYTES)
        return undefined;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > ART_MAX_BYTES) return undefined;
    return coverOf(bytes);
}

/**
 * Pictures per player, read only when the player's art URL changes: a player
 * keeps its picture until the URL changes, and a failed read is not retried
 * until then. keep() forgets the players not in the given set.
 */
function createArtCache(doFetch) {
    const byPlayer = new Map(); // key -> { url, cover }
    return {
        async cover(key, url) {
            if (!url) {
                byPlayer.delete(key);
                return undefined;
            }
            const held = byPlayer.get(key);
            if (held && held.url === url) return held.cover;
            let cover;
            try {
                cover = await readArt(url, doFetch);
            } catch {
                cover = undefined;
            }
            byPlayer.set(key, { url, cover });
            return cover;
        },
        keep(keys) {
            for (const key of byPlayer.keys())
                if (!keys.has(key)) byPlayer.delete(key);
        },
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
        artUrl: text(md["mpris:artUrl"]) || undefined,
    };
}

/**
 * Turns each poll's sessions into onTrack calls, sending only what changed: a
 * new track, a resume, a seek, or a player that stopped. update() takes every
 * session seen in one poll; `now` is for tests.
 */
function createTrackDiffer(onTrack) {
    const shown = new Map(); // playerId -> { name, key, positionMs, at }
    // playerId -> { key, cover }: the cover of the track it was read for, kept
    // across polls, seeks and pauses of that same track.
    const covers = new Map();
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
                // A new track has no cover unless this poll brought one.
                const held = covers.get(s.playerId);
                const cover =
                    s.cover ??
                    (held && held.key === key ? held.cover : undefined);
                covers.set(s.playerId, { key, cover });
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
                        cover,
                    },
                });
            }
            for (const [playerId, prev] of shown) {
                if (seen.has(playerId)) continue;
                shown.delete(playerId);
                onTrack({ playerId, playerName: prev.name, track: null });
            }
            for (const playerId of covers.keys())
                if (!seen.has(playerId)) covers.delete(playerId);
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
                // Spotify's cover is an i.scdn.co address; Music has none.
                if (p.playerId === "spotify") {
                    try {
                        session.artUrl = String(t.artworkUrl());
                    } catch {}
                }
            }
            out.push(session);
        } catch (e) {
            fail(p.playerName, e);
        }
    }
    return JSON.stringify(out);
}
`;

function startMpris({ diff, status, log, doFetch }) {
    let bus = null;
    let polling = false;
    let stopping = false;
    // Bus name -> its Identity (the name people know it by).
    const identities = new Map();
    const art = createArtCache(doFetch);

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
                players.map(async (name) => {
                    try {
                        const s = await readPlayer(name);
                        s.cover = await art.cover(name, s.artUrl);
                        return s;
                    } catch (e) {
                        log("media player", name, "unreadable:", e.message);
                        return null;
                    }
                }),
            );
            art.keep(new Set(players));
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
            artUrl:
                playerId === "spotify"
                    ? text(m.artUrl) || undefined
                    : undefined,
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

function startMacos({ diff, status, log, doFetch }) {
    let polling = false;
    let stopping = false;
    let child = null;
    // Each distinct failure is logged once, not on every poll.
    const logged = new Set();
    const art = createArtCache(doFetch);

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

    async function handle(err, stdout, stderr) {
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
        const sessions = parseMacosOutput(stdout);
        for (const s of sessions)
            s.cover = await art.cover(s.playerId, s.artUrl);
        if (stopping) return;
        diff.update(sessions);
        report(parseMacosErrors(stdout));
    }

    function poll() {
        if (polling || stopping) return;
        polling = true;
        child = execFile(
            "osascript",
            ["-l", "JavaScript", "-e", MACOS_SCRIPT],
            { timeout: CALL_TIMEOUT_MS, windowsHide: true },
            (err, stdout, stderr) => void handle(err, stdout, stderr),
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
 * SMTC helper are both reachable from inside a Flatpak. `fetch` (net.fetch in
 * the app) is what cover art from i.scdn.co is downloaded with; without it only
 * file:// art is read.
 */
function createMediaSession({
    onTrack,
    inFlatpak = false,
    log = () => {},
    fetch: doFetch,
}) {
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
                impl = startMpris({ diff, status, log, doFetch });
            else if (process.platform === "darwin")
                impl = startMacos({ diff, status, log, doFetch });
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
    readArt,
    SMTC_SCRIPT,
};
