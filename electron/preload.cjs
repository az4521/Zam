// Minimal renderer bridge. Two capabilities are exposed: "restore the window
// from the tray", which the incoming-call notification needs (window.focus()
// does not un-hide a hidden BrowserWindow), and the screen-share source
// picker, which Electron requires the main process to arbitrate.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
    showWindow: () => ipcRenderer.send("show-window"),
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
});
