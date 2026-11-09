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
    clipboard,
    Notification,
    screen,
    powerMonitor,
    net,
    contentTracing,
    dialog,
} = require("electron");
const { autoUpdater } = require("electron-updater");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { resolveStaticPath, isSafeExternalUrl } = require("./serverGuards.cjs");
const { createBundleUpdater } = require("./bundleUpdater.cjs");
const { PACK_PATH, openTwemojiPack } = require("./twemojiPack.cjs");
const { BUNDLE_PUBLIC_KEY } = require("./bundleKey.cjs");
const { parseWindowState, fitToDisplays } = require("./windowState.cjs");
const { registerPluginNative } = require("./pluginNative.cjs");
const { registerPluginFrames } = require("./pluginFrames.cjs");
const { registerGlobalHotkeys } = require("./globalHotkeys.cjs");
const { createUpdateSchedule } = require("./updateSchedule.cjs");
const { createCallPriority } = require("./callPriority.cjs");
const { createProxyManager } = require("./proxy.cjs");
const { recordMemoryReport } = require("./memoryReport.cjs");
const { createAutostart } = require("./autostart.cjs");
const { createRichPresence } = require("./richPresence.cjs");
const { createPresenceImages } = require("./presenceImages.cjs");
const { linuxExeIconAsync, windowsSteamIcon } = require("./exeIcon.cjs");
const { createAppAudio } = require("./appAudio.cjs");
const { resolveShareAudio } = require("./shareAudio.cjs");
const { createFileLog } = require("./fileLog.cjs");
const { createUpdateGuard } = require("./updateGuard.cjs");
const {
    createFlatpakShellUpdate,
    AFTER_UPDATE_FLAG,
} = require("./flatpakShellUpdate.cjs");
const { createFlatpakUpdateMonitor } = require("./portalFlatpakUpdate.cjs");

// userData/main.log: what a packaged app would otherwise lose (crashes, renderer
// and GPU exits). Capped at start by fileLog.cjs.
const mainLog = createFileLog(path.join(app.getPath("userData"), "main.log"));
// With a handler installed Electron no longer shows its own error dialog. Log
// every failure; before the app is ready there is no window to fail quietly
// under, so show the error box ourselves. Exit behaviour is unchanged.
process.on("uncaughtException", (err) => {
    mainLog.error("uncaught exception", err);
    if (!app.isReady()) dialog.showErrorBox("Zam", String(err?.stack ?? err));
});
process.on("unhandledRejection", (reason) => {
    mainLog.error("unhandled rejection", reason);
});

const BUILD_DIR = path.join(__dirname, "..", "build");
// What the local server serves: the site packed in the app, or a newer web
// bundle that was downloaded without a reinstall (bundleUpdater.cjs). Set once
// at launch, and again when a bundle is applied to the running app.
let webRoot = BUILD_DIR;
// Hand-sized icon set (scripts/gen-icons.py): the .ico carries a real frame per
// size so Windows never has to scale a 1024px PNG down for the taskbar/title
// bar, and the tray glyphs are white-with-black-outline silhouettes.
// nativeImage reads through Chromium, not Node's fs, so it cannot see inside
// app.asar: packaged builds load the icons from the asarUnpack'd copy.
const APP_USER_MODEL_ID = "moe.crafty.matrix";
const ICONS_DIR = path
    .join(__dirname, "icons")
    .replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
const ICON_PATH = path.join(
    ICONS_DIR,
    process.platform === "win32" ? "icon.ico" : "icon.png",
);

let mainWindow = null;
let tray = null;
let isQuitting = false;

// Device-local "minimise to tray on close" preference, seeded from the renderer
// at boot (tray:set-minimize-to-close) and updated when the user toggles it.
// Default ON = today's behaviour (close hides to tray). See the hide-vs-close
// contract in src/lib/utils/trayClose.ts (resolveWindowCloseAction) — this file
// is plain CommonJS required as-is and cannot import that TS util, so it mirrors
// the same branch inline.
let minimizeToTrayOnClose = true;

// Voice keybinds while the window isn't focused (globalHotkeys.cjs).
const globalHotkeys = registerGlobalHotkeys(() => mainWindow);

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

const SSO_DONE_PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Zam</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui,sans-serif;background:#313338;color:#f2f3f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center}p{color:#b5bac1}</style>
</head><body><div><h1>Signed in</h1><p>You can close this tab and return to Zam.</p></div></body></html>`;

// Forward an SSO redirect (path + query from the local server) to the renderer
// and bring the window forward so the user lands back in the app.
function handleSsoCallback(reqUrl) {
    if (!mainWindow) return;
    mainWindow.webContents.send("sso:callback", reqUrl);
    showWindow();
}

// The Twemoji pack of the site being served, opened on first use and again
// when a web bundle changes webRoot (twemojiPack.cjs).
let twemojiPack = { root: null, pack: null };
function packedTwemoji(urlPath) {
    const m = /^\/twemoji\/svg\/([0-9a-f-]+)\.svg$/.exec(urlPath);
    if (!m) return null;
    if (twemojiPack.root !== webRoot) {
        twemojiPack = {
            root: webRoot,
            pack: openTwemojiPack(path.join(webRoot, ...PACK_PATH.split("/"))),
        };
    }
    return twemojiPack.pack?.get(m[1]) ?? null;
}

// Minimal static server for ../build with SPA fallback to index.html.
function startServer() {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            // SSO sign-in finishes in the SYSTEM browser (the IdP page is opened
            // externally), and the homeserver redirects it back here with a
            // one-time loginToken. Hand the full callback URL to the renderer,
            // which checks its own sso_state nonce before redeeming the token,
            // and tell the browser tab it can be closed.
            if ((req.url || "").startsWith("/sso-callback")) {
                handleSsoCallback(req.url);
                res.writeHead(200, {
                    "Content-Type": "text/html; charset=utf-8",
                    "Cache-Control": "no-store",
                });
                res.end(SSO_DONE_PAGE);
                return;
            }
            // Safely resolve and validate the requested path.
            let filePath = resolveStaticPath(webRoot, req.url || "/");
            if (!filePath) {
                // Malformed URL or path traversal attempt.
                res.writeHead(400);
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
                // The desktop app ships Twemoji packed, not as loose files.
                const svg = packedTwemoji((req.url || "").split("?")[0]);
                if (svg) {
                    res.writeHead(200, { "Content-Type": MIME[".svg"] });
                    res.end(svg);
                    return;
                }
            }
            if (!stat) {
                // SPA fallback — the static adapter writes the fallback to index.html.
                filePath = path.join(webRoot, "index.html");
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
        // After an update the old process can still hold the port for a
        // moment while the new one starts. Falling back to a random port at
        // that point would change the origin and sign the user out, so wait
        // for the port to free up before giving up on it.
        const PORT_RETRY_MS = 250;
        const PORT_RETRY_LIMIT = 40; // ~10 s
        let retries = 0;
        let fellBack = false;
        const onListening = () => {
            const { port } = server.address();
            // A fallback port is for this run only: keeping the saved one
            // lets the next launch get its origin (and login) back.
            if (!fellBack) {
                try {
                    fs.writeFileSync(portFile, String(port));
                } catch {
                    /* best-effort: an unpersisted port still works this session */
                }
            }
            resolve(`http://127.0.0.1:${port}`);
        };
        server.on("error", (e) => {
            if (e.code === "EADDRINUSE" && preferred !== 0) {
                if (retries++ < PORT_RETRY_LIMIT) {
                    setTimeout(
                        () =>
                            server.listen(preferred, "127.0.0.1", onListening),
                        PORT_RETRY_MS,
                    );
                    return;
                }
                // Still taken (another program has it): this run only gets
                // a different origin, so a login made now won't carry over.
                fellBack = true;
                server.listen(0, "127.0.0.1", onListening);
            } else {
                reject(e);
            }
        });
        server.listen(preferred, "127.0.0.1", onListening);
    });
}

function showWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
}

// The renderer asks for this when a call notification is clicked while the
// window is hidden in the tray.
ipcMain.on("show-window", showWindow);

// Plugins' native code (zam.native), after the user agrees.
registerPluginNative(ipcMain, () => mainWindow);

// Plugins' scripts for the pages embedded in the window (zam.frames).
registerPluginFrames(app, ipcMain, () => mainWindow);

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

// Inside Flatpak electron-updater has nothing it can replace (it only updates
// AppImages on Linux). The web UI updates through bundles as everywhere else,
// and a new shell comes from our Flatpak repo through the Flatpak portal
// (flatpakShellUpdate.cjs), or `flatpak update` where the portal can't.
const IN_FLATPAK = !!process.env.FLATPAK_ID;

// A portable build (the single .exe, run from a temporary folder) cannot be
// replaced by the installer: that would put a second copy in place and leave
// the one the user launched on the old version. electron-builder sets
// PORTABLE_EXECUTABLE_FILE for portable builds (autostart.cjs relies on it too).
// Like Flatpak, such a build is told about new releases and sent to the
// release page instead of installing one.
const IS_PORTABLE = !!process.env.PORTABLE_EXECUTABLE_FILE;

// Logs for the installer path (userData/updater.log) and the failed-install
// record that keeps a broken installer from looping (updateGuard.cjs).
const updaterLog = createFileLog(
    path.join(app.getPath("userData"), "updater.log"),
);
const updateGuard = createUpdateGuard({
    userDataDir: app.getPath("userData"),
    currentVersion: app.getVersion(),
    log: (level, text) => updaterLog[level](text),
});

// Post a status object to the current window (reassigned by createWindow).
// The latest status, so a check asked for mid-download (opening About) can
// repeat it instead of flipping the UI back to "available" while progress
// events keep arriving.
let lastUpdateStatus = null;

function sendUpdateStatus(payload) {
    // `kind` says what is being updated, so the renderer words "restart" vs
    // "reload" right and a bundle's kind never lingers into an installer update.
    payload = { kind: "shell", ...payload };
    // An installer that failed before, or was already started for this version,
    // is not applied again on the renderer's say-so (updateGuard.cjs).
    if (payload.phase === "downloaded" && payload.kind !== "bundle") {
        payload.autoApplyBlocked = updateGuard.isBlocked(payload.version);
    }
    lastUpdateStatus = payload;
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
    const phase = lastUpdateStatus?.phase;
    if (phase === "downloading" || phase === "downloaded") {
        sendUpdateStatus(lastUpdateStatus);
        return;
    }
    void checkBundleThenInstaller(manual);
}

