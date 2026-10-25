// Per-application screen-share audio (the picker's audio choice, see
// shareAudio.cjs for what each choice means).
//
// Electron alone can only grant full system loopback, on Windows only, and
// that includes Zam's own call playback, so the others hear themselves.
// Instead:
//  - Windows 10 2004+: native/app-audio's helper captures one process tree,
//    or everything except Zam's, with WASAPI process loopback. Its PCM goes
//    over a MessagePort straight to an AudioWorklet in the page
//    (src/lib/audio/pcmStream.worklet.js), which becomes the share's audio
//    track.
//  - Linux with PipeWire: @vencord/venmic (the library Vesktop uses) links
//    the chosen applications into a virtual microphone, "vencord-screen-
//    share", which the page opens with getUserMedia. The Flatpak needs
//    --filesystem=xdg-run/pipewire-0 for it.
//  - Anything else (macOS, older Windows, Linux without PipeWire) gets no
//    backend; main.cjs falls back to what Electron offers.
//
// One capture runs at a time. It stops when the page closes its port or
// asks (share-audio:stop), when the page goes away, and on quit.

const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn, execFile } = require("child_process");
const { MessageChannelMain } = require("electron");
const {
    windowSourceHwnd,
    groupPipewireApps,
    parseWindowsSessions,
} = require("./shareAudio.cjs");

const LIST_TIMEOUT_MS = 3000;
const START_TIMEOUT_MS = 5000;
const FRAME_BYTES = 8; // float32 stereo

function windowsBuild() {
    const parts = os.release().split(".");
    return Number(parts[2]) || 0;
}

function createWindowsBackend(app) {
    const helper = app.isPackaged
        ? path.join(process.resourcesPath, "zam-app-audio.exe")
        : path.join(
              app.getAppPath(),
              "native",
              "app-audio",
              "build",
              "zam-app-audio.exe",
          );
    // AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK arrived in build 19041.
    if (windowsBuild() < 19041 || !fs.existsSync(helper)) return null;

    let proc = null;
    let port = null;

    function stop() {
        if (port) {
            try {
                port.close();
            } catch {}
            port = null;
        }
        if (proc) {
            try {
                proc.stdin.end();
            } catch {}
            const p = proc;
            proc = null;
            // Closing stdin is the polite stop; make sure it happens.
            setTimeout(() => {
                if (p.exitCode === null) p.kill();
            }, 1000).unref?.();
        }
    }

    return {
        name: "wasapi",
        // Zam's audio comes from its own child processes (the audio
        // service), so excluding the main process's tree drops all of it.
        systemTarget: { mode: "exclude", pid: process.pid },
        windowTarget(sourceId) {
            const hwnd = windowSourceHwnd(sourceId);
            return hwnd ? { mode: "hwnd", hwnd } : null;
        },
        listApps() {
            return new Promise((resolve) => {
                execFile(
                    helper,
                    ["list", "--exclude-tree", String(process.pid)],
                    { timeout: LIST_TIMEOUT_MS, windowsHide: true },
                    (err, stdout) => {
                        if (err) {
                            console.error(
                                "app audio: list failed:",
                                err.message,
                            );
                            resolve([]);
                            return;
                        }
                        resolve(parseWindowsSessions(stdout));
                    },
                );
            });
        },
        start(target, webContents, shareId) {
            stop();
            const args =
                target.mode === "exclude"
                    ? ["capture", "--exclude", String(target.pid)]
                    : target.mode === "include"
                      ? ["capture", "--include", String(target.pid)]
                      : target.mode === "hwnd"
                        ? ["capture", "--hwnd", String(target.hwnd)]
                        : null;
            if (!args) return Promise.resolve(false);
            const child = spawn(helper, args, {
                stdio: ["pipe", "pipe", "pipe"],
                windowsHide: true,
            });
            proc = child;
            return new Promise((resolve) => {
                let settled = false;
                let stderr = "";
                const settle = (ok) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    if (!ok && proc === child) stop();
                    resolve(ok);
                };
                const timer = setTimeout(() => {
                    console.error("app audio: helper did not start in time");
                    settle(false);
                }, START_TIMEOUT_MS);
                child.on("error", (err) => {
                    console.error("app audio: helper failed:", err.message);
                    settle(false);
                });
                child.on("exit", (code) => {
                    if (proc === child) stop();
                    if (!settled) {
                        console.error(
                            `app audio: helper exited (${code}): ${stderr.trim()}`,
                        );
                    }
                    settle(false);
                });
                child.stdin.on("error", () => {});
                child.stderr.setEncoding("utf8");
                child.stderr.on("data", (text) => {
                    if (settled) return;
                    stderr += text;
                    if (/^ready$/m.test(stderr)) {
                        const { port1, port2 } = new MessageChannelMain();
                        port = port1;
                        // The page closing its end (share stopped, reload)
                        // ends the capture.
                        port1.on("close", () => {
                            if (port === port1) stop();
                        });
                        port1.start();
                        try {
                            webContents.postMessage(
                                "share-audio:ready",
                                { id: shareId, kind: "pcm" },
                                [port2],
                            );
                        } catch (err) {
                            console.error(
                                "app audio: port handoff failed:",
                                err,
                            );
                            settle(false);
                            return;
                        }
                        settle(true);
                    } else if (/^error:/m.test(stderr)) {
                        console.error(`app audio: ${stderr.trim()}`);
                        settle(false);
                    }
                });
                let rest = null;
                child.stdout.on("data", (chunk) => {
                    if (!port || proc !== child) return;
                    let buf = rest ? Buffer.concat([rest, chunk]) : chunk;
                    const usable = buf.length - (buf.length % FRAME_BYTES);
                    rest = usable < buf.length ? buf.subarray(usable) : null;
                    if (!usable) return;
                    // A fresh, 4-aligned ArrayBuffer for the worklet's
                    // Float32Array view.
                    const out = new ArrayBuffer(usable);
                    new Uint8Array(out).set(buf.subarray(0, usable));
                    try {
                        port.postMessage(out);
                    } catch {
                        stop();
                    }
                });
            });
        },
        stop,
    };
}

