// Electron desktop wrapper for the (SvelteKit, static) Matrix client.
//
// The built site lives in ../build. We serve it over a localhost HTTP server
// rather than file:// so that absolute asset paths (/_app/…), client-side
// routing, and the media-auth service worker (which needs a secure context —
// 127.0.0.1 qualifies) all work exactly as in a normal web deployment.
//
// Closing the window does NOT quit the app — it hides to the system tray and
// keeps running, with a tray icon to restore or quit.

const {
    app,
    BrowserWindow,
    Tray,
    Menu,
    nativeImage,
    shell,
    ipcMain,
} = require("electron");
const { autoUpdater } = require("electron-updater");
const http = require("http");
const fs = require("fs");
const path = require("path");

const BUILD_DIR = path.join(__dirname, "..", "build");
const ICON_PATH = path.join(BUILD_DIR, "favicon.png");

let mainWindow = null;
let tray = null;
let isQuitting = false;

const MIME = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".wasm": "application/wasm",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".map": "application/json",
    ".txt": "text/plain",
};

// Minimal static server for ../build with SPA fallback to index.html.
function startServer() {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
            let filePath = path.normalize(path.join(BUILD_DIR, urlPath));
            // Guard against path traversal outside BUILD_DIR.
            if (!filePath.startsWith(BUILD_DIR)) {
                res.writeHead(403);
                res.end();
                return;
            }
            let stat = null;
            try {
                stat = fs.statSync(filePath);
            } catch {
                /* not found */
            }
            if (stat && stat.isDirectory()) {
                filePath = path.join(filePath, "index.html");
                stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
            }
            if (!stat) {
                // SPA fallback — the static adapter writes the fallback to index.html.
                filePath = path.join(BUILD_DIR, "index.html");
            }
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(404);
                    res.end("Not found");
                    return;
                }
                const ext = path.extname(filePath).toLowerCase();
                res.writeHead(200, {
                    "Content-Type": MIME[ext] || "application/octet-stream",
                });
                res.end(data);
            });
        });
        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address();
            resolve(`http://127.0.0.1:${port}`);
        });
    });
}

function showWindow() {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
}

// The renderer asks for this when a call notification is clicked while the
// window is hidden in the tray.
ipcMain.on("show-window", showWindow);

// --- Auto-updater (packaged desktop app only) -----------------------------
//
// electron-updater is the single authority for check → download → install.
// It is a complete no-op in dev (`app.isPackaged` is false) — every entry
// point below returns early so running unpackaged never touches the updater
// nor throws. The renderer drives it via `window.desktop.updates.*` and
// observes streamed `updates:status` events shaped
// `{ phase, percent?, version?, message? }`.

// Post a status object to the current window (reassigned by createWindow).
function sendUpdateStatus(payload) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("updates:status", payload);
    }
}

// Best-effort classification: environments where updates simply can't run
// (dev, portable/unsigned, missing app-update.yml) surface as "unsupported"
// so the UI can hide the control rather than nag with an error.
function mapUpdateError(err) {
    const message = err?.message ?? String(err);
    if (
        /not supported|no such file|ENOENT|app-update\.yml|dev/i.test(message)
    ) {
        return { phase: "unsupported", message };
    }
    return { phase: "error", message };
}

// Kick off a check without ever letting a throw escape (sync throw or
// rejected promise both become an error/unsupported status).
function runUpdateCheck() {
    if (!app.isPackaged) return;
    try {
        const p = autoUpdater.checkForUpdates();
        if (p && typeof p.catch === "function") {
            p.catch((err) => sendUpdateStatus(mapUpdateError(err)));
        }
    } catch (err) {
        sendUpdateStatus(mapUpdateError(err));
    }
}