// --- Web bundle updates (bundleUpdater.cjs) --------------------------------
//
// A release that only changes the web UI updates through a signed bundle: it
// is staged in the background, then the renderer applies it at a moment that
// suits the user (startup, idle, or in the background; never in a call), by
// asking for "updates:quit-and-install". Status events carry kind "bundle" so
// the UI says "reload" instead of "restart". A release that needs a new shell
// (or any trouble reading bundles) takes the installer path below, as before.

let bundleUpdater = null;
// What the last check found and is ready to download.
let foundBundle = null;

const UPDATE_PREFS_FILE = () =>
    path.join(app.getPath("userData"), "update-prefs.json");

// The renderer's "automatic updates" choice, kept here too so a launch can
// apply a staged bundle before any page exists to tell us. On unless turned off.
function readAutoUpdatePref() {
    try {
        return (
            JSON.parse(fs.readFileSync(UPDATE_PREFS_FILE(), "utf8")).auto !==
            false
        );
    } catch {
        return true;
    }
}

function writeAutoUpdatePref(auto) {
    try {
        fs.writeFileSync(UPDATE_PREFS_FILE(), JSON.stringify({ auto }));
    } catch {
        /* best-effort: the renderer re-sends it every launch */
    }
}

// Pick the folder to serve, before the server starts. Never throws: any
// trouble leaves the site packed in the app in place.
function setupBundleUpdater() {
    if (!app.isPackaged) return;
    try {
        const { hash } = JSON.parse(
            fs.readFileSync(path.join(__dirname, "shell-hash.json"), "utf8"),
        );
        if (typeof hash !== "string" || !hash) return;
        bundleUpdater = createBundleUpdater({
            dir: path.join(app.getPath("userData"), "web-bundles"),
            shellVersion: app.getVersion(),
            shellHash: hash,
            publicKey: BUNDLE_PUBLIC_KEY,
            releaseUrl:
                "https://api.github.com/repos/az4521/Zam/releases/latest",
            assetUrlPrefix: "https://github.com/az4521/Zam/releases/download/",
            fetchJson: async (url) => {
                const res = await net.fetch(url, {
                    headers: { Accept: "application/json" },
                });
                if (!res.ok) throw new Error(`${url} answered ${res.status}`);
                return res.json();
            },
            download: downloadToFile,
            log: (...a) => console.log("[bundle]", ...a),
        });
        const root = bundleUpdater.activeRoot({
            applyStaged: readAutoUpdatePref(),
        });
        if (root) webRoot = root;
    } catch (err) {
        bundleUpdater = null;
        webRoot = BUILD_DIR;
        console.error("[bundle] disabled:", err);
    }
}

// net.fetch (so the user's proxy setting applies) streamed to a file, hashing
// and counting as it goes and stopping at maxBytes.
async function downloadToFile(url, dest, { maxBytes, onProgress }) {
    const res = await net.fetch(url);
    if (!res.ok || !res.body) throw new Error(`${url} answered ${res.status}`);
    const total = Number(res.headers.get("content-length")) || maxBytes;
    const hash = require("crypto").createHash("sha512");
    const out = fs.createWriteStream(dest);
    let size = 0;
    try {
        const reader = res.body.getReader();
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > maxBytes)
                throw new Error("web bundle is larger than expected");
            hash.update(value);
            if (!out.write(value))
                await new Promise((r) => out.once("drain", r));
            onProgress(Math.min(1, size / total));
        }
    } finally {
        await new Promise((r) => out.end(r));
    }
    return { sha512: hash.digest("base64"), size };
}

async function checkBundleThenInstaller(manual) {
    let shellVersion = null;
    if (bundleUpdater) {
        sendUpdateStatus({ phase: "checking" });
        try {
            const found = await bundleUpdater.check();
            if (found.kind === "bundle") {
                foundBundle = found;
                const status = { version: found.version, kind: "bundle" };
                if (found.staged) {
                    sendUpdateStatus({ phase: "downloaded", ...status });
                    return;
                }
                sendUpdateStatus({ phase: "available", ...status });
                // A manual check only offers the download; the background check
                // takes it when automatic updates are on.
                if (!manual && autoUpdatePref) await downloadFoundBundle();
                return;
            }
            if (found.kind === "current") {
                // electron-updater only knows the shell's version, which a live
                // bundle apply leaves behind the release; don't let it re-offer.
                sendUpdateStatus({
                    phase: "up-to-date",
                    version: found.version,
                });
                return;
            }
            if (found.kind === "shell") shellVersion = found.version;
        } catch (err) {
            // Not fatal: the installer path can still tell the user.
            console.error("[bundle] check failed:", err);
        }
    }
    if (IN_FLATPAK && shellVersion && flatpakShell) {
        flatpakShell.offer(shellVersion, { manual, auto: autoUpdatePref });
        return;
    }
    if (IN_FLATPAK || IS_PORTABLE) {
        // A Flatpak without the portal's update monitor needs `flatpak update`,
        // and a portable build cannot install a shell (see IS_PORTABLE): either
        // way a newer release is only pointed at.
        sendUpdateStatus(
            shellVersion
                ? {
                      phase: "unsupported",
                      version: shellVersion,
                      ...(IN_FLATPAK ? { manual: "flatpak" } : {}),
                  }
                : {
                      phase: "up-to-date",
                      version:
                          bundleUpdater?.currentVersion() ?? app.getVersion(),
                  },
        );
        return;
    }
    runInstallerCheck(manual);
}

async function downloadFoundBundle() {
    const found = foundBundle;
    if (!bundleUpdater || !found || found.staged) return;
    const status = { version: found.version, kind: "bundle" };
    sendUpdateStatus({ phase: "downloading", percent: 0, ...status });
    let lastSent = 0;
    try {
        await bundleUpdater.download(found, (fraction) => {
            const percent = Math.round(fraction * 100);
            if (percent === lastSent) return;
            lastSent = percent;
            sendUpdateStatus({ phase: "downloading", percent, ...status });
        });
        found.staged = true;
        sendUpdateStatus({ phase: "downloaded", ...status });
    } catch (err) {
        console.error("[bundle] download failed:", err);
        sendUpdateStatus(mapUpdateError(err));
    }
}

// Serve the staged bundle and reload the page onto it. The page's lazy chunks
// are hashed per build, so the root changes only now, when the reload follows.
async function applyStagedBundle() {
    const version = foundBundle?.version;
    if (!bundleUpdater || !version || !mainWindow || mainWindow.isDestroyed())
        return;
    webRoot = bundleUpdater.apply(version);
    foundBundle = null;
    lastUpdateStatus = null;
    // The offline shell worker would answer the reload from its old cache.
    // Dropping it makes the reload take the new files; the page registers a
    // fresh worker as it boots.
    await session.defaultSession
        .clearStorageData({ storages: ["serviceworkers"] })
        .catch(() => {});
    mainWindow.webContents.reloadIgnoringCache();
}

// --- Flatpak shell updates (flatpakShellUpdate.cjs) ------------------------

let flatpakShell = null;

// Published with the Flatpak repo by the release workflow (GitHub Pages).
const FLATPAK_REPO_VERSION_URL = "https://az4521.github.io/Zam/version.json";

function setupFlatpakUpdater() {
    const log = (...a) =>
        updaterLog.info(
            `[flatpak] ${a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ")}`,
        );
    const monitor = createFlatpakUpdateMonitor({
        log,
        onUpdateAvailable: (info) => {
            flatpakShell?.updateAvailable(info);
            // The release check says what it is: often a web bundle, which
            // needs no restart, and it names the version for the UI.
            runUpdateCheck(false);
        },
    });
    monitor
        .start()
        .then(() => {
            flatpakShell = createFlatpakShellUpdate({
                monitor,
                runningVersion: app.getVersion(),
                sendStatus: sendUpdateStatus,
                isFailed: (v) => updateGuard.isFailed(v),
                repoVersion: async () => {
                    const res = await net.fetch(FLATPAK_REPO_VERSION_URL, {
                        cache: "no-store",
                    });
                    if (!res.ok) return null;
                    const { version } = await res.json();
                    return typeof version === "string" ? version : null;
                },
                log,
            });
        })
        .catch((err) => {
            // Flatpak before 1.5, or no session bus: `flatpak update` it is.
            monitor.close();
            updaterLog.warn(
                `[flatpak] no update portal: ${err?.message ?? err}`,
            );
        });
}

// The portal starts the installed version in a sandbox of its own; this one
// quits, and the new one waits for it to let go (AFTER_UPDATE_FLAG).
async function restartIntoFlatpakUpdate() {
    if (!flatpakShell?.isInstalled()) return;
    try {
        await flatpakShell.restart();
    } catch (err) {
        updaterLog.error("[flatpak] could not start the update:", err);
        sendUpdateStatus(mapUpdateError(err));
        return;
    }
    if (lastUpdateStatus?.version) {
        updateGuard.beginInstall(lastUpdateStatus.version);
        sendUpdateStatus(lastUpdateStatus);
    }
    isQuitting = true;
    app.quit();
}

