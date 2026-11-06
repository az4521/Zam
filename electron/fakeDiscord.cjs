// A stand-in process named Discord, for apps that look for one before they
// will send Discord Rich Presence (Statusify, for one). They check the process
// list, then talk to the discord-ipc socket that discordRpc.cjs serves; the
// stand-in only makes the first check pass. It does nothing, speaks to nobody,
// and exists only while the user has the setting on and no real Discord runs.
//
//   Windows  a copy of ping.exe named Discord.exe, pinging 127.0.0.1 forever
//   Linux    a symlink named discord to sleep
//   macOS    a symlink named Discord to sleep
//
// In a Flatpak the sandbox's processes are invisible to other apps, so the
// stand-in is started on the host with flatpak-spawn (--watch-bus ends it when
// Zam goes), which needs the user to have granted org.freedesktop.Flatpak.
//
// The pid is remembered in userData so a Zam that crashed does not leave a
// second one behind: the next start adopts it, or clears it if it is gone.

const { execFile, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

function run(cmd, args) {
    return new Promise((resolve) => {
        execFile(
            cmd,
            args,
            { windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
            (err, stdout) => resolve(err ? "" : String(stdout)),
        );
    });
}

/** The name the process shows under, per platform. */
function fakeName(platform) {
    if (platform === "win32") return "Discord.exe";
    return platform === "darwin" ? "Discord" : "discord";
}

/** Whether a real Discord (any variant, any of its processes) is running. */
async function realDiscordRunning(platform, ownPid = null, runner = run) {
    if (platform === "win32") {
        const out = (
            await run("tasklist", ["/FO", "CSV", "/NH"])
        ).toLowerCase();
        for (const line of out.split("\n")) {
            const m = /^"(discord(?:ptb|canary)?\.exe)","(\d+)"/.exec(line);
            if (m && Number(m[2]) !== ownPid) return true;
        }
        return false;
    }
    const out = await runner("ps", ["-axww", "-o", "pid=,args="]);
    for (const line of out.split("\n")) {
        const m = /^\s*(\d+)\s+(.*)$/.exec(line);
        if (!m || Number(m[1]) === ownPid) continue;
        const args = m[2];
        if (
            platform === "darwin"
                ? /\/Discord(?: PTB| Canary)?\.app\/Contents\//.test(args)
                : /^(\S*\/)?discord(?:ptb|canary)?(?:\s|$)/i.test(args)
        )
            return true;
    }
    return false;
}

function createFakeDiscord({
    userDataDir,
    platform = process.platform,
    inFlatpak = false,
    env = process.env,
    spawnProcess = (cmd, args) => {
        const child = spawn(cmd, args, {
            stdio: "ignore",
            windowsHide: true,
        });
        child.on("error", () => {});
        return child;
    },
    realRunning = (plat) =>
        realDiscordRunning(
            plat,
            null,
            inFlatpak
                ? (cmd, args) => run("flatpak-spawn", ["--host", cmd, ...args])
                : run,
        ),
    // Whether `pid` is a stand-in we started: killing a reused pid is worse
    // than leaving a stand-in running.
    isOurs = async (pid, name) => {
        if (platform === "win32") {
            return (
                await run("tasklist", [
                    "/FI",
                    `PID eq ${pid}`,
                    "/FO",
                    "CSV",
                    "/NH",
                ])
            )
                .toLowerCase()
                .includes(`"${name.toLowerCase()}"`);
        }
        const comm = (
            await run("ps", ["-p", String(pid), "-o", "comm="])
        ).trim();
        return comm !== "" && path.basename(comm) === name;
    },
    log = () => {},
} = {}) {
    const dir = path.join(userDataDir, "fake-discord");
    const pidFile = path.join(dir, "pid");
    const name = fakeName(platform);
    const supported = ["win32", "linux", "darwin"].includes(platform);
    // A Flatpak can only start it on the host, if allowed.
    let hostAllowed = !inFlatpak;
    // A host process is not ours to adopt by pid; --watch-bus clears it.
    const persistent = !inFlatpak;
    let child = null;
    let pid = null;
    let error = null;
    let busy = Promise.resolve();

    function readPid() {
        try {
            const n = Number(fs.readFileSync(pidFile, "utf8"));
            return Number.isInteger(n) && n > 0 ? n : null;
        } catch {
            return null;
        }
    }

    function forgetPid() {
        try {
            fs.rmSync(pidFile, { force: true });
        } catch {}
    }

    function alive(p) {
        try {
            process.kill(p, 0);
            return true;
        } catch (e) {
            return e.code === "EPERM";
        }
    }

    /** The program to run, set up under its stand-in name. */
    function prepare() {
        fs.mkdirSync(dir, { recursive: true });
        const exe = path.join(dir, name);
        if (platform === "win32") {
            const src = path.join(
                env.SystemRoot || env.windir || "C:\\Windows",
                "System32",
                "ping.exe",
            );
            const stale =
                !fs.existsSync(exe) ||
                fs.statSync(exe).size !== fs.statSync(src).size;
            if (stale) fs.copyFileSync(src, exe);
            return { exe, args: ["-t", "127.0.0.1"] };
        }
        const sleep = ["/bin/sleep", "/usr/bin/sleep"].find((p) =>
            fs.existsSync(p),
        );
        if (!sleep) throw new Error("no sleep program found");
        try {
            fs.unlinkSync(exe);
        } catch {}
        fs.symlinkSync(sleep, exe);
        return { exe, args: ["2147483647"] };
    }

    async function doStart() {
        if (!supported || !hostAllowed || pid !== null) return;
        // One left by a Zam that ended without stopping it: keep using it.
        const old = persistent ? readPid() : null;
        if (old !== null) {
            if (alive(old) && (await isOurs(old, name))) {
                pid = old;
                return;
            }
            forgetPid();
        }
        if (await realRunning(platform)) return;
        try {
            const { exe, args } = prepare();
            const c = inFlatpak
                ? spawnProcess("flatpak-spawn", [
                      "--host",
                      "--watch-bus",
                      exe,
                      ...args,
                  ])
                : spawnProcess(exe, args);
            if (!c || !c.pid) throw new Error("could not start");
            child = c;
            pid = c.pid;
            error = null;
            if (persistent) fs.writeFileSync(pidFile, String(pid));
            c.once("exit", () => {
                if (child === c) {
                    child = null;
                    pid = null;
                    forgetPid();
                }
            });
            log("stand-in Discord process", pid);
        } catch (e) {
            error = String(e?.message || e);
        }
    }

    async function doStop() {
        const c = child;
        const p = pid ?? (persistent ? readPid() : null);
        child = null;
        pid = null;
        if (!persistent) {
            // Ending flatpak-spawn ends the host process it runs.
            try {
                c?.kill("SIGTERM");
            } catch {}
            return;
        }
        if (p === null) return;
        try {
            if (await isOurs(p, name)) process.kill(p);
        } catch {}
        forgetPid();
    }

    // Starts and stops run one after another so a quick off-on cannot cross.
    const queue = (fn) => (busy = busy.then(fn, fn));

    return {
        supported,
        start: () => queue(doStart),
        stop: () => queue(doStop),
        /** Whether Flatpak host access was granted (always true outside one). */
        setHostAccess: (allowed) => {
            hostAllowed = !inFlatpak || allowed === true;
        },
        status: () => ({
            supported,
            running: pid !== null,
            needsPermission: inFlatpak && !hostAllowed,
            error,
        }),
    };
}

module.exports = { createFakeDiscord, realDiscordRunning, fakeName };
