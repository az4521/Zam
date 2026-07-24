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
