// Discord's list of detectable games: names and icons by application id, and
// the executables that identify each game on this platform.
//
// It is not shipped with the app. It is downloaded from Discord's public API
// the first time game detection or Discord Rich Presence is used, kept on disk
// (compressed, see knownGamesCodec.cjs) and refreshed when it is a week old.
// Without it, scanning finds nothing and apps simply go unnamed.

const fs = require("fs");
const path = require("path");
const { encodeGames, decodeGames } = require("./knownGamesCodec.cjs");

const LIST_URL = "https://discord.com/api/v9/applications/detectable";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// A failed download is not retried for this long.
const RETRY_AFTER_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 30_000;
// The real list has ~25,000 entries; far fewer means a broken answer, which
// must not replace a good list.
const MIN_ENTRIES = 1000;

/**
 * The API's answer cut down to what is used: launchers are dropped, and so are
 * entries with no executable.
 */
function parseDetectable(all) {
    return all
        .map((a) => ({
            id: String(a.id),
            name: String(a.name),
            icon: a.icon_hash || null,
            exe: (a.executables || [])
                .filter((x) => !x.is_launcher)
                .map((x) => ({
                    os: x.os,
                    name: x.name,
                    ...(x.arguments ? { args: x.arguments } : {}),
                })),
        }))
        .filter((a) => a.exe.length > 0);
}

const EXACT = 1;
const WINE = 2;

const ICON_BYTES = 16;
const ICON_HEX = /^[0-9a-f]{32}$/;

/**
 * Builds the lookup tables from the decoded list. About 10,000 games and
 * 11,000 executable names are kept in compact form: games as parallel arrays
 * (icon hashes packed into one byte array), executable entries as typed arrays
 * (game index and flags, with arguments only where there are some). The
 * returned `byId` and `byExe` are read-only views with the Map methods the
 * consumers use (get, has, size); get() builds the plain objects on demand, so
 * a lookup returns the same shape it always did:
 *   byId.get(id)     -> { name, icon } | undefined
 *   byExe.get(key)   -> [{ id, exact, args, wine }] | undefined
 */
function indexGames(games, platform) {
    const list = games ?? [];
    const n = list.length;
    const ids = new Array(n);
    const names = new Array(n);
    const iconBytes = new Uint8Array(n * ICON_BYTES);
    const hexIcon = new Uint8Array(n); // 1 where the icon is packed in iconBytes
    const otherIcons = new Map(); // game index -> icon, when not 32 hex digits
    const gameOf = new Map(); // id -> game index (a later game with the same id wins)
    const entryGame = []; // entry -> game index
    const entryFlags = []; // entry -> EXACT | WINE
    const entryArgs = new Map(); // entry -> args, only where the game gives some
    const nativeKeys = new Map(); // key -> [entry]
    const wineKeys = new Map(); // key -> [entry]
    for (let g = 0; g < n; g++) {
        const game = list[g];
        ids[g] = game.id;
        names[g] = game.name;
        if (typeof game.icon === "string" && ICON_HEX.test(game.icon)) {
            hexIcon[g] = 1;
            iconBytes.set(Buffer.from(game.icon, "hex"), g * ICON_BYTES);
        } else {
            otherIcons.set(g, game.icon);
        }
        gameOf.set(game.id, g);
        for (const exe of game.exe) {
            // Windows executables on Linux: Steam games run through Wine or
            // Proton are listed as win32 and run as .exe files.
            const wine =
                platform === "linux" &&
                exe.os === "win32" &&
                /\.exe$/i.test(exe.name);
            if (exe.os !== platform && !wine) continue;
            // A leading ">" means "the file name must be exactly this".
            const exact = exe.name.startsWith(">");
            const key = (exact ? exe.name.slice(1) : exe.name).toLowerCase();
            const e = entryGame.length;
            entryGame.push(g);
            entryFlags.push((exact ? EXACT : 0) | (wine ? WINE : 0));
            if (exe.args !== undefined) entryArgs.set(e, exe.args);
            const keys = wine ? wineKeys : nativeKeys;
            let bucket = keys.get(key);
            if (!bucket) keys.set(key, (bucket = []));
            bucket.push(e);
        }
    }
    // A key is a single entry (a number) or several (an array), to save memory.
    const byExe = new Map();
    const store = (key, bucket) =>
        byExe.set(key, bucket.length === 1 ? bucket[0] : bucket);
    for (const [key, bucket] of nativeKeys) store(key, bucket);
    // A native executable with the same name wins over a Windows one.
    for (const [key, bucket] of wineKeys)
        if (!nativeKeys.has(key)) store(key, bucket);

    const entryGameIndex = Int32Array.from(entryGame);
    const flags = Uint8Array.from(entryFlags);
    const gameAt = (g) => ({
        name: names[g],
        icon: hexIcon[g]
            ? Buffer.from(
                  iconBytes.subarray(g * ICON_BYTES, (g + 1) * ICON_BYTES),
              ).toString("hex")
            : otherIcons.get(g),
    });
    const entryAt = (e) => ({
        id: ids[entryGameIndex[e]],
        exact: (flags[e] & EXACT) !== 0,
        args: entryArgs.get(e),
        wine: (flags[e] & WINE) !== 0,
    });

    const byId = {
        get size() {
            return gameOf.size;
        },
        has: (id) => gameOf.has(id),
        get(id) {
            const g = gameOf.get(id);
            return g === undefined ? undefined : gameAt(g);
        },
    };
    const exeView = {
        get size() {
            return byExe.size;
        },
        has: (key) => byExe.has(key),
        get(key) {
            const found = byExe.get(key);
            if (found === undefined) return undefined;
            return (typeof found === "number" ? [found] : found).map(entryAt);
        },
    };
    return { platform, byId, byExe: exeView };
}

