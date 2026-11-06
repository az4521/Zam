// Notices games that are running by their executable, using Discord's list of
// detectable games (knownGames.cjs, downloaded on first use), so games that never report anything
// still show up. The matching follows arRPC's
// (https://github.com/OpenAsar/arrpc, MIT).
//
// Scanning is a look at every running process's path, so it only happens while
// the user has switched it on, and every game it finds is blocked from the
// profile until allowed.

const fs = require("fs");
const { execFile } = require("child_process");

const SCAN_EVERY_MS = 15_000;

function run(file, args, opts = {}) {
    return new Promise((resolve, reject) => {
        execFile(
            file,
            args,
            { windowsHide: true, maxBuffer: 32 * 1024 * 1024, ...opts },
            (err, stdout) => (err ? reject(err) : resolve(String(stdout))),
        );
    });
}

let useWmic = null;

/** [{ pid, paths: [candidate executable paths], args }] */
async function listProcesses(viaHost = false) {
    if (viaHost) return listHost();
    if (process.platform === "win32") return listWindows();
    if (process.platform === "darwin") return listDarwin();
    return listLinux();
}

/**
 * Processes on the host, from inside a Flatpak, by running ps there with
 * flatpak-spawn. Works only if the user has granted org.freedesktop.Flatpak.
 */
async function listHost() {
    return parseHostPs(
        await run("flatpak-spawn", [
            "--host",
            "ps",
            "-eo",
            "pid=,args=",
            "-ww",
        ]),
    );
}

/** Rows of `ps -eo pid=,args=` as scanner processes. */
function parseHostPs(out) {
    const rows = [];
    for (const line of out.split("\n")) {
        const m = /^\s*(\d+)\s+(.+)$/.exec(line);
        if (!m) continue;
        const args = m[2];
        // ps joins the arguments with spaces, so a path with a space in it is
        // ambiguous. The first word is the program; and for a Windows game run
        // by Wine or Proton, the text up to each ".exe" is a candidate too
        // (only the last path pieces are matched, so a loader before it is fine).
        const paths = [args.split(" ")[0]];
        const lower = args.toLowerCase();
        for (
            let i = lower.indexOf(".exe");
            i >= 0;
            i = lower.indexOf(".exe", i + 4)
        )
            paths.push(args.slice(0, i + 4));
        rows.push({ pid: +m[1], paths, args });
    }
    return rows;
}

/** Whether this sandbox may run commands on the host. */
async function hostAccessAllowed() {
    try {
        await run("flatpak-spawn", ["--host", "true"], { timeout: 5000 });
        return true;
    } catch {
        return false;
    }
}

async function listWindows() {
    // wmic is quick but is gone from newer Windows; PowerShell is everywhere.
    if (useWmic !== false) {
        try {
            const out = await run("wmic", [
                "process",
                "get",
                "ProcessID,ExecutablePath",
                "/format:csv",
            ]);
            useWmic = true;
            return out
                .split(/\r?\n/)
                .map((line) => {
                    // Node,ExecutablePath,ProcessId (a path may hold commas).
                    const row = line.trim();
                    const last = row.lastIndexOf(",");
                    const first = row.indexOf(",");
                    if (first < 0 || last <= first) return null;
                    const pid = +row.slice(last + 1);
                    const exe = row.slice(first + 1, last);
                    return pid > 0 && exe ? { pid, paths: [exe] } : null;
                })
                .filter(Boolean);
        } catch (e) {
            if (e.code !== "ENOENT" && useWmic === true) throw e;
            useWmic = false;
        }
    }
    const out = await run("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance Win32_Process -Property ProcessId,ExecutablePath,CommandLine | " +
            "Where-Object { $_.ExecutablePath } | " +
            "Select-Object ProcessId,ExecutablePath,CommandLine | ConvertTo-Json -Compress",
    ]);
    const rows = JSON.parse(out || "[]");
    return (Array.isArray(rows) ? rows : [rows]).map((r) => ({
        pid: r.ProcessId,
        paths: [r.ExecutablePath],
        args: r.CommandLine ?? undefined,
    }));
}

async function listDarwin() {
    const out = await run("ps", ["-axo", "pid=,comm="]);
    const rows = [];
    for (const line of out.split("\n")) {
        const m = /^\s*(\d+)\s+(.+)$/.exec(line);
        if (m) rows.push({ pid: +m[1], paths: [m[2]] });
    }
    return rows;
}

async function listLinux() {
    const names = await fs.promises.readdir("/proc");
    const rows = await Promise.all(
        names
            .filter((n) => +n > 0)
            .map(async (n) => {
                try {
                    const parts = (
                        await fs.promises.readFile(`/proc/${n}/cmdline`, "utf8")
                    ).split("\0");
                    // Wine and Proton run a game as an argument of their own
                    // loader, so a Windows path among the arguments counts too.
                    const paths = [
                        parts[0],
                        ...parts.slice(1).filter((p) => /\.exe$/i.test(p)),
                    ].filter(Boolean);
                    return paths.length
                        ? { pid: +n, paths, args: parts.slice(1).join(" ") }
                        : null;
                } catch {
                    return null;
                }
            }),
    );
    return rows.filter(Boolean);
}