// Wire the updater once, from whenReady (NOT createWindow, which re-runs on
// `activate` and would double-register these listeners).
function setupAutoUpdater() {
    if (!app.isPackaged) return;

    autoUpdater.autoInstallOnAppQuit = true;
    // Fail-safe default: stay OFF until the renderer seeds the persisted preference at boot (see app shell onMount). Prevents a forced silent download when the user has turned auto-updates OFF but hasn't opened Settings before the launch check.
    autoUpdater.autoDownload = false;

    autoUpdater.on("checking-for-update", () => {
        sendUpdateStatus({ phase: "checking" });
    });
    autoUpdater.on("update-available", (info) => {
        sendUpdateStatus({ phase: "available", version: info?.version });
    });
    autoUpdater.on("update-not-available", (info) => {
        sendUpdateStatus({ phase: "up-to-date", version: info?.version });
    });
    autoUpdater.on("download-progress", (p) => {
        sendUpdateStatus({ phase: "downloading", percent: p?.percent });
    });
    autoUpdater.on("update-downloaded", (info) => {
        sendUpdateStatus({ phase: "downloaded", version: info?.version });
    });
    autoUpdater.on("error", (err) => {
        sendUpdateStatus(mapUpdateError(err));
    });

    // First check ~10s after launch so it never blocks or races startup.
    setTimeout(runUpdateCheck, 10000);
}

// Renderer → main. Every handler is inert in dev (guarded on app.isPackaged).
ipcMain.on("updates:check", runUpdateCheck);

ipcMain.on("updates:download", () => {
    if (!app.isPackaged) return;
    try {
        const p = autoUpdater.downloadUpdate();
        if (p && typeof p.catch === "function") {
            p.catch((err) => sendUpdateStatus(mapUpdateError(err)));
        }
    } catch (err) {
        sendUpdateStatus(mapUpdateError(err));
    }
});

ipcMain.on("updates:set-auto", (_e, enabled) => {
    if (!app.isPackaged) return;
    autoUpdater.autoDownload = !!enabled;
});

ipcMain.on("updates:quit-and-install", () => {
    if (!app.isPackaged) return;
    // The window's close handler hides to tray unless isQuitting is set, so
    // set it first (mirrors the tray Quit item) or quitAndInstall would just
    // minimise instead of restarting.
    isQuitting = true;
    autoUpdater.quitAndInstall();
});

async function createWindow() {
    const url = await startServer();

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 940,
        minHeight: 600,
        icon: ICON_PATH,
        autoHideMenuBar: true,
        backgroundColor: "#313338",
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, "preload.cjs"),
        },
    });

    mainWindow.loadURL(url);

    const appOrigin = new URL(url).origin;

    // Open target=_blank / window.open links in the system browser, not a new window.
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:/.test(url)) shell.openExternal(url);
        return { action: "deny" };
    });

    // Any attempt to navigate the window away from the app → open externally.
    mainWindow.webContents.on("will-navigate", (e, navUrl) => {
        let origin;
        try {
            origin = new URL(navUrl).origin;
        } catch {
            return;
        }
        if (origin !== appOrigin) {
            e.preventDefault();
            shell.openExternal(navUrl);
        }
    });

    // Close button → hide to the system tray instead of quitting (removes the
    // taskbar button; restore via the tray icon).
    mainWindow.on("close", (e) => {
        if (!isQuitting) {
            e.preventDefault();
            mainWindow.hide();
        }
    });
}

function createTray() {
    const img = nativeImage.createFromPath(ICON_PATH);
    tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
    tray.setToolTip("Zam");
    tray.setContextMenu(
        Menu.buildFromTemplate([
            { label: "Show", click: showWindow },
            { type: "separator" },
            {
                label: "Quit",
                click: () => {
                    isQuitting = true;
                    app.quit();
                },
            },
        ]),
    );
    tray.on("click", showWindow);
}

// Single-instance: focus the existing window instead of launching a second copy.
if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on("second-instance", showWindow);

    app.whenReady().then(() => {
        // Required on Windows for native (Web Notification API) notifications
        // to display and be attributed to the app.
        app.setAppUserModelId("moe.crafty.matrix");
        createWindow();
        createTray();
        setupAutoUpdater();
    });

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
        else showWindow();
    });

    app.on("before-quit", () => {
        isQuitting = true;
    });

    // Keep running in the tray when the window is "closed" (minimised).
    app.on("window-all-closed", () => {
        // Intentionally do nothing — quit only via the tray's Quit item.
    });
}
