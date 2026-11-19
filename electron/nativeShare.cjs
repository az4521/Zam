// Native Windows screen share: runs native/share-capture's zam-share.exe for
// a granted window and hands its H.264 access units to the page over a
// MessagePort. The page's placeholder track carries these frames, so the
// capture no longer depends on Chromium's window capture under game load.
//
// Only window sources are served (`window:<HWND>:<n>`). Screens fall back to
// Chromium's capture, as does any failure: the helper must report "started"
// within START_TIMEOUT_MS or nothing is sent to the page.
//
// Protocol (fixed by the helper): stdout carries frames of `u32 LE length`,
// then `u8 type` and a body of `length - 1` bytes. Type 1 is an access unit,
// type 2 is JSON info. stdin takes JSON lines (key, bitrate, fps, stop).

const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { MessageChannelMain } = require("electron");
const { windowSourceHwnd } = require("./shareAudio.cjs");

const START_TIMEOUT_MS = 3000;
const KILL_AFTER_MS = 2000;
const MAX_FRAME_BYTES = 64 * 1024 * 1024;
const TYPE_AU = 1;
const TYPE_INFO = 2;
const AU_HEADER_BYTES = 13; // flags u8, ts i64, w u16, h u16

const DEFAULTS = {
    enabled: false,
    fps: 30,
    bitrate: 8000000,
    maxWidth: 1920,
    maxHeight: 1080,
    simulcast: false,
};

// Clamp a renderer-supplied number. Missing or non-numeric input gives the
// fallback (null means "no value", so the caller can skip the command).
function clampInt(value, min, max, fallback) {
    if (value === null || value === undefined || value === "") return fallback;
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
}

// Validated configuration. Everything from the renderer goes through here.
function sanitizeConfig(raw) {
    const o = raw && typeof raw === "object" ? raw : {};
    return {
        enabled: o.enabled === true,
        fps: clampInt(o.fps, 1, 240, DEFAULTS.fps),
        bitrate: clampInt(o.bitrate, 100000, 100000000, DEFAULTS.bitrate),
        maxWidth: clampInt(o.maxWidth, 160, 7680, DEFAULTS.maxWidth),
        maxHeight: clampInt(o.maxHeight, 160, 7680, DEFAULTS.maxHeight),
        simulcast: o.simulcast === true,
    };
}

// Command-line arguments for a window source, or null if the source is not a
// window this helper can capture.
function helperArgs(sourceId, cfg) {
    const hwnd = windowSourceHwnd(sourceId);
    if (!hwnd) return null;
    return [
        "--window",
        hwnd,
        "--fps",
        String(cfg.fps),
        "--bitrate",
        String(cfg.bitrate),
        "--max-width",
        String(cfg.maxWidth),
        "--max-height",
        String(cfg.maxHeight),
        "--cursor",
        "1",
        ...(cfg.simulcast ? ["--simulcast", "1"] : []),
    ];
}

function helperPath(app) {
    return app.isPackaged
        ? path.join(process.resourcesPath, "zam-share.exe")
        : path.join(
              app.getAppPath(),
              "native",
              "share-capture",
              "build",
              "zam-share.exe",
          );
}

function decodeFrame(type, body) {
    if (type === TYPE_AU) {
        if (body.length < AU_HEADER_BYTES) return null;
        return {
            type: "au",
            key: (body[0] & 1) !== 0,
            // Bit 1: the half-size simulcast layer (--simulcast).
            layer: (body[0] & 2) !== 0 ? 1 : 0,
            ts: Number(body.readBigInt64LE(1)),
            w: body.readUInt16LE(9),
            h: body.readUInt16LE(11),
            data: body.subarray(AU_HEADER_BYTES),
        };
    }
    if (type === TYPE_INFO) {
        try {
            const info = JSON.parse(body.toString("utf8"));
            if (info && typeof info === "object") {
                return { type: "info", info };
            }
        } catch {
            // A malformed info line is dropped, not fatal.
        }
    }
    return null;
}