/**
 * `file` is where the compressed list is kept; `fetch` is the download
 * function (Electron's net.fetch, so the proxy setting applies). With no
 * `fetch` the list is only ever read from `file`.
 */
function createKnownGames({ file, fetch, now = Date.now, log = () => {} }) {
    let cached = null; // { platform, byId, byExe }
    let download = null; // in-flight promise
    let lastAttempt = 0;
    const status = { count: 0, updated: null, downloading: false, error: null };

    function readFile() {
        try {
            const games = decodeGames(fs.readFileSync(file));
            status.count = games.length;
            status.updated = fs.statSync(file).mtimeMs;
            return games;
        } catch {
            return null;
        }
    }

    /** Fetch the list now, unless it is fresh or was just tried. */
    function refresh({ force = false } = {}) {
        if (!fetch) return Promise.resolve();
        if (download) return download;
        const t = now();
        const stale =
            status.updated === null || t - status.updated > MAX_AGE_MS;
        if (!force && (!stale || t - lastAttempt < RETRY_AFTER_MS))
            return Promise.resolve();
        lastAttempt = t;
        status.downloading = true;
        download = (async () => {
            try {
                const res = await fetch(LIST_URL, {
                    signal: AbortSignal.timeout(TIMEOUT_MS),
                });
                if (!res.ok) throw new Error(`${LIST_URL}: ${res.status}`);
                const games = parseDetectable(await res.json());
                if (games.length < MIN_ENTRIES)
                    throw new Error(`list too short (${games.length})`);
                fs.mkdirSync(path.dirname(file), { recursive: true });
                const tmp = `${file}.tmp`;
                fs.writeFileSync(tmp, encodeGames(games));
                fs.renameSync(tmp, file);
                status.count = games.length;
                status.updated = now();
                status.error = null;
                cached = null;
                log("game list downloaded:", games.length, "games");
            } catch (e) {
                status.error = String(e?.message || e);
                log("game list download failed:", status.error);
            } finally {
                status.downloading = false;
                download = null;
            }
        })();
        return download;
    }

    /**
     * Names/icons by id, and executables by (lowercased) file name. Starts a
     * download in the background if there is no list yet or it is old.
     */
    async function load(platform = process.platform) {
        if (!cached || cached.platform !== platform) {
            cached = indexGames(readFile(), platform);
        }
        void refresh();
        return cached;
    }

    return { load, refresh, status: () => ({ ...status }) };
}

module.exports = { createKnownGames, parseDetectable, indexGames };