function runInstallerCheck(manual) {
    if (IN_FLATPAK || IS_PORTABLE) return;
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
function setupInstallerUpdater() {
    autoUpdater.autoInstallOnAppQuit = true;
    // Fail-safe default: stay OFF until the renderer seeds the persisted preference at boot (see app shell onMount). Prevents a forced silent download when the user has turned auto-updates OFF but hasn't opened Settings before the launch check.
    autoUpdater.autoDownload = false;
    // Integrity (audit SEC-M8): electron-updater checks every download against
    // the sha512 recorded in latest.yml, and this build NEVER turns that check
    // off. Windows builds are not Authenticode-signed (release.yml sets
    // CSC_IDENTITY_AUTO_DISCOVERY=false), so there is no publisher signature to
    // verify there: the sha512 match only shows the installer is the one that
    // release describes, not that the release itself is trustworthy. Also refuse
    // a downgrade so a compromised update feed cannot force an older but
    // vulnerable build onto the user. (Linux AppImage has no built-in signer
    // check — a documented gap tracked separately as AppImage signing, not
    // addressed in this file.)
    autoUpdater.allowDowngrade = false;

    autoUpdater.on("checking-for-update", () => {
        updaterLog.info("checking for update");
        sendUpdateStatus({ phase: "checking" });
    });
    autoUpdater.on("update-available", (info) => {
        // Emitted synchronously, before electron-updater reads autoDownload to
        // decide whether to fetch the update by itself. A version that failed to
        // install is offered, never fetched automatically (updateGuard.cjs).
        const failed = updateGuard.isFailed(info?.version);
        if (failed) autoUpdater.autoDownload = false;
        updaterLog.info(
            `update ${info?.version} available${failed ? " (failed to install before; not auto-downloading)" : ""}`,
        );
        sendUpdateStatus({
            phase: "available",
            version: info?.version,
            installFailed: failed || undefined,
        });
    });
    autoUpdater.on("update-not-available", (info) => {
        updaterLog.info(`up to date (latest ${info?.version})`);
        sendUpdateStatus({ phase: "up-to-date", version: info?.version });
    });
    autoUpdater.on("download-progress", (p) => {
        sendUpdateStatus({ phase: "downloading", percent: p?.percent });
    });
    autoUpdater.on("update-downloaded", (info) => {
        updaterLog.info(`update ${info?.version} downloaded`);
        sendUpdateStatus({ phase: "downloaded", version: info?.version });
    });
    autoUpdater.on("error", (err) => {
        // A signature / integrity verification failure must never be folded
        // silently into a generic update error (audit SEC-M8). electron-updater
        // rejects an update whose signature does not match the expected
        // publisher; log those loudly and distinctly so a tampered or
        // mis-signed release is visible in the main-process log rather than
        // looking like an ordinary network hiccup.
        const message = err?.message ?? String(err);
        updaterLog.error("update error:", err);
        if (
            /sign|signature|publisher|not signed|sha512|checksum|integrity/i.test(
                message,
            )
        ) {
            console.error(
                "[updater] SIGNATURE/INTEGRITY VERIFICATION FAILURE — refusing update:",
                message,
            );
        }
        sendUpdateStatus(mapUpdateError(err));
    });
}

// The installer that did not take stays in electron-updater's download cache;
// clearing it stops the next check from announcing it as downloaded again.
async function clearInstallerCache() {
    try {
        const helper = await autoUpdater.getOrCreateDownloadHelper();
        await helper.clear();
    } catch (err) {
        updaterLog.warn("could not clear the installer cache:", err);
    }
}

function setupAutoUpdater() {
    if (!app.isPackaged) return;
    // Every updater event lands in userData/updater.log.
    autoUpdater.logger = {
        info: (m) => updaterLog.info(m),
        warn: (m) => updaterLog.warn(m),
        error: (m) => updaterLog.error(m),
        debug: () => {},
    };
    // Did the last installer take? If not, record its version as failed before
    // the first check can offer it.
    const { pendingFailed } = updateGuard.reconcile();
    if (pendingFailed) void clearInstallerCache();
    // The saved choice (on unless turned off) governs from the first check; the
    // renderer re-sends it at boot.
    autoUpdatePref = readAutoUpdatePref();
    // Flatpak builds take their shell through the Flatpak portal, and portable
    // ones cannot install one (IS_PORTABLE); both still check for web bundles
    // below.
    if (!IN_FLATPAK && !IS_PORTABLE) setupInstallerUpdater();
    if (IN_FLATPAK) setupFlatpakUpdater();

    // Background checks: ~10s after launch (so it never blocks or races
    // startup), then every few hours and after waking from sleep, so an app
    // left open for days still hears about a release (see updateSchedule.cjs).
    // These are the only checks that may auto-download (when the persisted
    // preference is on).
    const schedule = createUpdateSchedule({
        check: () => runUpdateCheck(false),
    });
    schedule.start();
    powerMonitor.on("resume", () => schedule.onResume());
}

// Renderer → main. Every handler is inert in dev (guarded on app.isPackaged).
// A check from Settings is always manual: it reports "available" but does not
// download until the user confirms via updates:download.
ipcMain.on("updates:check", () => runUpdateCheck(true));

ipcMain.on("updates:download", () => {
    if (!app.isPackaged) return;
    if (lastUpdateStatus?.kind === "bundle") {
        void downloadFoundBundle();
        return;
    }
    if (IN_FLATPAK) void flatpakShell?.install();
    if (IN_FLATPAK || IS_PORTABLE) return;
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
    writeAutoUpdatePref(autoUpdatePref);
});

// The page finished loading: a web bundle that was just applied is good.
ipcMain.on("updates:bundle-ready", () => bundleUpdater?.markReady());

// The OS's own General MIDI sound bank, for playing MIDI attachments with the
// sounds the user's system synth uses (src/lib/utils/midiSoundBank.ts). Only
// these fixed paths are ever read; the renderer supplies nothing. Resolves
// null when none exists, and the renderer falls back to other banks.
const SYSTEM_SOUND_BANKS = {
    // Microsoft GS Wavetable Synth's bank (Roland GS, DLS).
    win32: [
        path.join(
            process.env.SystemRoot || "C:\\Windows",
            "System32",
            "drivers",
            "gm.dls",
        ),
    ],
    // Apple's DLS synth bank.
    darwin: [
        "/System/Library/Components/CoreAudio.component/Contents/Resources/gs_instruments.dls",
    ],
    // Distro-packaged SoundFonts (Debian/Ubuntu, Fedora, Arch).
    linux: [
        "/usr/share/sounds/sf2/default-GM.sf2",
        "/usr/share/sounds/sf2/FluidR3_GM.sf2",
        "/usr/share/soundfonts/default.sf2",
        "/usr/share/soundfonts/FluidR3_GM.sf2",
        "/usr/share/sounds/sf3/default-GM.sf3",
    ],
};
const MAX_SOUND_BANK_BYTES = 256 * 1024 * 1024;

async function findSystemSoundBank() {
    for (const file of SYSTEM_SOUND_BANKS[process.platform] || []) {
        try {
            const stat = await fs.promises.stat(file);
            if (stat.isFile() && stat.size <= MAX_SOUND_BANK_BYTES) return file;
        } catch {
            // missing or unreadable: try the next one
        }
    }
    return null;
}

ipcMain.handle("soundbank:system", async () => {
    const file = await findSystemSoundBank();
    if (!file) return null;
    try {
        return await fs.promises.readFile(file);
    } catch {
        return null;
    }
});

// Whether a system bank exists, without reading it (the settings page asks).
ipcMain.handle(
    "soundbank:has-system",
    async () => (await findSystemSoundBank()) !== null,
);

// Shift+click on a download button: write the bytes into the Downloads folder
// without the save dialog. The name comes from a remote sender, so it is
// reduced to a bare file name and de-duplicated ("a.png" -> "a (1).png").
ipcMain.handle("save-to-downloads", async (_e, name, data) => {
    if (typeof name !== "string" || !(data instanceof ArrayBuffer))
        throw new Error("invalid save request");
    let base = path.basename(name.replace(/\\/g, "/"));
    base = base.replace(/[<>:"|?*\u0000-\u001f]/g, "_").trim();
    if (!base || base === "." || base === "..") base = "download";
    const dir = app.getPath("downloads");
    const ext = path.extname(base);
    const stem = base.slice(0, base.length - ext.length);
    const bytes = Buffer.from(data);
    for (let n = 0; ; n++) {
        const file = path.join(dir, n ? `${stem} (${n})${ext}` : base);
        try {
            // "wx" fails if the name is taken, so nothing is overwritten.
            await fs.promises.writeFile(file, bytes, { flag: "wx" });
            return file;
        } catch (err) {
            if (err.code !== "EEXIST" || n >= 999) throw err;
        }
    }
});

// A notification arrived for a window the user is not looking at: flash the
// taskbar button (Windows/Linux) or bounce the dock icon (macOS).
ipcMain.on("notify:flash", () => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isFocused())
        return;
    if (process.platform === "darwin") app.dock?.bounce("informational");
    else mainWindow.flashFrame(true);
});

// Unread pings: swap in the tray glyph with the red dot (macOS template images
// cannot be coloured, so there it is a bullet next to the icon instead).
ipcMain.on("tray:set-unread", (_e, unread) => {
    if (!tray) return;
    tray.setImage(trayImage(!!unread));
    if (process.platform === "darwin") tray.setTitle(unread ? "\u2022" : "");
});

// --- OS notifications ------------------------------------------------------
//
// Posted from here rather than the renderer's Web Notification API, which
// depends on a permission state that is not reliably "granted" in the desktop
// shell (so pings flashed the taskbar but showed no pop-up). Clicks and closes
// are reported back by id so the renderer keeps its own bookkeeping.
const liveNotifications = new Map(); // id -> Notification
const notificationIdByTag = new Map(); // tag -> id

function forgetNotification(id) {
    liveNotifications.delete(id);
    for (const [tag, tagId] of notificationIdByTag)
        if (tagId === id) notificationIdByTag.delete(tag);
}

function clampText(v, max) {
    return typeof v === "string" ? v.slice(0, max) : "";
}

ipcMain.on("notify:show", (_e, payload) => {
    if (!Notification.isSupported()) return;
    const { id, title, body, tag, silent } = payload || {};
    if (!Number.isFinite(id)) return;
    // Same tag = the previous popup is replaced, like Web Notification's tag.
    const tagStr = clampText(tag, 200);
    const previous = tagStr ? notificationIdByTag.get(tagStr) : undefined;
    if (previous !== undefined) {
        const old = liveNotifications.get(previous);
        forgetNotification(previous);
        try {
            old?.close();
        } catch {
            /* already gone */
        }
    }
    const icon = nativeImage.createFromPath(path.join(ICONS_DIR, "icon.png"));
    const n = new Notification({
        title: clampText(title, 256),
        body: clampText(body, 1024),
        // Windows plays its own toast chime unless silenced; the app already
        // plays its own sound for loud notifications, so never double up.
        silent: process.platform === "win32" ? true : !!silent,
        ...(icon.isEmpty() ? {} : { icon }),
    });
    liveNotifications.set(id, n);
    if (tagStr) notificationIdByTag.set(tagStr, id);
    const report = (type) => {
        if (mainWindow && !mainWindow.isDestroyed())
            mainWindow.webContents.send("notify:event", { id, type });
    };
    n.on("click", () => {
        showWindow();
        report("click");
    });
    n.on("close", () => {
        forgetNotification(id);
        report("close");
    });
    n.show();
});

ipcMain.on("notify:close", (_e, id) => {
    const n = liveNotifications.get(id);
    if (!n) return;
    forgetNotification(id);
    try {
        n.close();
    } catch {
        /* already gone */
    }
});

ipcMain.on("tray:set-minimize-to-close", (_e, enabled) => {
    minimizeToTrayOnClose = !!enabled;
});

ipcMain.on("updates:quit-and-install", () => {
    if (!app.isPackaged) return;
    // A staged web bundle needs a reload, not a restart.
    if (lastUpdateStatus?.kind === "bundle") {
        void applyStagedBundle();
        return;
    }
    if (IS_PORTABLE) return;
    if (IN_FLATPAK) {
        void restartIntoFlatpakUpdate();
        return;
    }
    // Recorded before quitting, so a launch that still finds this version
    // running knows the install did not take (updateGuard.cjs). The status is
    // re-sent so the renderer stops offering to apply the same version again.
    if (lastUpdateStatus?.version) {
        updateGuard.beginInstall(lastUpdateStatus.version);
        sendUpdateStatus(lastUpdateStatus);
    }
    // The window's close handler hides to tray unless isQuitting is set, so
    // set it first (mirrors the tray Quit item) or quitAndInstall would just
    // minimise instead of restarting.
    isQuitting = true;
    // Silent + force-run: the NSIS installer otherwise opens its own UI and, for
    // an update, does not relaunch the app, so a hidden or stalled installer
    // looked like "restarted and still on the old version".
    autoUpdater.quitAndInstall(true, true);
});

// --- Proxy (Settings > General > Network) ----------------------------------

// Zam's own proxy setting and call routing (proxy.cjs). Applied before the
// window loads; the page reports call servers so they can bypass it.
const proxyManager = createProxyManager({
    app,
    session,
    net,
    getWindow: () => mainWindow,
});
ipcMain.handle("proxy:info", () => proxyManager.info());
ipcMain.handle("proxy:set", (_e, prefs) => proxyManager.set(prefs));
ipcMain.handle("proxy:call-targets", (_e, hosts) =>
    proxyManager.addCallTargets(hosts),
);
ipcMain.handle("proxy:route", (_e, url) => proxyManager.route(url));

// --- Run at startup (Settings > General > Desktop) -------------------------

const autostart = createAutostart({ app, inFlatpak: IN_FLATPAK });
ipcMain.handle("autostart:info", () => autostart.info());
ipcMain.handle("autostart:set", (_e, enabled) => autostart.set(enabled));

// --- Rich presence (Settings > General) -----------------------------------

// Local listeners for MSC4544, Discord Rich Presence and game detection. Idle
// until the page asks; the page decides what any of it means.
const richPresence = createRichPresence({
    userDataDir: app.getPath("userData"),
    inFlatpak: IN_FLATPAK,
    // Discord's game list and app names, over net.fetch so the proxy applies.
    fetch: (url, init) => net.fetch(url, init),
    // The macOS now-playing adapter (see mediaSession.cjs and
    // scripts/build-mediaremote-adapter.mjs).
    mediaDir: app.isPackaged
        ? path.join(process.resourcesPath, "mediaremote")
        : path.join(app.getAppPath(), "native", "mediaremote-adapter"),
    send: (event) => {
        if (mainWindow && !mainWindow.isDestroyed())
            mainWindow.webContents.send("rich-presence:event", event);
    },
    log: (...args) => console.log("[rich-presence]", ...args),
});
ipcMain.handle("rich-presence:configure", (_e, want) =>
    richPresence.configure({
        local: want?.local === true,
        arrpc: want?.arrpc === true,
        scan: want?.scan === true,
        fake: want?.fake === true,
        media: want?.media === true,
        autoRestartDiscord: want?.autoRestartDiscord === true,
        userId: typeof want?.userId === "string" ? want.userId : "",
        games: want?.games,
    }),
);
ipcMain.handle("rich-presence:programs", () =>
    richPresence.programs().catch(() => []),
);
// A media player's own icon, for a "Listening to" entry with no cover: its
// executable on Windows, its app bundle on macOS. Best effort; Linux has no
// lookup worth showing. A found icon is kept, a miss is tried again later.
const MEDIA_ICON_MISS_MS = 60 * 1000;
const mediaIcons = new Map(); // player id -> { at, icon }
const MAC_MEDIA_APPS = new Map([
    ["spotify", "/Applications/Spotify.app"],
    ["music", "/System/Applications/Music.app"],
]);
async function mediaPlayerIcon(playerId) {
    if (process.platform !== "win32" && process.platform !== "darwin")
        return null;
    const held = mediaIcons.get(playerId);
    if (held && (held.icon || Date.now() - held.at < MEDIA_ICON_MISS_MS))
        return held.icon;
    let icon = null;
    try {
        let exe = null;
        if (process.platform === "win32") {
            // SMTC names a player by its executable, e.g. "Spotify.exe".
            const want = playerId.replace(/\.exe$/i, "").toLowerCase();
            const running = await richPresence.programs();
            exe = running.find((p) => p.name.toLowerCase() === want)?.path;
        } else {
            const bundle = MAC_MEDIA_APPS.get(playerId);
            exe = bundle && fs.existsSync(bundle) ? bundle : null;
        }
        if (exe) {
            const img = await app.getFileIcon(exe, { size: "large" });
            if (!img.isEmpty())
                icon = { type: "image/png", data: new Uint8Array(img.toPNG()) };
        }
    } catch {
        icon = null;
    }
    mediaIcons.set(playerId, { at: Date.now(), icon });
    return icon;
}
// Pictures for presence, over net.fetch so the proxy setting applies.
const presenceImages = createPresenceImages({
    fetch: (url, init) => net.fetch(url, init),
    // A game with no Discord icon gets its executable's own.
    exeIcon: async (gameId) => {
        const exe = richPresence.gameExe(gameId);
        if (!exe) return null;
        // On Linux getFileIcon only returns the theme's generic executable
        // icon, which is worse than no picture.
        if (process.platform === "linux") return await linuxExeIconAsync(exe);
        // A Steam game's own icon is better than the executable's, which is
        // often a launcher or a generic one.
        if (process.platform === "win32") {
            const steam = windowsSteamIcon(exe);
            if (steam) return steam;
        }
        const icon = await app.getFileIcon(exe, { size: "large" });
        return icon.isEmpty()
            ? null
            : { type: "image/png", data: new Uint8Array(icon.toPNG()) };
    },
    mediaCover: (ref) => richPresence.mediaCover(ref),
    mediaIcon: mediaPlayerIcon,
});
ipcMain.handle("rich-presence:image", (_e, appId, ref) =>
    presenceImages.fetchImage(appId, ref),
);
ipcMain.handle("rich-presence:status", () => richPresence.getStatus());
ipcMain.handle("rich-presence:restart-discord", () =>
    richPresence.restartDiscord(),
);
app.on("will-quit", () => richPresence.stop());

// --- Call priority -------------------------------------------------------

// Raised while a call is connected (callPriority.cjs); the page says when.
const callPriority = createCallPriority(app);
let callActive = false;
ipcMain.on("call:set-active", (e, active) => {
    callActive = !!active;
    callPriority.set(callActive, e.sender);
    // Hidden to the tray, a call with nobody talking isn't "audible" to
    // Chromium, so its timers would drop to once a second, and with them the
    // mic chain's level and drive ticks (audio/micChain.ts).
    e.sender.setBackgroundThrottling(!callActive);
});
app.on("will-quit", () => callPriority.restore());

// --- GPU (Settings > Debug) ------------------------------------------------
//
// Hardware acceleration can be switched off for GPUs whose drivers misrender
// (black video, corrupt windows). Chromium only reads it at startup, so it is
// a file in userData applied before the app is ready, and takes effect on the
// next launch.
const gpuPrefsPath = () => path.join(app.getPath("userData"), "gpu-prefs.json");

function readGpuPrefs() {
    try {
        const prefs = JSON.parse(fs.readFileSync(gpuPrefsPath(), "utf8"));
        return prefs && typeof prefs === "object" ? prefs : {};
    } catch {
        return {};
    }
}

const hardwareAccelerationAtLaunch =
    readGpuPrefs().hardwareAcceleration !== false;
// Set by the crash-loop guard below: this one run goes without the GPU.
const gpuCrashLoopAtLaunch =
    hardwareAccelerationAtLaunch && !!readGpuPrefs().gpuCrashLoopAt;
if (!hardwareAccelerationAtLaunch || gpuCrashLoopAtLaunch) {
    app.disableHardwareAcceleration();
} else {
    // Chromium gives up on the GPU after its third crash in a run, falling
    // back to software for the rest of it, and a few crashes later quits the
    // app ("GPU process isn't usable. Goodbye."). Running out of video memory
    // (a game holding it) crashes it over and over, and software video is
    // worse there than waiting, so let it keep restarting. Verified on
    // Electron 44: 20 GPU kills in a row and compositing stayed on the GPU.
    app.commandLine.appendSwitch("disable-gpu-process-crash-limit");
}

ipcMain.handle("idle:get", () => ({
    seconds: powerMonitor.getSystemIdleTime(),
    locked: powerMonitor.getSystemIdleState(1) === "locked",
}));

ipcMain.handle("gpu:info", async () => {
    let info;
    try {
        info = await app.getGPUInfo("complete");
    } catch (e) {
        info = { error: String(e?.message ?? e) };
    }
    const cl = app.commandLine;
    const switches = {};
    for (const name of [
        "enable-features",
        "disable-features",
        "use-gl",
        "use-angle",
        "disable-accelerated-video-decode",
        "ozone-platform",
        "ozone-platform-hint",
    ]) {
        if (cl.hasSwitch(name)) switches[name] = cl.getSwitchValue(name);
    }
    if (cl.hasSwitch("ignore-gpu-blocklist")) {
        switches["ignore-gpu-blocklist"] = "";
    }
    const env = {};
    for (const name of [
        "XDG_SESSION_TYPE",
        "WAYLAND_DISPLAY",
        "DISPLAY",
        "LIBVA_DRIVER_NAME",
        "LIBVA_DRIVERS_PATH",
        "NVD_BACKEND",
        "NVD_LINEAR",
        "ZAM_NVIDIA_VULKAN_VIDEO",
        "ZAM_VK_LAYER",
        "ZAM_VK_FIXUP",
        "ZAM_NVENC",
        "FLATPAK_ID",
    ]) {
        if (process.env[name]) env[name] = process.env[name];
    }
    const prefs = readGpuPrefs();
    return {
        hardwareAcceleration: prefs.hardwareAcceleration !== false,
        hardwareAccelerationAtLaunch,
        nvidiaVideo: IN_FLATPAK
            ? {
                  mode: prefs.nvidiaVideo ?? "auto",
                  activeAtLaunch: nvidiaVulkanVideo || nvidiaWaylandVideo,
                  detected: !!prefs.nvidiaDetected,
                  failedAt: prefs.nvidiaVulkanFailed ?? null,
              }
            : null,
        nvidiaEncode: IN_FLATPAK
            ? {
                  enabled: prefs.nvidiaEncode === true,
                  activeAtLaunch: nvidiaEncode,
              }
            : null,
        videoEncode:
            process.platform === "linux"
                ? {
                      enabled: prefs.videoEncode !== false,
                      activeAtLaunch: hardwareVideoEncode,
                  }
                : null,
        skiaGraphite: {
            enabled: prefs.skiaGraphite === true,
            activeAtLaunch: skiaGraphiteAtLaunch,
            failedAt: prefs.skiaGraphiteFailed ?? null,
        },
        featureStatus: app.getGPUFeatureStatus(),
        info,
        switches,
        env,
    };
});

// zam.sh reads gpu-prefs.json with a shell pattern match, so it stays compact
// JSON.stringify output (no spaces).
function writeGpuPrefs(patch) {
    const prefs = { ...readGpuPrefs(), ...patch };
    for (const k of Object.keys(prefs)) {
        if (prefs[k] === undefined) delete prefs[k];
    }
    fs.writeFileSync(gpuPrefsPath(), JSON.stringify(prefs));
}

// Settings > Debug: Chromium's memory by process and allocator, plus each
// process's resident memory as Task Manager counts it. One trace at a time:
// the recorder below and a one-off measure share it.
let memoryReportRunning = null;
function takeMemoryReport() {
    memoryReportRunning ??= (async () => {
        try {
            const processes = await recordMemoryReport(
                contentTracing,
                app.getPath("temp"),
            );
            const metrics = app.getAppMetrics();
            return {
                processes: processes.map((p) => ({
                    ...p,
                    workingSetKb:
                        metrics.find((m) => m.pid === p.pid)?.memory
                            ?.workingSetSize ?? null,
                })),
            };
        } catch (e) {
            return { error: String(e?.message ?? e) };
        } finally {
            memoryReportRunning = null;
        }
    })();
    return memoryReportRunning;
}
ipcMain.handle("gpu:memory-report", () => takeMemoryReport());

// Memory over time: a report every `intervalMs` until stopped, kept here so
// it carries on with Settings closed. Two hours at the shortest interval.
const MEMORY_SAMPLES_MAX = 1440;
let memoryRecording = null;
function memoryRecordingState(from = 0) {
    const r = memoryRecording;
    if (!r) return { running: false, samples: [] };
    return {
        running: r.timer !== null,
        intervalMs: r.intervalMs,
        startedAt: r.startedAt,
        dropped: r.dropped,
        // Index of samples[0] in the whole recording, so the renderer can
        // ask for only what it hasn't seen.
        from: Math.max(from, r.dropped),
        samples: r.samples.slice(Math.max(0, from - r.dropped)),
    };
}
async function memoryRecordingTick(r) {
    const report = await takeMemoryReport();
    if (memoryRecording !== r) return;
    r.samples.push({ at: Date.now(), ...report });
    if (r.samples.length > MEMORY_SAMPLES_MAX) {
        r.samples.shift();
        r.dropped++;
    }
}
ipcMain.handle("gpu:memory-record-start", (_e, intervalMs) => {
    if (memoryRecording?.timer) clearInterval(memoryRecording.timer);
    const ms = Math.min(Math.max(Number(intervalMs) || 10000, 5000), 300000);
    const r = {
        intervalMs: ms,
        startedAt: Date.now(),
        dropped: 0,
        samples: [],
        timer: null,
    };
    r.timer = setInterval(() => void memoryRecordingTick(r), ms);
    memoryRecording = r;
    void memoryRecordingTick(r);
    return memoryRecordingState();
});
ipcMain.handle("gpu:memory-record-stop", () => {
    if (memoryRecording?.timer) {
        clearInterval(memoryRecording.timer);
        memoryRecording.timer = null;
    }
    return memoryRecordingState(Infinity);
});
ipcMain.handle("gpu:memory-record-get", (_e, from) =>
    memoryRecordingState(Math.max(0, Number(from) || 0)),
);

// Restart Chromium's GPU process so everything is drawn again from scratch.
// NVIDIA on Linux doesn't spill video memory into system RAM, so with a game
// holding it, allocations fail and tiles come out black, white or copied from
// elsewhere on screen, often without the GPU process crashing. A fresh one
// has none of that once memory is free again. Calls carry on through it
// (onGpuProcessGone in src/lib/matrix/livekitCall.ts).
let gpuRepaintAt = 0;
const isRepaintExit = () => Date.now() - gpuRepaintAt < 5000;
function isGpuProcess(pid) {
    // A pid from another pid namespace (Flatpak's sandbox) could name an
    // unrelated process out here.
    if (process.platform !== "linux") return true;
    try {
        return fs
            .readFileSync(`/proc/${pid}/cmdline`, "utf8")
            .includes("--type=gpu-process");
    } catch {
        return false;
    }
}
function repaintGpu() {
    gpuRepaintAt = Date.now();
    const pid = app.getAppMetrics().find((m) => m.type === "GPU")?.pid;
    if (pid && isGpuProcess(pid)) {
        try {
            process.kill(pid);
            return;
        } catch {
            /* fall through */
        }
    }
    // Chromium's own way to end the GPU process, from a throwaway window
    // (loading it never finishes).
    const w = new BrowserWindow({ show: false });
    w.loadURL("chrome://gpucrash").catch(() => {});
    setTimeout(() => w.destroy(), 3000);
}
ipcMain.handle("gpu:repaint", () => repaintGpu());

ipcMain.handle("gpu:set-hardware-acceleration", (_e, enabled) => {
    writeGpuPrefs({ hardwareAcceleration: !!enabled });
});

// Read by zam.sh, which only takes "true".
ipcMain.handle("gpu:set-nvidia-encode", (_e, enabled) => {
    writeGpuPrefs({ nvidiaEncode: enabled ? true : undefined });
});

ipcMain.handle("gpu:set-video-encode", (_e, enabled) => {
    writeGpuPrefs({ videoEncode: enabled ? undefined : false });
});

ipcMain.handle("gpu:set-h264-profile-fix", (_e, enabled) => {
    writeGpuPrefs({ h264ProfileFix: enabled ? undefined : false });
});

ipcMain.handle("gpu:set-skia-graphite", (_e, enabled) => {
    writeGpuPrefs({
        skiaGraphite: enabled ? true : undefined,
        skiaGraphitePending: undefined,
        skiaGraphiteFailed: undefined,
    });
});

// "auto" | "vulkan" | "off" (see zam.sh). Choosing again forgets a fallback
// recorded after GPU crashes.
ipcMain.handle("gpu:set-nvidia-video", (_e, mode) => {
    writeGpuPrefs({
        nvidiaVideo: mode === "vulkan" || mode === "off" ? mode : undefined,
        nvidiaVulkanFailed: undefined,
    });
});

// zam.sh's sysfs check can miss NVIDIA (no connected outputs listed, odd
// driver names), so also ask Chromium which GPU it renders on. Recording it
// takes effect through zam.sh, so restart once to pick it up; the record
// stops that from repeating even if zam.sh still doesn't act on it.
async function detectNvidiaVideo() {
    const prefs = readGpuPrefs();
    if (
        !IN_FLATPAK ||
        onWayland ||
        nvidiaVulkanVideo ||
        !hardwareAccelerationAtLaunch ||
        prefs.nvidiaDetected ||
        prefs.nvidiaVideo === "off" ||
        prefs.nvidiaVulkanFailed ||
        process.env.ZAM_NVIDIA_VULKAN_VIDEO === "0"
    ) {
        return;
    }
    let info;
    try {
        info = await app.getGPUInfo("basic");
    } catch {
        return;
    }
    const devices = Array.isArray(info?.gpuDevice) ? info.gpuDevice : [];
    const active = devices.find((d) => d.active) ?? devices[0];
    if (active?.vendorId !== 0x10de) return;
    writeGpuPrefs({ nvidiaDetected: true });
    console.log("NVIDIA GPU detected; restarting for hardware video decode");
    app.relaunch({ execPath: "/app/bin/zam", args: process.argv.slice(1) });
    isQuitting = true;
    app.quit();
}

// Whether a <video> is playing (src/lib/utils/videoPlaybackWatch.ts), and
// when the last one stopped.
let videoPlaying = false;
let videoStoppedAt = 0;
ipcMain.on("gpu:video-playing", (_e, playing) => {
    if (videoPlaying && !playing) videoStoppedAt = Date.now();
    videoPlaying = !!playing;
});

// The GPU process never gives back what it has used: the video stack the
// first hardware-decoded video sets up (about 100 MB on Windows), decoders'
// memory after they close, whatever its allocators reserved. A fresh one holds
// about 50 MB. So once the window has been out of sight for a while, with no
// call and no video playing, start a fresh one (repaintGpu); what it needs
// comes back the next time it's used. Windows reports the process's committed
// memory (52 MB fresh against 250-440 MB after use, measured), so there a GPU
// process that is still small is left alone.
const GPU_RECYCLE_HIDDEN_MS = 2 * 60_000;
const GPU_RECYCLE_MIN_KB = 128 * 1024;
let gpuRecycleTimer = null;
// Once per spell out of sight: nothing new is drawn until the window is back.
let gpuRecycled = false;

function windowOutOfSight() {
    return (
        !!mainWindow &&
        !mainWindow.isDestroyed() &&
        (!mainWindow.isVisible() || mainWindow.isMinimized())
    );
}

function recycleGpuIfIdle() {
    gpuRecycleTimer = null;
    if (gpuRecycled || !windowOutOfSight()) return;
    if (callActive || videoPlaying) {
        gpuRecycleTimer = setTimeout(recycleGpuIfIdle, GPU_RECYCLE_HIDDEN_MS);
        return;
    }
    const gpu = app.getAppMetrics().find((m) => m.type === "GPU");
    if (!gpu) return;
    const privateKb = gpu.memory?.privateBytes;
    if (privateKb !== undefined && privateKb < GPU_RECYCLE_MIN_KB) return;
    gpuRecycled = true;
    repaintGpu();
}

// The page's JS heap keeps whatever garbage and caches it built up while in
// use, since nothing prompts a collection once it stops drawing. Out of sight
// for a minute, with no call, ask V8 for a full collection.
const RENDERER_TRIM_HIDDEN_MS = 60_000;
let rendererTrimTimer = null;
let rendererTrimmed = false;

async function trimRendererIfIdle() {
    rendererTrimTimer = null;
    if (rendererTrimmed || !windowOutOfSight()) return;
    if (callActive) {
        rendererTrimTimer = setTimeout(
            trimRendererIfIdle,
            RENDERER_TRIM_HIDDEN_MS,
        );
        return;
    }
    rendererTrimmed = true;
    const dbg = mainWindow.webContents.debugger;
    try {
        dbg.attach("1.3");
        // Only a collection. Memory.forciblyPurgeJavaScriptMemory frees more,
        // but it does so by destroying the page's JS contexts: the window
        // comes back as a blank grey page with no script running (verified in
        // a bare BrowserWindow: executeJavaScript times out afterwards).
        await dbg.sendCommand("HeapProfiler.collectGarbage");
    } catch (err) {
        console.error("renderer trim failed:", err);
    } finally {
        try {
            dbg.detach();
        } catch {}
    }
}

function armGpuRecycle() {
    if (!rendererTrimmed && !rendererTrimTimer) {
        rendererTrimTimer = setTimeout(
            trimRendererIfIdle,
            RENDERER_TRIM_HIDDEN_MS,
        );
    }
    if (!hardwareAccelerationAtLaunch || gpuRecycled || gpuRecycleTimer) return;
    gpuRecycleTimer = setTimeout(recycleGpuIfIdle, GPU_RECYCLE_HIDDEN_MS);
}

function disarmGpuRecycle() {
    clearTimeout(rendererTrimTimer);
    rendererTrimTimer = null;
    rendererTrimmed = false;
    clearTimeout(gpuRecycleTimer);
    gpuRecycleTimer = null;
    gpuRecycled = false;
}

// Every helper-process exit (GPU, utility, plugin...) leaves a line in main.log,
// so a crash that only shows as a blank or frozen window can be explained later.
// Listeners below still do their own work; this one only records.
app.on("child-process-gone", (_e, details) => {
    mainLog.warn(
        "child-process-gone",
        `type=${details.type} reason=${details.reason} exitCode=${details.exitCode}` +
            (details.serviceName ? ` service=${details.serviceName}` : "") +
            (details.name ? ` name=${details.name}` : ""),
    );
});

// If the Vulkan path makes the GPU process crash, Chromium falls back to
// software rendering for this run; record it so the next launch goes back to
// the GL path, unless the user chose Vulkan in Settings. The Vulkan path fails
// importing decoded frames, so only crashes while video plays count: other
// GPU crashes (some NVIDIA setups crash on shaders now and then) would
// otherwise turn hardware decoding off for nothing.
let gpuCrashes = 0;
app.on("child-process-gone", (_e, details) => {
    if (!nvidiaVulkanVideo || details.type !== "GPU") return;
    if (details.reason === "clean-exit" || details.reason === "killed") return;
    if (isRepaintExit()) return;
    if (!videoPlaying && Date.now() - videoStoppedAt > 5000) return;
    if (++gpuCrashes < 2 || readGpuPrefs().nvidiaVideo === "vulkan") return;
    writeGpuPrefs({ nvidiaVulkanFailed: Date.now() });
});

// Any GPU-process exit, crash or not, leaves the page's WebRTC video stuck in
// software until it moves its peer connections to a new window
// (src/lib/matrix/webrtcRealm.ts).
app.on("child-process-gone", (_e, details) => {
    if (details.type !== "GPU") return;
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send("gpu:process-gone", details.reason);
});

// With Chromium's crash limit off, a GPU that can't start at all (a broken
// driver) would restart forever with nothing drawn. That many exits this
// close together is a loop, not memory pressure: start over without the GPU
// for one run. Not during a call, which keeps its audio through GPU exits.
const GPU_CRASH_LOOP_EXITS = 10;
const GPU_CRASH_LOOP_MS = 60_000;
const gpuExitTimes = [];
if (gpuCrashLoopAtLaunch) writeGpuPrefs({ gpuCrashLoopAt: undefined });
app.on("child-process-gone", (_e, details) => {
    if (details.type !== "GPU" || !hardwareAccelerationAtLaunch) return;
    if (details.reason === "clean-exit" || isRepaintExit()) return;
    const now = Date.now();
    gpuExitTimes.push(now);
    while (gpuExitTimes[0] < now - GPU_CRASH_LOOP_MS) gpuExitTimes.shift();
    if (gpuExitTimes.length < GPU_CRASH_LOOP_EXITS || callActive) return;
    console.error("GPU process keeps exiting; restarting without the GPU");
    writeGpuPrefs({ gpuCrashLoopAt: now });
    relaunchApp();
});

function relaunchApp() {
    // In Flatpak, start over through the launcher so zypak and the libva
    // setup in zam.sh apply again; process.execPath is the bare Electron.
    app.relaunch(
        IN_FLATPAK
            ? { execPath: "/app/bin/zam", args: process.argv.slice(1) }
            : undefined,
    );
    isQuitting = true;
    app.quit();
}

ipcMain.on("app:relaunch", relaunchApp);

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
// requestId -> {callback, timer, audio, appTargets, sourceIds}
const pendingShareRequests = new Map();
// Per-application share audio (appAudio.cjs); null backend where there is
// none, and then "system" falls back to Electron's loopback on Windows.
const appAudio = createAppAudio(app);
app.on("will-quit", () => appAudio.stop());
ipcMain.on("share-audio:stop", () => appAudio.stop());
// A reload or a crashed page can't stop its share any more.
app.on("web-contents-created", (_e, contents) => {
    const end = () => {
        if (mainWindow && contents === mainWindow.webContents) appAudio.stop();
    };
    contents.on("render-process-gone", end);
    contents.on("did-navigate", end);
});
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

// What "system" means here: Zam's own capture that leaves Zam out, else
// Electron's loopback (Windows only; asking for it elsewhere would fail the
// whole request), else nothing.
function systemAudioMode(backend) {
    if (backend) return "exclude-self";
    return process.platform === "win32" ? "loopback" : null;
}

// Tell the page how the share's audio turned out, so it isn't left waiting:
// appAudio.cjs sends "share-audio:ready" for a capture, this for the rest
// ("failed": the capture the user picked didn't start).
function sendShareAudioNone(requestId, kind = "none") {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
        mainWindow.webContents.send("share-audio:ready", {
            id: requestId,
            kind,
        });
    } catch (err) {
        console.error("share audio notify failed:", err);
    }
}