function createPipewireBackend(app) {
    let PatchBay;
    try {
        ({ PatchBay } = require("@vencord/venmic"));
    } catch (err) {
        console.log("app audio: venmic unavailable:", err.message);
        return null;
    }
    try {
        if (!PatchBay.hasPipeWire()) return null;
    } catch (err) {
        console.log("app audio: PipeWire check failed:", err.message);
        return null;
    }
    let patchbay = null;
    let linked = false;
    const bay = () => (patchbay ??= new PatchBay());

    // Zam's own audio. Chromium's PulseAudio streams carry the pid of the
    // audio service process and the app's name.
    const selfPids = () =>
        new Set([
            String(process.pid),
            ...app.getAppMetrics().map((m) => String(m.pid)),
        ]);
    const selfNames = () => new Set([app.getName()]);
    const selfExclusions = () => [
        ...[...selfPids()].map((pid) => ({ "application.process.id": pid })),
        ...[...selfNames()].map((name) => ({ "application.name": name })),
        // Recording streams (someone's microphone input) are not playback.
        { "media.class": "Stream/Input/Audio" },
    ];

    function stop() {
        if (!linked) return;
        linked = false;
        try {
            bay().unlink();
        } catch (err) {
            console.error("app audio: unlink failed:", err.message);
        }
    }

    return {
        name: "pipewire",
        systemTarget: { mode: "pipewire", include: [] },
        // X11 window ids don't lead to PipeWire nodes, and on Wayland the
        // portal picks the window; the app list covers it.
        windowTarget: () => null,
        async listApps() {
            try {
                return groupPipewireApps(
                    bay().list(["application.name"]),
                    selfPids(),
                    selfNames(),
                );
            } catch (err) {
                console.error("app audio: list failed:", err.message);
                return [];
            }
        },
        async start(target, webContents, shareId) {
            stop();
            if (target.mode !== "pipewire") return false;
            const include = Array.isArray(target.include) ? target.include : [];
            // A chosen app is captured wherever it plays (venmic otherwise
            // skips streams that don't go to a speaker). Everything-but-Zam
            // keeps to the default speakers, so audio routed through a
            // virtual device (an equalizer) isn't picked up twice.
            const data = include.length
                ? {
                      include,
                      exclude: selfExclusions(),
                      ignore_devices: true,
                      only_speakers: false,
                      only_default_speakers: false,
                  }
                : {
                      include: [],
                      exclude: selfExclusions(),
                      ignore_devices: true,
                      only_speakers: true,
                      only_default_speakers: true,
                  };
            try {
                linked = !!bay().link(data);
            } catch (err) {
                console.error("app audio: link failed:", err.message);
                linked = false;
            }
            if (!linked) return false;
            try {
                webContents.send("share-audio:ready", {
                    id: shareId,
                    kind: "device",
                    label: "vencord-screen-share",
                });
            } catch (err) {
                console.error("app audio: notify failed:", err);
                stop();
                return false;
            }
            return true;
        },
        stop,
    };
}

function createAppAudio(app) {
    let backend;
    const get = () => {
        if (backend === undefined) {
            backend = null;
            try {
                if (process.platform === "win32") {
                    backend = createWindowsBackend(app);
                } else if (process.platform === "linux") {
                    backend = createPipewireBackend(app);
                }
            } catch (err) {
                console.error("app audio: backend setup failed:", err);
                backend = null;
            }
        }
        return backend;
    };
    return {
        get backend() {
            return get();
        },
        stop() {
            try {
                backend?.stop();
            } catch (err) {
                console.error("app audio: stop failed:", err);
            }
        },
    };
}

module.exports = { createAppAudio };