const normalizePath = (p) => String(p).toLowerCase().replaceAll("\\", "/");

/**
 * Programs running now, one row per distinct executable, for picking a game
 * Discord's list does not know. Windows' own folder is left out.
 */
async function listPrograms(viaHost = false) {
    const byPath = new Map();
    for (const proc of await listProcesses(viaHost)) {
        const full = proc.paths[proc.paths.length - 1];
        if (!full) continue;
        const key = normalizePath(full);
        if (key.startsWith("c:/windows/") || byPath.has(key)) continue;
        const base = full.split(/[\\/]/).pop() ?? full;
        byPath.set(key, { path: full, name: base.replace(/\.exe$/i, "") });
    }
    return [...byPath.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Every trailing piece of a path, with and without "64" markers. */
function candidates(fullPath) {
    const parts = fullPath.toLowerCase().replaceAll("\\", "/").split("/");
    const out = new Set();
    for (let i = 1; i < parts.length; i++) {
        const tail = parts.slice(-i).join("/");
        out.add(tail);
        for (const marker of ["_64", ".x64", "x64", "64"])
            out.add(tail.replace(marker, ""));
    }
    return out;
}

/**
 * `onActivity({ socketId, clientId, activity, name, icon })` fires when a game
 * starts (with a start time) and again on every scan while it runs, and with
 * `activity: null` once it is gone.
 */
function createGameScanner({
    onActivity,
    // () => Promise<{ byId, byExe }>, from knownGames.cjs.
    loadGames,
    viaHost = false,
    log = () => {},
    // Games the user added by hand: [{ id, name, exe }], exe a full path.
    getCustomGames = () => [],
}) {
    let timer = null;
    let scanning = false;
    let running = false;
    const found = new Map(); // game id -> start time
    const status = { running: false, error: null };

    async function scan() {
        if (scanning || !running) return;
        scanning = true;
        try {
            const { byId, byExe } = await loadGames();
            const procs = await listProcesses(viaHost);
            const seen = new Map(); // game id -> path of its running executable
            const custom = new Map(
                getCustomGames().map((g) => [
                    g.id,
                    { ...g, exe: normalizePath(g.exe) },
                ]),
            );
            for (const proc of procs) {
                for (const full of proc.paths) {
                    const norm = normalizePath(full);
                    for (const g of custom.values())
                        if (g.exe === norm) seen.set(g.id, full);
                }
                for (const full of proc.paths) {
                    const tails = candidates(full);
                    const baseName = full
                        .toLowerCase()
                        .replaceAll("\\", "/")
                        .split("/")
                        .pop();
                    for (const tail of tails) {
                        for (const exe of byExe.get(tail) ?? []) {
                            if (exe.exact && tail !== baseName) continue;
                            if (
                                exe.args &&
                                proc.args &&
                                !proc.args.includes(exe.args)
                            )
                                continue;
                            if (!seen.has(exe.id)) seen.set(exe.id, full);
                        }
                    }
                }
            }
            for (const [id, exePath] of seen) {
                const game = byId.get(id) ?? custom.get(id);
                if (!game) continue;
                if (!found.has(id)) {
                    found.set(id, Date.now());
                    log("game started:", game.name);
                }
                onActivity({
                    socketId: `scan-${id}`,
                    clientId: id,
                    exe: exePath,
                    activity: {
                        application_id: id,
                        name: game.name,
                        type: 0,
                        timestamps: { start: found.get(id) },
                        ...(game.icon
                            ? { assets: { large_image: `icon:${game.icon}` } }
                            : {}),
                    },
                });
            }
            for (const id of [...found.keys()]) {
                if (seen.has(id)) continue;
                found.delete(id);
                log(
                    "game stopped:",
                    (byId.get(id) ?? custom.get(id))?.name ?? id,
                );
                onActivity({
                    socketId: `scan-${id}`,
                    clientId: id,
                    activity: null,
                });
            }
            status.error = null;
        } catch (e) {
            status.error = String(e?.message || e);
        } finally {
            scanning = false;
        }
    }

    return {
        start() {
            if (running) return;
            running = true;
            status.running = true;
            void scan();
            timer = setInterval(scan, SCAN_EVERY_MS);
        },
        stop() {
            running = false;
            status.running = false;
            if (timer) clearInterval(timer);
            timer = null;
            for (const id of [...found.keys()]) {
                found.delete(id);
                onActivity({
                    socketId: `scan-${id}`,
                    clientId: id,
                    activity: null,
                });
            }
        },
        status: () => ({ ...status }),
        // For tests.
        _scan: scan,
    };
}

module.exports = {
    createGameScanner,
    listPrograms,
    candidates,
    parseHostPs,
    hostAccessAllowed,
};
