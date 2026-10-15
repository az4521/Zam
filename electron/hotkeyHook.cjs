// The passive input hook (uiohook-napi) in a process of its own, forked by
// globalHotkeys.cjs. The hook is native code (XRecord on X11, a low-level hook
// on Windows, a CGEventTap on macOS); when it faults or hangs, only this
// process goes, not the app, and the app reports "error" in Settings instead
// of dying on every launch.
//
// Parent -> here: { type: "watch", codes, buttons } | { type: "start" } |
// { type: "stop" }. Here -> parent: { type: "started" | "stopped" } |
// { type: "error", error } | { type: "key" | "mouse", ... } (the same
// payloads the renderer gets as "hotkeys:input").

const { domCode } = require("./hotkeyCodes.cjs");

const DOM_BUTTON = { 3: 1, 4: 3, 5: 4 };

let hook = null;
let codeOf = null;
let running = false;
let codes = new Set();
let buttons = new Set();

const post = (msg) => process.parentPort.postMessage(msg);

function onKey(e, down) {
    const code = codeOf.get(e.keycode);
    if (!code || !codes.has(code)) return;
    post({
        type: "key",
        kind: "key",
        code,
        down,
        ctrl: !!e.ctrlKey,
        shift: !!e.shiftKey,
        alt: !!e.altKey,
        meta: !!e.metaKey,
    });
}

function onMouse(e, down) {
    const button = DOM_BUTTON[e.button];
    if (button === undefined || !buttons.has(button)) return;
    post({ type: "mouse", kind: "mouse", button, down });
}

function load() {
    if (hook) return hook;
    const { uIOhook, UiohookKey } = require("uiohook-napi");
    codeOf = new Map(
        Object.entries(UiohookKey).map(([name, id]) => [id, domCode(name)]),
    );
    uIOhook.on("keydown", (e) => onKey(e, true));
    uIOhook.on("keyup", (e) => onKey(e, false));
    uIOhook.on("mousedown", (e) => onMouse(e, true));
    uIOhook.on("mouseup", (e) => onMouse(e, false));
    hook = uIOhook;
    return hook;
}

process.parentPort.on("message", ({ data }) => {
    try {
        if (data.type === "watch") {
            codes = new Set(data.codes);
            buttons = new Set(data.buttons);
        } else if (data.type === "start") {
            if (!running) {
                load().start();
                running = true;
            }
            post({ type: "started" });
        } else if (data.type === "stop") {
            if (running) {
                running = false;
                hook.stop();
            }
            post({ type: "stopped" });
        }
    } catch (err) {
        post({
            type: "error",
            error: String((err && (err.code || err.message)) || err),
        });
    }
});