// Incremental parser for the helper's stdout. push(chunk) returns the
// messages completed by that chunk. A bad length prefix yields one
// {type: "error"} and the parser stops (the caller tears the helper down).
function createFrameParser({ maxFrame = MAX_FRAME_BYTES } = {}) {
    let pending = null;
    let failed = false;
    return {
        push(chunk) {
            if (failed) return [];
            pending = pending ? Buffer.concat([pending, chunk]) : chunk;
            const out = [];
            let off = 0;
            while (pending.length - off >= 4) {
                const len = pending.readUInt32LE(off);
                if (len < 1 || len > maxFrame) {
                    failed = true;
                    pending = null;
                    out.push({
                        type: "error",
                        message: `bad frame length ${len}`,
                    });
                    return out;
                }
                if (pending.length - off - 4 < len) break;
                const type = pending[off + 4];
                const body = pending.subarray(off + 5, off + 4 + len);
                off += 4 + len;
                const msg = decodeFrame(type, body);
                if (msg) out.push(msg);
            }
            pending = off < pending.length ? pending.subarray(off) : null;
            return out;
        },
    };
}

function sendToHelper(proc, obj) {
    try {
        proc.stdin.write(`${JSON.stringify(obj)}\n`);
    } catch {
        // stdin already closed: the helper is going away anyway.
    }
}

// Polite stop (stdin "stop", then EOF), with a kill if it does not exit.
function endHelper(proc) {
    sendToHelper(proc, { cmd: "stop" });
    try {
        proc.stdin.end();
    } catch {}
    const timer = setTimeout(() => {
        if (proc.exitCode === null && proc.signalCode === null) proc.kill();
    }, KILL_AFTER_MS);
    timer.unref?.();
}

function killHelper(proc) {
    try {
        if (proc.exitCode === null && proc.signalCode === null) proc.kill();
    } catch {}
}

