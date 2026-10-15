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
// Wayland has no way for a client to see other clients' input, so there the
// renderer's bindings go to the xdg-desktop-portal GlobalShortcuts portal
// instead (portalShortcuts.cjs), which reports each action going down and up
// ({ kind: "action" }). The compositor picks the actual keys. Without the
// portal, Wayland sessions report "wayland" and Settings says so.

const path = require("path");
const {
    ipcMain,
    systemPreferences,
    shell,
    utilityProcess,
} = require("electron");
const { domCode } = require("./hotkeyCodes.cjs");
const { createPortalShortcuts } = require("./portalShortcuts.cjs");

const CODE = /^[A-Za-z0-9]{1,32}$/;
const MAX_CODES = 64;
// The actions the portal may bind (GLOBAL_ACTIONS in the renderer).
const PORTAL_ACTIONS = new Set([
    "pushToTalk",
    "pushToMute",
    "toggleMute",
    "toggleDeafen",
]);
const TRIGGER = /^[A-Za-z0-9_+]{0,64}$/;
// DOM MouseEvent.button numbers: middle, back (mouse 4), forward (mouse 5).
const WATCHABLE_BUTTONS = new Set([1, 3, 4]);

function onWaylandSession() {
    return (
        process.platform === "linux" &&
        (!!process.env.WAYLAND_DISPLAY ||
            process.env.XDG_SESSION_TYPE === "wayland")
    );
}

function registerGlobalHotkeys(getWindow) {
    /** The utility process running uiohook (hotkeyHook.cjs): native code
     *  that faults or hangs takes only that process down, not the app. */
    let child = null;
    let running = false;
    /** The hook process died on its own: don't relaunch it on every
     *  watch change (that loops a crash), only once the list has emptied. */
    let hookFailed = false;
    let watch = { codes: new Set(), buttons: new Set(), shortcuts: [] };
    /** { state: "off" | "active" | "wayland" | "permission" | "error",
     *    error?, backend?: "portal", shortcuts?, configurable? } */
    let status = { state: "off" };
    let portal = null;
    let portalVersion = 0;
    /** The shortcut list last bound (JSON): binding again may show the
     *  compositor's dialog, so only when it changed. */
    let portalBound = null;
    let portalQueue = Promise.resolve();

    function send(channel, payload) {
        const win = getWindow();
        if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
    }

    function setStatus(next) {
        if (JSON.stringify(next) === JSON.stringify(status)) return;
        status = next;
        send("hotkeys:status", status);
    }

    function onChildMessage(msg) {
        if (msg?.type === "key" || msg?.type === "mouse") {
            const { type, ...input } = msg;
            send("hotkeys:input", input);
        } else if (msg?.type === "error") {
            console.error("Global hotkeys: could not start:", msg.error);
            killChild();
            hookFailed = true;
            setStatus({ state: "error", error: String(msg.error) });
        }
    }

    function spawnChild() {
        if (child) return child;
        const proc = utilityProcess.fork(
            path.join(__dirname, "hotkeyHook.cjs"),
            [],
            {
                serviceName: "Zam input hook",
            },
        );
        proc.on("message", onChildMessage);
        proc.on("exit", (code) => {
            if (child !== proc) return;
            child = null;
            running = false;
            hookFailed = true;
            console.error("Global hotkeys: hook process exited:", code);
            setStatus({
                state: "error",
                error: `input hook process exited (${code})`,
            });
        });
        child = proc;
        return proc;
    }

    function killChild() {
        const proc = child;
        child = null;
        running = false;
        if (proc) proc.kill();
    }

    function stopHook() {
        killChild();
    }

    function portalClient() {
        if (portal) return portal;
        portal = createPortalShortcuts({
            // Inside Flatpak the portal knows us by the Flatpak's id.
            appId: process.env.FLATPAK_ID ? undefined : "moe.crafty.matrix",
            onAction(id, down) {
                if (PORTAL_ACTIONS.has(id))
                    send("hotkeys:input", { kind: "action", id, down });
            },
            onChanged(shortcuts) {
                if (status.backend === "portal" && status.state === "active")
                    setStatus({ ...status, shortcuts });
            },
            onError(err) {
                console.error("Global shortcuts portal:", err);
                portal = null;
                portalBound = null;
                setStatus({ state: "wayland" });
            },
        });
        return portal;
    }

    /** Wayland: bind the renderer's shortcuts through the portal. Reported
     *  even with nothing to bind, so Settings can say whether it's there. */
    async function applyPortal() {
        let client;
        try {
            client = portalClient();
            portalVersion = await client.connect();
        } catch (err) {
            console.error("Global shortcuts portal unavailable:", err);
            portal = null;
            setStatus({ state: "wayland" });
            return;
        }
        const key = JSON.stringify(watch.shortcuts);
        if (key === portalBound) return;
        portalBound = key;
        try {
            const assigned = await client.bind(watch.shortcuts);
            if (watch.shortcuts.length === 0)
                setStatus({ state: "off", backend: "portal" });
            else
                setStatus({
                    state: "active",
                    backend: "portal",
                    shortcuts: assigned,
                    configurable: portalVersion >= 2,
                });
        } catch (err) {
            console.error("Global shortcuts portal: bind failed:", err);
            portalBound = null;
            setStatus({
                state: "error",
                backend: "portal",
                error: String(err.message || err),
            });
        }
    }

    /** Start or stop the hook to match the watch list and the platform. */
    function apply() {
        if (onWaylandSession()) {
            portalQueue = portalQueue.then(applyPortal);
            return portalQueue;
        }
        if (watch.codes.size === 0 && watch.buttons.size === 0) {
            stopHook();
            hookFailed = false;
            setStatus({ state: "off" });
            return;
        }
        if (
            process.platform === "darwin" &&
            !systemPreferences.isTrustedAccessibilityClient(false)
        ) {
            stopHook();
            setStatus({ state: "permission" });
            return;
        }
        if (hookFailed) return;
        try {
            const proc = spawnChild();
            proc.postMessage({
                type: "watch",
                codes: [...watch.codes],
                buttons: [...watch.buttons],
            });
            if (!running) {
                proc.postMessage({ type: "start" });
                running = true;
            }
            setStatus({ state: "active" });
        } catch (err) {
            console.error("Global hotkeys: could not start:", err);
            killChild();
            hookFailed = true;
            setStatus({
                state: "error",
                error: String((err && (err.code || err.message)) || err),
            });
        }
    }

    ipcMain.handle("hotkeys:watch", async (e, req) => {
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
        const shortcuts = Array.isArray(req?.shortcuts)
            ? req.shortcuts
                  .filter(
                      (s) =>
                          PORTAL_ACTIONS.has(s?.id) &&
                          typeof s.description === "string" &&
                          typeof s.trigger === "string" &&
                          TRIGGER.test(s.trigger),
                  )
                  .map((s) => ({
                      id: s.id,
                      description: s.description.slice(0, 200),
                      trigger: s.trigger,
                  }))
            : [];
        watch = {
            codes: new Set(codes),
            buttons: new Set(buttons),
            shortcuts,
        };
        await apply();
        return status;
    });

    // Wayland, portal version 2+: the desktop's own editor for our shortcuts.
    ipcMain.handle("hotkeys:configure", async () => {
        try {
            await portal?.configure();
        } catch (err) {
            console.error("Global shortcuts portal: configure failed:", err);
        }
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
        stop() {
            stopHook();
            portal?.close();
            portal = null;
        },
    };
}

module.exports = { registerGlobalHotkeys, domCode };
