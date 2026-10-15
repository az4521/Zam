// Voice keybinds while Zam isn't focused (Settings > Keybinds, "Work when Zam
// isn't focused"): push to talk / push to mute need key-down AND key-up, which
// Electron's globalShortcut can't give (it reports presses only and takes the
// key away from the focused app). uiohook-napi is a passive input hook: a
// low-level hook on Windows, a CGEventTap on macOS (needs the Accessibility
// permission) and XRecord on X11. It sees keys without consuming them.
//
// The renderer tells us which keys and mouse buttons its voice bindings use
// ("hotkeys:watch"); only those are forwarded ("hotkeys:input"), so the page
// never receives anything else typed into other apps. The hook only runs
// while that list is non-empty, and the native module is loaded on first use,
// so a build where it can't load just reports "error" in Settings.
//
// uiohook-napi ships N-API prebuilds (prebuilds/<platform>-<arch>) for every
// electron-builder target, Linux x64 for the Flatpak included, and N-API
// binaries load in Electron as they are. package.json sets npmRebuild: false
// because electron-builder's rebuild doesn't recognise those file names and
// would compile from source (X11 headers on the Linux runner) instead.
//
// Wayland has no way for a client to see other clients' input; the
// xdg-desktop-portal GlobalShortcuts portal could be used there instead, but
// isn't yet, so Wayland sessions report "wayland" and Settings says so.

const { ipcMain, systemPreferences, shell } = require("electron");

const CODE = /^[A-Za-z0-9]{1,32}$/;
const MAX_CODES = 64;
// DOM MouseEvent.button numbers: middle, back (mouse 4), forward (mouse 5).
const WATCHABLE_BUTTONS = new Set([1, 3, 4]);
// uiohook's button numbers -> DOM's.
const DOM_BUTTON = { 3: 1, 4: 3, 5: 4 };

// uiohook's numpad keys with Num Lock off are their own keycodes; the DOM
// still calls them by the digit's code.
const NUMPAD_NAV = {
    NumpadInsert: "Numpad0",
    NumpadEnd: "Numpad1",
    NumpadArrowDown: "Numpad2",
    NumpadPageDown: "Numpad3",
    NumpadArrowLeft: "Numpad4",
    NumpadArrowRight: "Numpad6",
    NumpadHome: "Numpad7",
    NumpadArrowUp: "Numpad8",
    NumpadPageUp: "Numpad9",
    NumpadDelete: "NumpadDecimal",
};
const MODIFIER_CODES = {
    Ctrl: "ControlLeft",
    CtrlRight: "ControlRight",
    Alt: "AltLeft",
    Shift: "ShiftLeft",
    Meta: "MetaLeft",
};

/** KeyboardEvent.code for a UiohookKey name (the rest are already spelled
 *  the DOM's way: "F1", "Backquote", "ArrowUp", "ShiftRight"...). */
function domCode(name) {
    if (/^[A-Z]$/.test(name)) return `Key${name}`;
    if (/^\d$/.test(name)) return `Digit${name}`;
    return MODIFIER_CODES[name] || NUMPAD_NAV[name] || name;
}

function onWaylandSession() {
    return (
        process.platform === "linux" &&
        (!!process.env.WAYLAND_DISPLAY ||
            process.env.XDG_SESSION_TYPE === "wayland")
    );
}

function registerGlobalHotkeys(getWindow) {
    let hook = null;
    /** uiohook keycode -> DOM code. */
    let codeOf = null;
    let running = false;
    let watch = { codes: new Set(), buttons: new Set() };
    /** { state: "off" | "active" | "wayland" | "permission" | "error", error? } */
    let status = { state: "off" };

    function send(channel, payload) {
        const win = getWindow();
        if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
    }

    function setStatus(next) {
        if (next.state === status.state && next.error === status.error) return;
        status = next;
        send("hotkeys:status", status);
    }

    function onKey(e, down) {
        const code = codeOf.get(e.keycode);
        if (!code || !watch.codes.has(code)) return;
        send("hotkeys:input", {
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
        if (button === undefined || !watch.buttons.has(button)) return;
        send("hotkeys:input", { kind: "mouse", button, down });
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

    function stop() {
        if (!running) return;
        running = false;
        try {
            hook.stop();
        } catch (err) {
            console.error("Global hotkeys: stop failed:", err);
        }
    }

    /** Start or stop the hook to match the watch list and the platform. */
    function apply() {
        // Reported even with nothing to watch, so Settings can say so
        // before the user turns the option on.
        if (onWaylandSession()) {
            setStatus({ state: "wayland" });
            return;
        }
        if (watch.codes.size === 0 && watch.buttons.size === 0) {
            stop();
            setStatus({ state: "off" });
            return;
        }
        if (
            process.platform === "darwin" &&
            !systemPreferences.isTrustedAccessibilityClient(false)
        ) {
            stop();
            setStatus({ state: "permission" });
            return;
        }
        if (running) {
            setStatus({ state: "active" });
            return;
        }
        try {
            load().start();
            running = true;
            setStatus({ state: "active" });
        } catch (err) {
            console.error("Global hotkeys: could not start:", err);
            setStatus({
                state: "error",
                error: String((err && (err.code || err.message)) || err),
            });
        }
    }

    ipcMain.handle("hotkeys:watch", (e, req) => {
        const win = getWindow();
        if (!win || e.sender !== win.webContents) return status;
        const codes = Array.isArray(req?.codes)
            ? req.codes
                  .filter((c) => typeof c === "string" && CODE.test(c))
                  .slice(0, MAX_CODES)
            : [];
        const buttons = Array.isArray(req?.buttons)
            ? req.buttons.filter((b) => WATCHABLE_BUTTONS.has(b))
            : [];
        watch = { codes: new Set(codes), buttons: new Set(buttons) };
        apply();
        return status;
    });

    // macOS: ask for Accessibility (the system shows its own prompt the
    // first time) and open the pane where the user switches Zam on.
    ipcMain.handle("hotkeys:request-permission", () => {
        if (process.platform === "darwin") {
            if (!systemPreferences.isTrustedAccessibilityClient(true)) {
                void shell.openExternal(
                    "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
                );
            }
            apply();
        }
        return status;
    });

    return {
        /** The window came back to the front: the user may have just
         *  granted the permission in System Settings. */
        recheck() {
            if (status.state === "permission") apply();
        },
        stop,
    };
}

module.exports = { registerGlobalHotkeys, domCode };
