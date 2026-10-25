// Raise the OS scheduling priority of the processes a call runs through while
// one is connected, so heavy system load (a game, a build) takes CPU from
// something else first. Chromium already runs its audio output thread at a
// real-time priority, but capture processing (the mic chain's AudioWorklet in
// the renderer), WebRTC's encode/network threads and video encode in the GPU
// process all run at normal priority.
//
// Windows: ABOVE_NORMAL priority class, no rights needed. Linux/macOS: a
// negative nice value, which an unprivileged process isn't allowed (EACCES);
// that is expected and ignored, the call just runs as before. Everything is
// put back when the call ends.
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

function createCallPriority(app) {
    // pid -> priority it had before we raised it.
    const raised = new Map();
    let warned = false;

    function raise(webContents) {
        for (const pid of callProcessPids(app, webContents)) {
            if (raised.has(pid)) continue;
            try {
                const before = os.getPriority(pid);
                if (before <= RAISED) continue; // already at least as high
                os.setPriority(pid, RAISED);
                raised.set(pid, before);
            } catch (err) {
                if (!warned) {
                    warned = true;
                    console.log(
                        `Call priority not raised (${err.code || err.message}); needs CAP_SYS_NICE on Linux`,
                    );
                }
            }
        }
    }

    function restore() {
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
            if (active) raise(webContents);
            else restore();
        },
        restore,
    };
}

module.exports = { createCallPriority };
