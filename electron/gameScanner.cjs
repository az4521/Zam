// Notices games that are running by their executable, using Discord's list of
// detectable games (discordGames.cjs), so games that never report anything
// still show up. The matching follows arRPC's
// (https://github.com/OpenAsar/arrpc, MIT).
//
// Scanning is a look at every running process's path, so it only happens while
// the user has switched it on, and every game it finds is blocked from the
// profile until allowed.

const fs = require("fs");
const { execFile } = require("child_process");
const { loadGames } = require("./discordGames.cjs");

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
async function listProcesses() {
    if (process.platform === "win32") return listWindows();
    if (process.platform === "darwin") return listDarwin();
    return listLinux();
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
function createGameScanner({ onActivity, log = () => {} }) {
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
            const procs = await listProcesses();
            const seen = new Set();
            for (const proc of procs) {
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
                            seen.add(exe.id);
                        }
                    }
                }
            }
            for (const id of seen) {
                const game = byId.get(id);
                if (!game) continue;
                if (!found.has(id)) {
                    found.set(id, Date.now());
                    log("game started:", game.name);
                }
                onActivity({
                    socketId: `scan-${id}`,
                    clientId: id,
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
                log("game stopped:", byId.get(id)?.name ?? id);
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

module.exports = { createGameScanner, candidates };
