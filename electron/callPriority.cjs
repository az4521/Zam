// Raise the OS scheduling priority of the processes a call runs through while
// one is connected, so heavy system load (a game, a build) takes CPU from
// something else first. Chromium already runs its audio output thread at a
// real-time priority, but capture processing (the mic chain's AudioWorklet in
// the renderer), WebRTC's encode/network threads and video encode in the GPU
// process all run at normal priority.
//
// Windows: ABOVE_NORMAL priority class, no rights needed. Linux/macOS: a
// negative nice value, which an unprivileged process isn't allowed (EACCES);
// that is expected, and every thread of those processes is raised one by one
// through the xdg-desktop-portal Realtime portal instead, which works from
// inside the Flatpak (portalRealtime.cjs). (setpriority on a pid only reaches
// that process's main thread on Linux, never the AudioWorklet's.) Processes
// are put back when the call ends.
const fs = require("fs");
const os = require("os");

const RAISED = os.constants.priority.PRIORITY_ABOVE_NORMAL;

// Utility processes worth raising, by Chromium service name.
const SERVICES = new Set([
    "audio.mojom.AudioService",
    "network.mojom.NetworkService",
]);

function callProcessPids(app, webContents) {
    const pids = new Set();
    const renderer = webContents?.getOSProcessId?.();
    if (renderer) pids.add(renderer);
    for (const m of app.getAppMetrics()) {
        if (
            m.type === "GPU" ||
            (m.type === "Utility" && SERVICES.has(m.serviceName))
        )
            pids.add(m.pid);
    }
    return pids;
}

const THREAD_SCAN_MS = 3000;

/** Every thread of `pid` (Linux only). Not picked by name: the one that
 *  matters is the AudioWorklet's (the mic chain's noise suppression), and
 *  Chromium's name for it isn't something to guess at. */
function processThreads(pid, procRoot = "/proc") {
    const found = [];
    let tids = [];
    try {
        tids = fs.readdirSync(`${procRoot}/${pid}/task`);
    } catch {
        return found;
    }
    for (const t of tids) {
        try {
            const name = fs
                .readFileSync(`${procRoot}/${pid}/task/${t}/comm`, "utf8")
                .trim();
            found.push({ pid, tid: Number(t), name });
        } catch {
            /* thread gone */
        }
    }
    return found;
}

function createCallPriority(app, { boostThreads, procRoot } = {}) {
    // pid -> priority it had before we raised it.
    const raised = new Map();
    let warned = false;
    // A whole process can't be raised (Linux without CAP_SYS_NICE, which is
    // always the case in the Flatpak): raise its threads through the
    // Realtime portal instead.
    let threadsNeeded = false;
    let portalWorks = true;
    const boosted = new Set(); // "pid:tid"
    let scanTimer = null;
    let target = null;

    function raise(webContents) {
        for (const pid of callProcessPids(app, webContents)) {
            if (raised.has(pid)) continue;
            try {
                const before = os.getPriority(pid);
                if (before <= RAISED) continue; // already at least as high
                os.setPriority(pid, RAISED);
                raised.set(pid, before);
            } catch (err) {
                threadsNeeded = true;
                if (!warned) {
                    warned = true;
                    console.log(
                        `Call priority not raised (${err.code || err.message}); trying its threads`,
                    );
                }
            }
        }
    }

    // The worklet thread only exists once the mic chain has loaded its
    // module, after the call connects, so keep looking for new threads.
    async function scanThreads() {
        if (!threadsNeeded || !portalWorks || !target) return;
        const fresh = [];
        for (const pid of callProcessPids(app, target))
            for (const t of processThreads(pid, procRoot))
                if (!boosted.has(`${t.pid}:${t.tid}`)) fresh.push(t);
        if (!fresh.length) return;
        for (const t of fresh) boosted.add(`${t.pid}:${t.tid}`);
        try {
            const res = await (
                boostThreads ||
                require("./portalRealtime.cjs").makeThreadsHighPriority
            )(fresh);
            const names = new Map(fresh.map((t) => [t.tid, t.name]));
            console.log(
                `Call priority: ${res.ok.length} threads at nice ${res.niceLevel}, ${res.failed.length} refused`,
            );
            for (const f of res.failed.slice(0, 5))
                console.log(
                    `Call priority: ${names.get(f.tid)} (${f.tid}) refused: ${f.error}`,
                );
        } catch (err) {
            portalWorks = false;
            console.log(`Call priority: no Realtime portal (${err.message})`);
        }
    }

    function startScanning(webContents) {
        target = webContents;
        if (scanTimer || !threadsNeeded || process.platform !== "linux") return;
        void scanThreads();
        scanTimer = setInterval(() => void scanThreads(), THREAD_SCAN_MS);
        scanTimer.unref?.();
    }

    function restore() {
        clearInterval(scanTimer);
        scanTimer = null;
        target = null;
        // Threads keep their level: a Realtime portal grant can't be taken
        // back the way a process's can, and they stop with the call anyway.
        boosted.clear();
        threadsNeeded = false;
        portalWorks = true;
        for (const [pid, before] of raised) {
            try {
                os.setPriority(pid, before);
            } catch {
                /* process gone */
            }
        }
        raised.clear();
    }

    return {
        set(active, webContents) {
            if (active) {
                raise(webContents);
                startScanning(webContents);
            } else restore();
        },
        restore,
    };
}

module.exports = { createCallPriority, processThreads };