function resolveShareRequest(requestId, sourceId, sourceName, audioChoice) {
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
    const backend = pending.audio ? appAudio.backend : null;
    // Like the source, an app target can only be one this request offered.
    const plan = pending.audio
        ? resolveShareAudio(
              audioChoice,
              sourceId,
              {
                  system: pending.audio.system,
                  systemTarget: backend?.systemTarget ?? null,
                  windowTarget: (id) => backend?.windowTarget(id) ?? null,
              },
              pending.appTargets,
          )
        : { kind: "none" };
    if (plan.kind === "loopback") streams.audio = "loopback";
    try {
        pending.callback(streams);
    } catch (err) {
        console.error("screen-share grant failed:", err);
    }
    if (!pending.audio) return;
    if (plan.kind !== "capture" || !backend || !mainWindow) {
        sendShareAudioNone(requestId);
        return;
    }
    backend
        .start(plan.target, mainWindow.webContents, requestId)
        .then((ok) => {
            if (!ok) sendShareAudioNone(requestId, "failed");
        })
        .catch((err) => {
            console.error("share audio capture failed:", err);
            sendShareAudioNone(requestId, "failed");
        });
}

function setupDisplayMediaHandler() {
    session.defaultSession.setDisplayMediaRequestHandler(
        async (request, callback) => {
            let sources = [];
            const audioRequested = !!request.audioRequested;
            const backend = audioRequested ? appAudio.backend : null;
            const [, apps] = await Promise.all([
                desktopCapturer
                    .getSources({
                        types: ["screen", "window"],
                        thumbnailSize: { width: 320, height: 180 },
                    })
                    .then((s) => (sources = s))
                    .catch((err) =>
                        console.error(
                            "desktopCapturer.getSources failed:",
                            err,
                        ),
                    ),
                backend
                    ? backend.listApps().catch((err) => {
                          console.error("share audio app list failed:", err);
                          return [];
                      })
                    : [],
            ]);
            const audio = audioRequested
                ? {
                      system: systemAudioMode(backend),
                      windowApp: !!backend && backend.name === "wasapi",
                      apps: apps.map((a) => ({
                          id: a.id,
                          name: a.name,
                          active: a.active,
                      })),
                  }
                : null;
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
                audio,
                appTargets: new Map(apps.map((a) => [a.id, a.target])),
                sourceIds: new Set(sources.map((s) => s.id)),
            });
            // From here the pending entry (and its 120s timer) already exist,
            // so a throw — a disposed thumbnail, a webContents torn down
            // between the guard above and now — would leave getDisplayMedia()
            // hanging with no picker until the timeout. Deny at once instead.
            try {
                mainWindow.webContents.send("screenshare:request", {
                    requestId,
                    audioRequested,
                    audio,
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

// sourceName is display-only (it labels the granted stream); the capture
// target is authorised by sourceId alone. Even so it comes from the renderer,
// so clamp its length and strip control characters (audit SEC-L11) — a
// compromised renderer must not be able to inject newlines / control sequences
// into logs or any UI that later shows the stream name.
function sanitizeSourceName(raw) {
    if (typeof raw !== "string") return "";
    // Drop C0 control chars + DEL (newlines/tabs included), then clamp length.
    let out = "";
    for (const ch of raw) {
        const code = ch.codePointAt(0);
        if (code >= 0x20 && code !== 0x7f) out += ch;
        if (out.length >= 256) break;
    }
    return out;
}

// The payload comes from the renderer and is therefore untrusted: validate
// every field before it reaches a Map key or the capture callback. A throw in
// an ipcMain listener is an uncaught main-process exception — it kills the app.
ipcMain.on("screenshare:respond", (_e, payload) => {
    const { requestId, sourceId, sourceName, audio } = payload || {};
    const id = Number(requestId);
    // Unknown/stale/garbage ids stay a silent no-op, as before.
    if (!Number.isFinite(id) || !pendingShareRequests.has(id)) return;
    // Only a non-empty string is a pick; anything else is a cancellation.
    const picked = typeof sourceId === "string" && sourceId ? sourceId : null;
    const name = sanitizeSourceName(sourceName);
    // Checked against what this request offered, in resolveShareAudio.
    const audioChoice =
        typeof audio === "string" ? audio.slice(0, 300) : "none";
    resolveShareRequest(id, picked, name, audioChoice);
});

// Only ever hand http(s) URLs to the OS shell (audit SEC-M7). Blocking every
// other scheme stops a hostile message link from launching an arbitrary OS
// handler via ftp:/magnet:/mailto:/… — the renderer's sanitizer already strips
// file:/smb:/javascript: from message hrefs, so this is defense-in-depth behind
// it. Also block loopback/localhost/private networks so a link can't reach a
// service bound to the user's own machine or LAN (localhost/LAN SSRF). Anything
// that fails to parse, or is not a safe web URL, is dropped (never opened).
// Implementation in ./serverGuards.cjs.
function openExternalSafely(rawUrl) {
    if (isSafeExternalUrl(rawUrl)) shell.openExternal(rawUrl);
}

// --- Window state --------------------------------------------------------
//
// Size, position and maximised state are saved to userData and restored on
// the next launch. Position is best-effort: on Wayland the compositor places
// windows itself and ignores it, but size and maximised still apply.

function windowStatePath() {
    return path.join(app.getPath("userData"), "window-state.json");
}

function loadWindowState() {
    let text = "";
    try {
        text = fs.readFileSync(windowStatePath(), "utf8");
    } catch {
        // First launch: no file yet, use the defaults.
    }
    return fitToDisplays(
        parseWindowState(text),
        screen.getAllDisplays().map((d) => d.workArea),
    );
}

function saveWindowState(win) {
    if (!win || win.isDestroyed()) return;
    // Normal bounds = the un-maximised size/position, so un-maximising after
    // a restart goes back to what the user had.
    const b = win.getNormalBounds();
    const state = {
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        maximized: win.isMaximized(),
    };
    try {
        fs.writeFileSync(windowStatePath(), JSON.stringify(state));
    } catch (err) {
        console.error("Failed to save window state:", err);
    }
}

// A renderer that dies (crash, out-of-memory kill) is reloaded, at most this
// many times a minute, so a page that dies on load cannot loop.
const RENDERER_RELOAD_LIMIT = 3;
const RENDERER_RELOAD_WINDOW_MS = 60_000;
const rendererReloadTimes = [];

async function createWindow() {
    const url = await startServer();
    const savedState = loadWindowState();

    mainWindow = new BrowserWindow({
        width: savedState.width,
        height: savedState.height,
        ...(savedState.x !== undefined
            ? { x: savedState.x, y: savedState.y }
            : {}),
        minWidth: 940,
        minHeight: 600,
        icon: ICON_PATH,
        autoHideMenuBar: true,
        backgroundColor: "#313338",
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            // Explicit for durability (audit SEC-L10): the renderer runs in the
            // OS sandbox. This is already the modern-Electron default, and the
            // preload only uses contextBridge/ipcRenderer (both sandbox-safe),
            // so pinning it changes no behaviour but survives a future default
            // flip or a preload that grows Node usage.
            sandbox: true,
            preload: path.join(__dirname, "preload.cjs"),
            // backgroundThrottling stays on (the default): hidden to the tray
            // the page stops drawing frames and its timers fire at most once a
            // second. Chromium's later once-a-minute stage, which would make
            // calls ring late, is switched off below (IntensiveWakeUpThrottling).
        },
    });
    proxyManager.applyIpPolicy();

    if (savedState.maximized) mainWindow.maximize();

    // Save on every size/position change (debounced: resize and move fire
    // continuously while dragging), and once more on close below.
    let saveStateTimer = null;
    const scheduleStateSave = () => {
        clearTimeout(saveStateTimer);
        saveStateTimer = setTimeout(() => saveWindowState(mainWindow), 500);
    };
    for (const ev of ["resize", "move", "maximize", "unmaximize"])
        mainWindow.on(ev, scheduleStateSave);

    // Belt and braces for the taskbar button: the constructor option is applied
    // lazily on some Windows setups, an explicit setIcon always sticks.
    const windowIcon = nativeImage.createFromPath(ICON_PATH);
    if (!windowIcon.isEmpty() && process.platform !== "darwin")
        mainWindow.setIcon(windowIcon);
    // Windows resolves a taskbar button's icon through the Start-menu shortcut
    // registered for the app's AppUserModelID, and a stale shortcut (a dead
    // portable/temp-dir one, say) turns it blank. Pin the icon explicitly.
    if (process.platform === "win32") {
        try {
            mainWindow.setAppDetails({
                appId: APP_USER_MODEL_ID,
                appIconPath: path.join(ICONS_DIR, "icon.ico"),
                appIconIndex: 0,
                // Windows ignores the relaunch icon unless a relaunch command
                // and display name are supplied alongside it.
                relaunchCommand: app.isPackaged
                    ? `"${process.execPath}"`
                    : `"${process.execPath}" "${app.getAppPath()}"`,
                relaunchDisplayName: "Zam",
            });
        } catch (err) {
            console.error("setAppDetails failed:", err);
        }
    }

    // A taskbar flash lasts until the user comes back; clear it (Linux never
    // clears it by itself) as soon as they do.
    // Window events can land after the window was destroyed (closed while a
    // focus or show was still queued); those must not touch it.
    const liveWindow = () =>
        mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
    mainWindow.on("focus", () => {
        const win = liveWindow();
        if (!win) return;
        win.flashFrame(false);
        globalHotkeys.recheck();
    });
    mainWindow.on("show", () => liveWindow()?.flashFrame(false));

    mainWindow.on("hide", () => {
        if (liveWindow()) armGpuRecycle();
    });
    mainWindow.on("minimize", () => {
        if (liveWindow()) armGpuRecycle();
    });
    mainWindow.on("show", () => {
        if (liveWindow()) disarmGpuRecycle();
    });
    mainWindow.on("restore", () => {
        if (liveWindow()) disarmGpuRecycle();
    });

    // A renderer exit that is not a clean close or a kill reloads the page once,
    // so the window recovers rather than sitting dead. Logged either way.
    mainWindow.webContents.on("render-process-gone", (_e, details) => {
        mainLog.error(
            "render-process-gone",
            `reason=${details.reason} exitCode=${details.exitCode}`,
        );
        if (details.reason === "clean-exit" || details.reason === "killed")
            return;
        const win = liveWindow();
        if (!win) return;
        const now = Date.now();
        while (
            rendererReloadTimes.length &&
            rendererReloadTimes[0] < now - RENDERER_RELOAD_WINDOW_MS
        ) {
            rendererReloadTimes.shift();
        }
        if (rendererReloadTimes.length >= RENDERER_RELOAD_LIMIT) {
            mainLog.error(
                "render-process-gone: reload limit reached, not reloading",
            );
            return;
        }
        rendererReloadTimes.push(now);
        win.webContents.reload();
    });
    mainWindow.webContents.on("unresponsive", () =>
        mainLog.warn("renderer unresponsive"),
    );
    mainWindow.webContents.on("responsive", () =>
        mainLog.info("renderer responsive again"),
    );

    mainWindow.loadURL(url);

    const appOrigin = new URL(url).origin;

    // Open target=_blank / window.open links in the system browser, not a new window.
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        openExternalSafely(url);
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
            openExternalSafely(navUrl);
        }
    });

    // Electron shows no context menu by default; build a Chromium-like one
    // (links, images, text editing, spellcheck) so right-click works.
    mainWindow.webContents.on("context-menu", (_e, params) => {
        const wc = mainWindow.webContents;
        const items = [];
        const section = (group) => {
            if (!group.length) return;
            if (items.length) items.push({ type: "separator" });
            items.push(...group);
        };
        const { editFlags } = params;

        if (params.misspelledWord) {
            section([
                ...params.dictionarySuggestions.slice(0, 5).map((word) => ({
                    label: word,
                    click: () => wc.replaceMisspelling(word),
                })),
                {
                    label: "Add to dictionary",
                    click: () =>
                        wc.session.addWordToSpellCheckerDictionary(
                            params.misspelledWord,
                        ),
                },
            ]);
        }
        if (params.linkURL) {
            section([
                ...(isSafeExternalUrl(params.linkURL)
                    ? [
                          {
                              label: "Open link",
                              click: () => openExternalSafely(params.linkURL),
                          },
                      ]
                    : []),
                {
                    label: "Copy link",
                    click: () =>
                        clipboard.writeText(params.linkURL).catch(() => {}),
                },
            ]);
        }
        if (params.mediaType === "image" && params.srcURL) {
            section([
                {
                    label: "Copy image",
                    click: () => wc.copyImageAt(params.x, params.y),
                },
                {
                    label: "Save image as…",
                    // Not wc.downloadURL: homeserver media needs the access
                    // token (added by the renderer's service worker, which a
                    // main-process download bypasses), so the server would
                    // hand back a JSON error. The renderer fetches it with
                    // auth and saves it instead.
                    click: () =>
                        wc.send("context-menu:save-image", params.srcURL),
                },
            ]);
        }
        if (params.isEditable) {
            section([
                // Always enabled: the composer keeps its own undo history
                // (Chromium's stack is empty there) and handles the
                // historyUndo/historyRedo input these roles dispatch.
                { role: "undo" },
                { role: "redo" },
                { type: "separator" },
                { role: "cut", enabled: editFlags.canCut },
                { role: "copy", enabled: editFlags.canCopy },
                { role: "paste", enabled: editFlags.canPaste },
                { role: "selectAll", enabled: editFlags.canSelectAll },
            ]);
        } else if (params.selectionText.trim()) {
            section([{ role: "copy" }]);
        }
        if (items.length)
            Menu.buildFromTemplate(items).popup({ window: mainWindow });
    });

    // Close button (X): hide to the system tray, or quit, per the device-local
    // "minimise to tray on close" preference (default ON). An explicit quit
    // (tray Quit / before-quit / quit-and-install sets isQuitting) always
    // closes. Mirrors resolveWindowCloseAction in src/lib/utils/trayClose.ts.
    mainWindow.on("close", (e) => {
        saveWindowState(mainWindow);
        if (!isQuitting && minimizeToTrayOnClose) {
            e.preventDefault();
            mainWindow.hide();
        }
    });
}

