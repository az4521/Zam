// Minimal renderer bridge. Two capabilities are exposed: "restore the window
// from the tray", which the incoming-call notification needs (window.focus()
// does not un-hide a hidden BrowserWindow), and the screen-share source
// picker, which Electron requires the main process to arbitrate.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
    showWindow: () => ipcRenderer.send("show-window"),
    sso: {
        // The local server caught an SSO redirect; `url` is its path + query.
        onCallback: (cb) => {
            const h = (_e, url) => cb(url);
            ipcRenderer.on("sso:callback", h);
            return () => ipcRenderer.removeListener("sso:callback", h);
        },
    },
    updates: {
        check: () => ipcRenderer.send("updates:check"),
        download: () => ipcRenderer.send("updates:download"),
        restartToInstall: () => ipcRenderer.send("updates:quit-and-install"),
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
        respond: (requestId, sourceId, sourceName) =>
            ipcRenderer.send("screenshare:respond", {
                requestId,
                sourceId,
                sourceName,
            }),
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
    // The OS's General MIDI sound bank bytes, or null (see main.cjs).
    readSystemSoundBank: () => ipcRenderer.invoke("soundbank:system"),
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
