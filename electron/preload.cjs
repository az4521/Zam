// Minimal renderer bridge. The only capability exposed is "restore the window
// from the tray", which the incoming-call notification needs: window.focus()
// does not un-hide a hidden BrowserWindow.

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
});
