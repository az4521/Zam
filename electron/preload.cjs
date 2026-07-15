// Minimal renderer bridge. The only capability exposed is "restore the window
// from the tray", which the incoming-call notification needs: window.focus()
// does not un-hide a hidden BrowserWindow.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
    showWindow: () => ipcRenderer.send("show-window"),
});
