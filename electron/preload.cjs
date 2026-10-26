// Minimal renderer bridge. Two capabilities are exposed: "restore the window
// from the tray", which the incoming-call notification needs (window.focus()
// does not un-hide a hidden BrowserWindow), and the screen-share source
// picker, which Electron requires the main process to arbitrate.

const { contextBridge, ipcRenderer } = require("electron");

// Plugins' native code (pluginNative.cjs): main answers "plugin-native:open"
// with a MessagePort to the plugin's host. A port can't cross contextBridge,
// so it is posted to the page's window, tagged with the id the page asked
// with; src/lib/plugins/pluginNative.ts picks it up.
ipcRenderer.on("plugin-native:port", (e, id) => {
    if (typeof id !== "string" || !e.ports[0]) return;
    window.postMessage(`zam:plugin-native-port:${id}`, window.location.origin, [
        e.ports[0],
    ]);
});

// Screen-share audio (appAudio.cjs). A Windows capture comes with a
// MessagePort of PCM, which is posted to the window the same way, as
// "zam:share-audio-port:<request id>"; src/lib/desktopScreenShare.ts hands
// it to the page's AudioWorklet.
const shareAudioListeners = new Set();
ipcRenderer.on("share-audio:ready", (e, meta) => {
    if (!meta || typeof meta !== "object") return;
    const id = Number(meta.id);
    if (!Number.isFinite(id)) return;
    if (e.ports[0]) {
        window.postMessage(
            `zam:share-audio-port:${id}`,
            window.location.origin,
            [e.ports[0]],
        );
    }
    const info = {
        id,
        kind: String(meta.kind),
        label: typeof meta.label === "string" ? meta.label : undefined,
    };
    for (const cb of shareAudioListeners) cb(info);
});

