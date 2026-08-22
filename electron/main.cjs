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
    session,
    desktopCapturer,
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
        // localStorage — which holds the Matrix session — is keyed by origin
        // (scheme://host:port). Listening on port 0 hands out a fresh random
        // port every launch, so the origin changes and the session is wiped on
        // EVERY restart (and every update). Persist the chosen port in userData
        // and reuse it so the origin — and the login — survive restarts.
        const portFile = path.join(app.getPath("userData"), ".server-port");
        let preferred = 0;
        try {
            preferred = parseInt(fs.readFileSync(portFile, "utf8"), 10) || 0;
        } catch {
            /* first run — no saved port yet */
        }
        const onListening = () => {
            const { port } = server.address();
            try {
                fs.writeFileSync(portFile, String(port));
            } catch {
                /* best-effort — an unpersisted port still works this session */
            }
            resolve(`http://127.0.0.1:${port}`);
        };
        server.on("error", (e) => {
            // Saved port taken (rare) → let the OS assign one this time. Only
            // then does the origin change (a one-off re-login); the steady
            // state stays stable.
            if (e.code === "EADDRINUSE" && preferred !== 0) {
                preferred = 0;
                server.listen(0, "127.0.0.1", onListening);
            } else {
                reject(e);
            }
        });
        server.listen(preferred, "127.0.0.1", onListening);
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

// Persisted "automatic updates" preference, seeded from the renderer at boot
// (updates:set-auto). It governs ONLY the background launch check: when ON that
// check may auto-download. Every user-initiated check from Settings is manual
// and never auto-downloads — the renderer offers a "Download & install" choice
// and only then asks for the download.
let autoUpdatePref = false;

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
// rejected promise both become an error/unsupported status). A `manual` check
// (user pressed "Check for updates") NEVER auto-downloads — it just reports
// "available" so the renderer can offer a download choice. Only the background
// launch check honours the persisted auto-update preference.
function runUpdateCheck(manual) {
    if (!app.isPackaged) return;
    autoUpdater.autoDownload = manual ? false : autoUpdatePref;
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

    // First check ~10s after launch so it never blocks or races startup. This
    // is the ONLY background check, and the one that may auto-download (when the
    // persisted preference is on).
    setTimeout(() => runUpdateCheck(false), 10000);
}

// Renderer → main. Every handler is inert in dev (guarded on app.isPackaged).
// A check from Settings is always manual: it reports "available" but does not
// download until the user confirms via updates:download.
ipcMain.on("updates:check", () => runUpdateCheck(true));

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
    // Stored, not applied to autoDownload directly: each check sets autoDownload
    // from its own manual/background context (a manual check always stays off).
    autoUpdatePref = !!enabled;
});

ipcMain.on("updates:quit-and-install", () => {
    if (!app.isPackaged) return;
    // The window's close handler hides to tray unless isQuitting is set, so
    // set it first (mirrors the tray Quit item) or quitAndInstall would just
    // minimise instead of restarting.
    isQuitting = true;
    autoUpdater.quitAndInstall();
});

// --- Screen sharing --------------------------------------------------------
//
// Electron >= 17 rejects every getDisplayMedia() call unless the app installs
// a display-media request handler, so the in-app screenshare button silently
// failed in the packaged desktop app. macOS can hand the choice to the OS
// picker (useSystemPicker); everywhere else we enumerate sources here and ask
// the renderer to show an in-app picker (src/lib/components/layout/
// ScreenSharePicker.svelte), then resolve the pending callback with its answer.
//
// Intercepting at the handler means ANY getDisplayMedia() caller works,
// including LiveKit's internals, which we do not control.

const SHARE_PICK_TIMEOUT_MS = 120000;
// requestId -> {callback, timer, audioRequested, sourceIds}
const pendingShareRequests = new Map();
let nextShareRequestId = 1;

// Granting nothing makes getDisplayMedia() reject with NotAllowedError, which
// the renderer already treats as "the user dismissed the picker" (no toast).
function denyShareRequest(pending) {
    clearTimeout(pending.timer);
    try {
        pending.callback({});
    } catch (err) {
        // Reached from an ipcMain listener and from a setTimeout — in both a
        // throw would be an UNCAUGHT main-process exception, i.e. the app dies.
        console.error("screen-share denial failed:", err);
    }
}