// Tray glyph: white bubble with a black outline (visible on light and dark
// taskbars), one bitmap per DPI step so it is never resampled by the OS. macOS
// gets a black template image that the menu bar tints itself.
function trayImage(unread) {
    if (process.platform === "darwin") {
        const img = nativeImage.createFromPath(
            path.join(ICONS_DIR, "trayTemplate.png"),
        );
        img.setTemplateImage(true);
        return img;
    }
    const img = nativeImage.createEmpty();
    for (const [size, scaleFactor] of [
        [16, 1],
        [24, 1.5],
        [32, 2],
        [48, 3],
        [64, 4],
    ]) {
        const rep = nativeImage.createFromPath(
            path.join(ICONS_DIR, `tray-${unread ? "unread-" : ""}${size}.png`),
        );
        if (rep.isEmpty()) continue;
        img.addRepresentation({
            scaleFactor,
            width: size,
            height: size,
            buffer: rep.toPNG(),
        });
    }
    return img;
}

function createTray() {
    const img = trayImage(false);
    tray = new Tray(
        img.isEmpty() ? nativeImage.createFromPath(ICON_PATH) : img,
    );
    tray.setToolTip("Zam");
    tray.setContextMenu(
        Menu.buildFromTemplate([
            { label: "Show", click: showWindow },
            // Reachable when the window itself is drawn too badly to use.
            { label: "Repaint", click: repaintGpu },
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
// Chromium ships a JPEG XL decoder (jxl-rs) but keeps it behind a feature
// flag; switch it on so `<img>` renders image/jxl natively. Must be set before
// the app is ready. Other platforms fall back to src/lib/utils/jxl.ts.
// appendSwitch replaces an existing value, so merge with any --enable-features
// the user launched with instead of dropping it.
const features = [
    app.commandLine.getSwitchValue("enable-features"),
    "JXLImageFormat",
];
// Chromium skips NVIDIA render nodes for VA-API video decode unless this is on,
// because nvidia-vaapi-driver releases before 0.0.18 handed it surfaces it
// couldn't import. The Flatpak bundles 0.0.18 (flatpak/moe.crafty.matrix.yml),
// so turn it on there, but only for the X11 Vulkan path below: NVIDIA hardware
// decode on Wayland doesn't work yet, so Wayland decodes in software. Outside
// Flatpak the host's driver may be older, so leave it off. Electron runs on
// Wayland in a Wayland session (Electron 38+ default) unless told otherwise.
const ozone =
    app.commandLine.getSwitchValue("ozone-platform") ||
    app.commandLine.getSwitchValue("ozone-platform-hint");
const onWayland =
    ozone && ozone !== "auto"
        ? ozone === "wayland"
        : !!process.env.WAYLAND_DISPLAY ||
          process.env.XDG_SESSION_TYPE === "wayland";
// Chromium's GL path can't show NVIDIA's decoded frames: under X11 it hands
// them to the X server (GLX has no dma-buf import) and they come out black
// (github.com/elFarto/nvidia-vaapi-driver/issues/463); under Wayland it wants
// VA-API post-processing, which nvidia-vaapi-driver lacks, and decodes in
// software. Its Vulkan path imports them itself. zam.sh sets
// ZAM_NVIDIA_VULKAN_VIDEO when NVIDIA drives the screens (or Settings > Debug
// asks for it), along with what NVIDIA's Vulkan driver needs for that import
// (pitch-linear frames, our Vulkan layer's usage fixup).
// VaapiIgnoreDriverChecks: Chromium only allows VA-API with Vulkan on Intel.
// Not on Wayland: Chromium's Wayland platform is incompatible with Vulkan
// ("--ozone-platform=wayland is not compatible with Vulkan"), GBM then fails to
// allocate buffers and the window shows no video or a stale copy of the screen.
const nvidiaVulkanVideo =
    IN_FLATPAK && !onWayland && process.env.ZAM_NVIDIA_VULKAN_VIDEO === "1";
// Wayland: Chromium's GL path can import NV12 dma-bufs there (EGL), so the
// Vulkan setup isn't needed, only the VA-API-on-NVIDIA switch. Untested on
// hardware, so only when Settings > Debug asks for it.
const nvidiaWaylandVideo =
    IN_FLATPAK && onWayland && readGpuPrefs().nvidiaVideo === "vulkan";
if (nvidiaVulkanVideo || nvidiaWaylandVideo) {
    features.push("VaapiOnNvidiaGPUs");
}
if (nvidiaVulkanVideo) {
    features.push(
        "Vulkan",
        "VulkanFromANGLE",
        "DefaultANGLEVulkan",
        "VaapiIgnoreDriverChecks",
    );
    if (!app.commandLine.hasSwitch("use-angle")) {
        app.commandLine.appendSwitch("use-angle", "vulkan");
    }
}
// Chromium only encodes video on the GPU under Linux (VA-API) behind this
// flag; Windows and macOS already do by default. WebRTC (calls, screen
// shares) and WebCodecs use it for the codecs the driver can encode, and
// fall back to software for the rest. Settings > Debug can turn it off for
// drivers that produce broken streams.
const hardwareVideoEncode =
    process.platform === "linux" &&
    hardwareAccelerationAtLaunch &&
    readGpuPrefs().videoEncode !== false;
if (hardwareVideoEncode) features.push("AcceleratedVideoEncoder");
// Windows: Chromium only offers the GPU encoder H.264 Constrained Baseline
// (profile-level-id 42e01f, what LiveKit's server answers with) behind this
// flag; without it that format goes to OpenH264 in software. Linux and
// Android have it on already. The page also rewrites the answer to plain
// Baseline (utils/h264Profile) for NVIDIA, which Chromium skips for CBP, and
// for the web and Android builds. Settings > Debug turns both off.
const h264Cbp =
    process.platform === "win32" &&
    hardwareAccelerationAtLaunch &&
    readGpuPrefs().h264ProfileFix !== false;
if (h264Cbp) features.push("PlatformH264CbpEncoding");
// NVIDIA in Flatpak: zam.sh put our NVENC encoding driver in front of
// nvidia-vaapi-driver (flatpak/va-nvenc) and set ZAM_NVENC. Chromium only opens
// NVIDIA render nodes with VaapiOnNvidiaGPUs; without the Vulkan path its
// decoded frames would then render black (see above), so decode stays in
// software and VA-API only encodes.
const nvidiaEncode =
    IN_FLATPAK && hardwareVideoEncode && process.env.ZAM_NVENC === "1";
if (nvidiaEncode) {
    if (!features.includes("VaapiOnNvidiaGPUs")) {
        features.push("VaapiOnNvidiaGPUs");
    }
    if (!nvidiaVulkanVideo && !nvidiaWaylandVideo) {
        app.commandLine.appendSwitch("disable-accelerated-video-decode");
    }
}
// Skia's Graphite backend (Dawn: D3D11/D3D12/Metal/Vulkan) instead of Ganesh,
// for debugging rendering. Needs hardware acceleration; off by default.
// If it breaks the window the settings can't be reached to turn it off, so a
// launch that never got confirmed (see below) or a GPU crash switches it off
// for good, and --no-skia-graphite / ZAM_NO_SKIA_GRAPHITE=1 force it off.
const skiaGraphiteForcedOff =
    process.argv.includes("--no-skia-graphite") ||
    process.env.ZAM_NO_SKIA_GRAPHITE === "1";
{
    const prefs = readGpuPrefs();
    if (prefs.skiaGraphite === true && prefs.skiaGraphitePending) {
        writeGpuPrefs({
            skiaGraphite: undefined,
            skiaGraphitePending: undefined,
            skiaGraphiteFailed: Date.now(),
        });
    }
}
const skiaGraphiteAtLaunch =
    hardwareAccelerationAtLaunch &&
    !skiaGraphiteForcedOff &&
    readGpuPrefs().skiaGraphite === true;
if (skiaGraphiteAtLaunch) {
    // Chromium ignores the feature on desktop Linux ("not-yet-supported
    // platform", IsSkiaGraphiteSupportedByDevice in gpu_finch_features.cc);
    // only the switch turns it on there. On Windows either works (D3D11).
    features.push("SkiaGraphite");
    app.commandLine.appendSwitch("enable-skia-graphite");
    writeGpuPrefs({ skiaGraphitePending: Date.now() });
    // A run that stays up this long drew fine; a closed window counts too.
    const confirmGraphite = () =>
        writeGpuPrefs({ skiaGraphitePending: undefined });
    setTimeout(confirmGraphite, 20_000).unref();
    app.on("before-quit", confirmGraphite);
    app.on("child-process-gone", (_e, details) => {
        if (details.type !== "GPU") return;
        if (details.reason === "clean-exit" || details.reason === "killed") {
            return;
        }
        if (isRepaintExit()) return;
        writeGpuPrefs({
            skiaGraphite: undefined,
            skiaGraphitePending: undefined,
            skiaGraphiteFailed: Date.now(),
        });
    });
}
app.commandLine.appendSwitch(
    "enable-features",
    features.filter(Boolean).join(","),
);
// A window hidden for 5 minutes gets its chained timers cut to one wake-up a
// minute, which delays sync (and so incoming call rings) while Zam sits in the
// tray. Without it, hidden timers still run once a second.
app.commandLine.appendSwitch(
    "disable-features",
    [
        app.commandLine.getSwitchValue("disable-features"),
        "IntensiveWakeUpThrottling",
    ]
        .filter(Boolean)
        .join(","),
);

// Started by a Flatpak update (restartIntoFlatpakUpdate): the old version is
// still quitting and holds the lock, and two processes must never share the
// profile, so wait for it instead of handing over and quitting.
const AFTER_UPDATE_WAIT_MS = 30 * 1000;
const AFTER_UPDATE_RETRY_MS = 250;

if (app.requestSingleInstanceLock()) startApp();
else if (process.argv.includes(AFTER_UPDATE_FLAG)) {
    const deadline = Date.now() + AFTER_UPDATE_WAIT_MS;
    const retry = () => {
        if (app.requestSingleInstanceLock()) startApp();
        else if (Date.now() > deadline) app.quit();
        else setTimeout(retry, AFTER_UPDATE_RETRY_MS);
    };
    setTimeout(retry, AFTER_UPDATE_RETRY_MS);
} else app.quit();

function startApp() {
    app.on("second-instance", (_e, argv) => {
        // The update we just started, waiting for this process to quit.
        if (!argv.includes(AFTER_UPDATE_FLAG)) showWindow();
    });

    app.whenReady().then(() => {
        // Required on Windows for native (Web Notification API) notifications
        // to display and be attributed to the app.
        app.setAppUserModelId(APP_USER_MODEL_ID);
        // Must be installed before any renderer can call getDisplayMedia().
        setupDisplayMediaHandler();
        // Before the server starts: it serves whichever UI this picks.
        setupBundleUpdater();
        // The proxy first, so the page's first requests already use it.
        proxyManager.apply().finally(() => createWindow());
        createTray();
        setupAutoUpdater();
        detectNvidiaVideo();
        autostart.refresh();
    });

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
        else showWindow();
    });

    app.on("before-quit", () => {
        isQuitting = true;
        globalHotkeys.stop();
    });

    // With minimise-to-tray ON the window is only hidden on a normal close (X),
    // so the normal-close path never reaches here. This fires when the window is
    // actually destroyed: the toggle is OFF (quit-on-close) — then quit for
    // real — or on an explicit quit (tray Quit / before-quit / quit-and-install),
    // where the guard below no-ops because that path already called app.quit().
    // No macOS stay-resident exception: the tray is this app's only always-on
    // affordance, and it is gone once the app quits.
    app.on("window-all-closed", () => {
        if (!minimizeToTrayOnClose) app.quit();
    });
}
