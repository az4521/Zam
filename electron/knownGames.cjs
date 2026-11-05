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

    function index(games, platform) {
        const byId = new Map();
        const byExe = new Map(); // name -> [{ id, exact, args }]
        for (const game of games ?? []) {
            byId.set(game.id, { name: game.name, icon: game.icon });
            for (const exe of game.exe) {
                if (exe.os !== platform) continue;
                // A leading ">" means "the file name must be exactly this".
                const exact = exe.name.startsWith(">");
                const key = (
                    exact ? exe.name.slice(1) : exe.name
                ).toLowerCase();
                let list = byExe.get(key);
                if (!list) byExe.set(key, (list = []));
                list.push({ id: game.id, exact, args: exe.args });
            }
        }
        return { platform, byId, byExe };
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
            cached = index(readFile(), platform);
        }
        void refresh();
        return cached;
    }

    return { load, refresh, status: () => ({ ...status }) };
}

module.exports = { createKnownGames, parseDetectable };