function resolveShareRequest(requestId, sourceId, sourceName) {
    const pending = pendingShareRequests.get(requestId);
    if (!pending) return; // already timed out or answered twice
    pendingShareRequests.delete(requestId);
    // Grant only a source we actually enumerated for THIS request, so a
    // compromised renderer cannot name an arbitrary capture target. Anything
    // else — a cancellation, a stale id, a forged one — denies.
    if (!sourceId || !pending.sourceIds.has(sourceId)) {
        denyShareRequest(pending);
        return;
    }
    clearTimeout(pending.timer);
    const streams = { video: { id: sourceId, name: sourceName || "" } };
    // Loopback system audio is Windows-only in Electron; asking for it
    // elsewhere would fail the whole request.
    if (pending.audioRequested && process.platform === "win32") {
        streams.audio = "loopback";
    }
    try {
        pending.callback(streams);
    } catch (err) {
        console.error("screen-share grant failed:", err);
    }
}

function setupDisplayMediaHandler() {
    session.defaultSession.setDisplayMediaRequestHandler(
        async (request, callback) => {
            let sources = [];
            try {
                sources = await desktopCapturer.getSources({
                    types: ["screen", "window"],
                    thumbnailSize: { width: 320, height: 180 },
                });
            } catch (err) {
                console.error("desktopCapturer.getSources failed:", err);
            }
            if (!sources.length || !mainWindow || mainWindow.isDestroyed()) {
                callback({});
                return;
            }
            const requestId = nextShareRequestId++;
            const timer = setTimeout(() => {
                const pending = pendingShareRequests.get(requestId);
                if (!pending) return;
                pendingShareRequests.delete(requestId);
                denyShareRequest(pending);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    try {
                        mainWindow.webContents.send(
                            "screenshare:cancel",
                            requestId,
                        );
                    } catch (err) {
                        // We are inside a setTimeout, so a throw here would be
                        // an UNCAUGHT main-process exception. The webContents
                        // can be torn down between the guard above and this
                        // send; the request is already denied either way, so
                        // there is nothing to recover — just note it.
                        console.error(
                            "screen-share cancel notify failed:",
                            err,
                        );
                    }
                }
            }, SHARE_PICK_TIMEOUT_MS);
            pendingShareRequests.set(requestId, {
                callback,
                timer,
                audioRequested: !!request.audioRequested,
                sourceIds: new Set(sources.map((s) => s.id)),
            });
            // From here the pending entry (and its 120s timer) already exist,
            // so a throw — a disposed thumbnail, a webContents torn down
            // between the guard above and now — would leave getDisplayMedia()
            // hanging with no picker until the timeout. Deny at once instead.
            try {
                mainWindow.webContents.send("screenshare:request", {
                    requestId,
                    audioRequested: !!request.audioRequested,
                    sources: sources.map((s) => ({
                        id: s.id,
                        name: s.name,
                        displayId: s.display_id,
                        thumbnailDataUrl: s.thumbnail.isEmpty()
                            ? null
                            : s.thumbnail.toDataURL(),
                    })),
                });
            } catch (err) {
                console.error("screen-share picker dispatch failed:", err);
                const pending = pendingShareRequests.get(requestId);
                if (pending) {
                    pendingShareRequests.delete(requestId);
                    denyShareRequest(pending); // also clears the timer
                }
            }
        },
        // macOS only (and Experimental there): when the OS picker is available
        // Electron uses it and never calls our handler.
        { useSystemPicker: true },
    );
}

// The payload comes from the renderer and is therefore untrusted: validate
// every field before it reaches a Map key or the capture callback. A throw in
// an ipcMain listener is an uncaught main-process exception — it kills the app.
ipcMain.on("screenshare:respond", (_e, payload) => {
    const { requestId, sourceId, sourceName } = payload || {};
    const id = Number(requestId);
    // Unknown/stale/garbage ids stay a silent no-op, as before.
    if (!Number.isFinite(id) || !pendingShareRequests.has(id)) return;
    // Only a non-empty string is a pick; anything else is a cancellation.
    const picked = typeof sourceId === "string" && sourceId ? sourceId : null;
    const name = typeof sourceName === "string" ? sourceName : "";
    resolveShareRequest(id, picked, name);
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
            // The window hides to the tray on close and keeps running as a
            // background client. Chromium throttles a hidden window's timers by
            // default, which clamps the matrix-js-sdk sync loop's next-poll
            // scheduling — so an incoming call that lands during a throttled gap
            // rings late (or waits for the window to be restored). Disable
            // throttling so sync, ringing, and notifications stay prompt while
            // minimised to the tray.
            backgroundThrottling: false,
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
        // Must be installed before any renderer can call getDisplayMedia().
        setupDisplayMediaHandler();
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