function createNativeShare(app) {
    let cfg = { ...DEFAULTS };
    let current = null;

    // Ends one session once: closes the page's port (with a final "ended"
    // when there is a reason), stops the helper and settles the start promise.
    function teardown(s, reason, how = "stop") {
        if (s.dead) return;
        s.dead = true;
        clearTimeout(s.timer);
        if (current === s) current = null;
        if (s.port) {
            if (reason) {
                try {
                    s.port.postMessage({ type: "ended", reason });
                } catch {}
            }
            try {
                s.port.close();
            } catch {}
            s.port = null;
        }
        if (s.proc) {
            if (how === "kill") killHelper(s.proc);
            else endHelper(s.proc);
        }
        s.settle(false);
    }

    function forwardAu(s, msg) {
        const ab = new ArrayBuffer(msg.data.length);
        new Uint8Array(ab).set(msg.data);
        try {
            // MessagePortMain's transfer list takes ports only, so the
            // ArrayBuffer is structured-cloned (one copy) rather than moved.
            s.port.postMessage({
                type: "au",
                key: msg.key,
                layer: msg.layer,
                ts: msg.ts,
                w: msg.w,
                h: msg.h,
                data: ab,
            });
        } catch (err) {
            console.error("native share: port send failed:", err);
            teardown(s, null, "kill");
        }
    }

    function onCommand(s, data) {
        if (s.dead || !data || typeof data !== "object") return;
        if (data.cmd === "key") {
            sendToHelper(s.proc, {
                cmd: "key",
                layer: data.layer === 1 ? 1 : 0,
            });
        } else if (data.cmd === "bitrate") {
            const bps = clampInt(data.bps, 100000, 100000000, null);
            const lowBps = clampInt(data.lowBps, 100000, 100000000, null);
            if (bps !== null)
                sendToHelper(s.proc, {
                    cmd: "bitrate",
                    bps,
                    ...(lowBps !== null ? { lowBps } : {}),
                });
        } else if (data.cmd === "fps") {
            const fps = clampInt(data.fps, 1, 240, null);
            if (fps !== null) sendToHelper(s.proc, { cmd: "fps", fps });
        } else if (data.cmd === "stop") {
            teardown(s, "stop");
        }
    }

    // The helper reported "started": create the port and hand port2 to the
    // page. Nothing is sent if that fails, so the page keeps Chromium's path.
    function openPort(s, info) {
        const { port1, port2 } = new MessageChannelMain();
        s.port = port1;
        port1.on("message", (e) => onCommand(s, e.data));
        port1.on("close", () => teardown(s, null));
        port1.start();
        try {
            s.webContents.postMessage(
                "native-share:port",
                {
                    requestId: s.requestId,
                    width: info.width,
                    height: info.height,
                    encoder: info.encoder,
                    hardware: info.hardware,
                },
                [port2],
            );
        } catch (err) {
            console.error("native share: port handoff failed:", err);
            teardown(s, null, "kill");
            return;
        }
        s.started = true;
        clearTimeout(s.timer);
        s.settle(true);
    }

    function onMessage(s, msg) {
        if (msg.type === "error") {
            console.error(`native share: ${msg.message}`);
            teardown(s, "error", "kill");
            return;
        }
        if (msg.type === "au") {
            if (s.started && s.port) forwardAu(s, msg);
            return;
        }
        if (msg.type !== "info") return;
        const info = msg.info;
        if (!s.started) {
            if (info.event === "started") openPort(s, info);
            else if (info.event === "error") {
                console.error(`native share: ${info.message}`);
                teardown(s, null, "kill");
            } else if (info.event === "ended") teardown(s, null, "kill");
            return;
        }
        if (s.dead) return;
        if (info.event === "ended") {
            teardown(
                s,
                typeof info.reason === "string" ? info.reason : "ended",
            );
        } else if (info.event === "error") {
            if (s.port) {
                try {
                    s.port.postMessage({ type: "info", info });
                } catch {}
            }
            teardown(s, "error");
        } else if (s.port) {
            try {
                s.port.postMessage({ type: "info", info });
            } catch {}
        }
    }

    function launch(exe, args, requestId, webContents) {
        return new Promise((resolve) => {
            let proc;
            try {
                proc = spawn(exe, args, {
                    stdio: ["pipe", "pipe", "pipe"],
                    windowsHide: true,
                });
            } catch (err) {
                console.error("native share: spawn failed:", err);
                resolve(false);
                return;
            }
            let settled = false;
            const s = {
                proc,
                port: null,
                timer: null,
                dead: false,
                started: false,
                requestId,
                webContents,
                settle: (ok) => {
                    if (settled) return;
                    settled = true;
                    resolve(ok);
                },
            };
            current = s;
            s.timer = setTimeout(() => {
                if (s.started) return;
                console.error("native share: helper did not start in time");
                teardown(s, null, "kill");
            }, START_TIMEOUT_MS);

            const parser = createFrameParser();
            proc.stdin.on("error", () => {});
            proc.stdout.on("data", (chunk) => {
                if (s.dead) return;
                for (const msg of parser.push(chunk)) {
                    if (s.dead) return;
                    onMessage(s, msg);
                }
            });
            proc.stderr.setEncoding("utf8");
            proc.stderr.on("data", (text) => {
                for (const line of text.split(/\r?\n/)) {
                    if (line.trim())
                        console.error(`native share helper: ${line}`);
                }
            });
            proc.on("error", (err) => {
                console.error("native share: helper failed:", err.message);
                teardown(s, null, "kill");
            });
            proc.on("exit", (code) => {
                if (s.dead) return;
                console.error(`native share: helper exited (${code})`);
                teardown(s, "exited");
            });
        });
    }

    return {
        configure(raw) {
            cfg = sanitizeConfig(raw);
        },

        // Starts the helper for a granted source. Resolves true once the page
        // has its port; false (and nothing sent) when native share does not
        // apply or fails. Never rejects.
        async maybeStart({ requestId, sourceId, webContents } = {}) {
            try {
                if (process.platform !== "win32" || !cfg.enabled) return false;
                if (!webContents) return false;
                const args = helperArgs(sourceId, cfg);
                if (!args) return false;
                const exe = helperPath(app);
                if (!fs.existsSync(exe)) return false;
                // One native share at a time: a new grant replaces the last.
                if (current) teardown(current, "replaced");
                return await launch(exe, args, requestId, webContents);
            } catch (err) {
                console.error("native share: start failed:", err);
                return false;
            }
        },

        stop() {
            try {
                if (current) teardown(current, "stop");
            } catch (err) {
                console.error("native share: stop failed:", err);
            }
        },
    };
}

module.exports = {
    createNativeShare,
    createFrameParser,
    helperArgs,
    sanitizeConfig,
    clampInt,
};
