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
} = require("electron");
const { autoUpdater } = require("electron-updater");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { resolveStaticPath, isSafeExternalUrl } = require("./serverGuards.cjs");
const { parseWindowState, fitToDisplays } = require("./windowState.cjs");
const { registerPluginNative } = require("./pluginNative.cjs");
const { registerGlobalHotkeys } = require("./globalHotkeys.cjs");
const { createUpdateSchedule } = require("./updateSchedule.cjs");
const { createCallPriority } = require("./callPriority.cjs");
const { createAppAudio } = require("./appAudio.cjs");
const { resolveShareAudio } = require("./shareAudio.cjs");

const BUILD_DIR = path.join(__dirname, "..", "build");
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
            let filePath = resolveStaticPath(BUILD_DIR, req.url || "/");
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

// Plugins' native code (zam.native), after the user agrees.
registerPluginNative(ipcMain, () => mainWindow);

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

// Inside Flatpak the app is updated by `flatpak update` from our repo, and
// electron-updater has nothing it can replace (it only updates AppImages on
// Linux). Every updater entry point is a no-op there, and the preload leaves
// `desktop.updates` out so Settings doesn't offer the control at all.
const IN_FLATPAK = !!process.env.FLATPAK_ID;

// Post a status object to the current window (reassigned by createWindow).
// The latest status, so a check asked for mid-download (opening About) can
// repeat it instead of flipping the UI back to "available" while progress
// events keep arriving.
let lastUpdateStatus = null;

function sendUpdateStatus(payload) {
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
    if (!app.isPackaged || IN_FLATPAK) return;
    const phase = lastUpdateStatus?.phase;
    if (phase === "downloading" || phase === "downloaded") {
        sendUpdateStatus(lastUpdateStatus);
        return;
    }
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
    if (!app.isPackaged || IN_FLATPAK) return;

    autoUpdater.autoInstallOnAppQuit = true;
    // Fail-safe default: stay OFF until the renderer seeds the persisted preference at boot (see app shell onMount). Prevents a forced silent download when the user has turned auto-updates OFF but hasn't opened Settings before the launch check.
    autoUpdater.autoDownload = false;
    // Integrity invariant (audit SEC-M8): electron-updater verifies the release
    // signature by default — Authenticode on Windows, code signing on macOS —
    // and this build NEVER disables it (no verifyUpdateCodeSignature override,
    // no flag that turns the check off). Also refuse a downgrade so a
    // compromised update feed cannot force an older, validly-signed but
    // vulnerable build onto the user. (Linux AppImage has no built-in signer
    // check — a documented gap tracked separately as AppImage signing, not
    // addressed in this file.)
    autoUpdater.allowDowngrade = false;

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
        // A signature / integrity verification failure must never be folded
        // silently into a generic update error (audit SEC-M8). electron-updater
        // rejects an update whose signature does not match the expected
        // publisher; log those loudly and distinctly so a tampered or
        // mis-signed release is visible in the main-process log rather than
        // looking like an ordinary network hiccup.
        const message = err?.message ?? String(err);
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
    if (!app.isPackaged || IN_FLATPAK) return;
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
    // The window's close handler hides to tray unless isQuitting is set, so
    // set it first (mirrors the tray Quit item) or quitAndInstall would just
    // minimise instead of restarting.
    isQuitting = true;
    autoUpdater.quitAndInstall();
});

// --- Call priority -------------------------------------------------------

// Raised while a call is connected (callPriority.cjs); the page says when.
const callPriority = createCallPriority(app);
ipcMain.on("call:set-active", (e, active) => {
    callPriority.set(!!active, e.sender);
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
if (!hardwareAccelerationAtLaunch) app.disableHardwareAcceleration();

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

ipcMain.handle("gpu:set-hardware-acceleration", (_e, enabled) => {
    writeGpuPrefs({ hardwareAcceleration: !!enabled });
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

// If the Vulkan path makes the GPU process crash, Chromium falls back to
// software rendering for this run; record it so the next launch goes back to
// the GL path, unless the user chose Vulkan in Settings.
let gpuCrashes = 0;
app.on("child-process-gone", (_e, details) => {
    if (!nvidiaVulkanVideo || details.type !== "GPU") return;
    if (details.reason === "clean-exit" || details.reason === "killed") return;
    if (++gpuCrashes < 2 || readGpuPrefs().nvidiaVideo === "vulkan") return;
    writeGpuPrefs({ nvidiaVulkanFailed: Date.now() });
});

ipcMain.on("app:relaunch", () => {
    // In Flatpak, start over through the launcher so zypak and the libva
    // setup in zam.sh apply again; process.execPath is the bare Electron.
    app.relaunch(
        IN_FLATPAK
            ? { execPath: "/app/bin/zam", args: process.argv.slice(1) }
            : undefined,
    );
    isQuitting = true;
    app.quit();
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
    mainWindow.on("focus", () => {
        mainWindow.flashFrame(false);
        globalHotkeys.recheck();
    });
    mainWindow.on("show", () => mainWindow.flashFrame(false));

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
app.commandLine.appendSwitch(
    "enable-features",
    features.filter(Boolean).join(","),
);

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on("second-instance", showWindow);

    app.whenReady().then(() => {
        // Required on Windows for native (Web Notification API) notifications
        // to display and be attributed to the app.
        app.setAppUserModelId(APP_USER_MODEL_ID);
        // Must be installed before any renderer can call getDisplayMedia().
        setupDisplayMediaHandler();
        createWindow();
        createTray();
        setupAutoUpdater();
        detectNvidiaVideo();
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