contextBridge.exposeInMainWorld("desktop", {
    showWindow: () => ipcRenderer.send("show-window"),
    pluginNative: {
        platform: `${process.platform}-${process.arch}`,
        open: (req) => ipcRenderer.invoke("plugin-native:open", req),
        remove: (pluginId) =>
            ipcRenderer.invoke("plugin-native:remove", String(pluginId)),
    },
    sso: {
        // The local server caught an SSO redirect; `url` is its path + query.
        onCallback: (cb) => {
            const h = (_e, url) => cb(url);
            ipcRenderer.on("sso:callback", h);
            return () => ipcRenderer.removeListener("sso:callback", h);
        },
    },
    // Flatpak builds are updated by `flatpak update`, not electron-updater,
    // so they get no updater bridge (the renderer then treats them like web).
    updates: process.env.FLATPAK_ID
        ? undefined
        : {
              check: () => ipcRenderer.send("updates:check"),
              download: () => ipcRenderer.send("updates:download"),
              restartToInstall: () =>
                  ipcRenderer.send("updates:quit-and-install"),
              setAutoDownload: (enabled) =>
                  ipcRenderer.send("updates:set-auto", !!enabled),
              onStatus: (cb) => {
                  const h = (_e, s) => cb(s);
                  ipcRenderer.on("updates:status", h);
                  return () => ipcRenderer.removeListener("updates:status", h);
              },
          },
    screenShare: {
        // Main pushes the enumerated source list when getDisplayMedia() fires.
        onRequest: (cb) => {
            const h = (_e, req) => cb(req);
            ipcRenderer.on("screenshare:request", h);
            return () => ipcRenderer.removeListener("screenshare:request", h);
        },
        // Main gave up waiting (timeout) — close the picker.
        onCancel: (cb) => {
            const h = (_e, requestId) => cb(requestId);
            ipcRenderer.on("screenshare:cancel", h);
            return () => ipcRenderer.removeListener("screenshare:cancel", h);
        },
        // sourceId null = the user cancelled.
        // audio: the picker's audio choice (electron/shareAudio.cjs).
        respond: (requestId, sourceId, sourceName, audio) =>
            ipcRenderer.send("screenshare:respond", {
                requestId,
                sourceId,
                sourceName,
                audio,
            }),
        // How a share's audio was set up, after a pick (see above).
        onAudio: (cb) => {
            shareAudioListeners.add(cb);
            return () => shareAudioListeners.delete(cb);
        },
        stopAudio: () => ipcRenderer.send("share-audio:stop"),
    },
    notify: {
        flash: () => ipcRenderer.send("notify:flash"),
        show: (payload) => ipcRenderer.send("notify:show", payload),
        close: (id) => ipcRenderer.send("notify:close", id),
        onEvent: (cb) => {
            const h = (_e, ev) => cb(ev);
            ipcRenderer.on("notify:event", h);
            return () => ipcRenderer.removeListener("notify:event", h);
        },
    },
    tray: {
        setUnread: (unread) => ipcRenderer.send("tray:set-unread", !!unread),
        setMinimizeToClose: (enabled) =>
            ipcRenderer.send("tray:set-minimize-to-close", !!enabled),
    },
    // Settings > General > Network: Zam's proxy setting and call routing
    // (proxy.cjs). callTargets names the call servers about to be used so
    // they can bypass the proxy; resolves once the rules are in place.
    proxy: {
        info: () => ipcRenderer.invoke("proxy:info"),
        set: (prefs) => ipcRenderer.invoke("proxy:set", prefs),
        callTargets: (hosts) =>
            ipcRenderer.invoke(
                "proxy:call-targets",
                Array.isArray(hosts) ? hosts.map(String) : [],
            ),
    },
    // While a call is connected, main raises the OS priority of the
    // processes it runs through (callPriority.cjs).
    call: {
        setActive: (active) => ipcRenderer.send("call:set-active", !!active),
    },
    // Settings > Debug: Chromium's GPU report and the hardware acceleration
    // switch (applied on the next launch, hence relaunch).
    gpu: {
        info: () => ipcRenderer.invoke("gpu:info"),
        setHardwareAcceleration: (enabled) =>
            ipcRenderer.invoke("gpu:set-hardware-acceleration", !!enabled),
        setNvidiaEncode: (enabled) =>
            ipcRenderer.invoke("gpu:set-nvidia-encode", !!enabled),
        setVideoEncode: (enabled) =>
            ipcRenderer.invoke("gpu:set-video-encode", !!enabled),
        setNvidiaVideo: (mode) =>
            ipcRenderer.invoke("gpu:set-nvidia-video", String(mode)),
        relaunch: () => ipcRenderer.send("app:relaunch"),
    },
    // Voice keybinds while Zam isn't focused (globalHotkeys.cjs): the page
    // names the keys / mouse buttons it binds, main forwards only those (or
    // on Wayland binds the shortcuts through the desktop's portal).
    hotkeys: {
        watch: (codes, buttons, shortcuts) =>
            ipcRenderer.invoke("hotkeys:watch", { codes, buttons, shortcuts }),
        configure: () => ipcRenderer.invoke("hotkeys:configure"),
        requestPermission: () =>
            ipcRenderer.invoke("hotkeys:request-permission"),
        onInput: (cb) => {
            const h = (_e, ev) => cb(ev);
            ipcRenderer.on("hotkeys:input", h);
            return () => ipcRenderer.removeListener("hotkeys:input", h);
        },
        onStatus: (cb) => {
            const h = (_e, s) => cb(s);
            ipcRenderer.on("hotkeys:status", h);
            return () => ipcRenderer.removeListener("hotkeys:status", h);
        },
    },
    // Seconds since the last input anywhere on the computer, and whether the
    // screen is locked: auto-away for presence ($lib/stores/presence).
    idle: {
        get: () => ipcRenderer.invoke("idle:get"),
    },
    // The OS's General MIDI sound bank bytes, or null (see main.cjs).
    readSystemSoundBank: () => ipcRenderer.invoke("soundbank:system"),
    hasSystemSoundBank: () => ipcRenderer.invoke("soundbank:has-system"),
    // Shift+click on a download button: save straight to the Downloads folder.
    saveToDownloads: (name, data) =>
        ipcRenderer.invoke("save-to-downloads", name, data),
    contextMenu: {
        // Right-click "Save image as": main hands over the image's src URL;
        // the renderer fetches it with auth and saves it.
        onSaveImage: (cb) => {
            const h = (_e, url) => cb(url);
            ipcRenderer.on("context-menu:save-image", h);
            return () =>
                ipcRenderer.removeListener("context-menu:save-image", h);
        },
    },
});
