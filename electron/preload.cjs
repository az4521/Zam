// Minimal renderer bridge. Two capabilities are exposed: "restore the window
// from the tray", which the incoming-call notification needs (window.focus()
// does not un-hide a hidden BrowserWindow), and the screen-share source
// picker, which Electron requires the main process to arbitrate.

const { contextBridge, ipcRenderer } = require("electron");

// Page visibility for main.cjs's out-of-sight memory trims. Unlike the
// window's own state it is also hidden while other windows fully cover it
// (Chromium's occlusion tracking on Windows and macOS).
const sendPageHidden = () =>
    ipcRenderer.send("window:page-hidden", document.hidden);
document.addEventListener("visibilitychange", sendPageHidden);
window.addEventListener("DOMContentLoaded", sendPageHidden);

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

// Native window share (nativeShare.cjs). The helper's frames come over a
// MessagePort posted to the page, tagged with the grant's request info;
// src/lib/desktopScreenShare.ts takes it from there.
ipcRenderer.on("native-share:port", (e, meta) => {
    if (!meta || typeof meta !== "object" || !e.ports[0]) return;
    const info = {
        requestId: Number(meta.requestId),
        width: Number(meta.width),
        height: Number(meta.height),
        encoder: typeof meta.encoder === "string" ? meta.encoder : "",
        hardware: meta.hardware === true,
    };
    window.postMessage(
        { tag: "zam:native-share-port", info },
        window.location.origin,
        [e.ports[0]],
    );
});

contextBridge.exposeInMainWorld("desktop", {
    showWindow: () => ipcRenderer.send("show-window"),
    // Discord's synced favourite GIFs (discordFavourites.cjs).
    discordFavourites: {
        read: () => ipcRenderer.invoke("discord-favourites:read"),
    },
    // The call's pop-out window (main.cjs, CALL_PIP_FRAME). Main moves it with
    // the cursor during a drag and reports a drop back over the app's window.
    callPip: {
        spawnSize: (size) => ipcRenderer.send("call-pip:spawn-size", size),
        follow: (grab) => ipcRenderer.send("call-pip:follow", grab),
        onDocked: (cb) => {
            const listener = (_event, centre) => cb(centre);
            ipcRenderer.on("call-pip:docked", listener);
            return () =>
                ipcRenderer.removeListener("call-pip:docked", listener);
        },
    },
    pluginNative: {
        platform: `${process.platform}-${process.arch}`,
        open: (req) => ipcRenderer.invoke("plugin-native:open", req),
        remove: (pluginId) =>
            ipcRenderer.invoke("plugin-native:remove", String(pluginId)),
    },
    // Plugins' raw sockets (pluginSockets.cjs, zam.network).
    pluginSockets: {
        tcp: (req) => ipcRenderer.invoke("plugin-sockets:tcp", req),
        udp: (req) => ipcRenderer.invoke("plugin-sockets:udp", req),
        write: (id, data) =>
            ipcRenderer.invoke("plugin-sockets:write", id, data),
        send: (id, host, port, data) =>
            ipcRenderer.invoke("plugin-sockets:send", id, host, port, data),
        close: (id) => ipcRenderer.invoke("plugin-sockets:close", id),
        closePlugin: (pluginId) =>
            ipcRenderer.invoke("plugin-sockets:close-plugin", String(pluginId)),
        onEvent: (cb) => {
            const h = (_e, msg) => cb(msg);
            ipcRenderer.on("plugin-sockets:event", h);
            return () => ipcRenderer.removeListener("plugin-sockets:event", h);
        },
    },
    // Plugins' rules for embedded pages (pluginFrames.cjs, zam.frames).
    pluginFrames: {
        add: (rule) => ipcRenderer.invoke("plugin-frames:add", rule),
        remove: (id) => ipcRenderer.invoke("plugin-frames:remove", String(id)),
    },
    sso: {
        // The local server caught an SSO redirect; `url` is its path + query.
        onCallback: (cb) => {
            const h = (_e, url) => cb(url);
            ipcRenderer.on("sso:callback", h);
            return () => ipcRenderer.removeListener("sso:callback", h);
        },
    },
    // Updates: a web bundle where the shell allows it (bundleUpdater.cjs),
    // else the installer, or in Flatpak the Flatpak portal.
    updates: {
        check: () => ipcRenderer.send("updates:check"),
        download: () => ipcRenderer.send("updates:download"),
        // Applies what was downloaded: a restart into a new installer, or just
        // a reload for a web bundle (the status says which).
        restartToInstall: () => ipcRenderer.send("updates:quit-and-install"),
        setAutoDownload: (enabled) =>
            ipcRenderer.send("updates:set-auto", !!enabled),
        // The page loaded, so a web bundle just applied is good.
        bundleReady: () => ipcRenderer.send("updates:bundle-ready"),
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
        // Settings for the native window capture (nativeShare.cjs), sent
        // before a share; main validates and applies them at the next grant.
        configureNative: (cfg) =>
            ipcRenderer.send("native-share:configure", cfg),
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
    // Rich presence sources (richPresence.cjs): MSC4544 apps and arRPC.
    richPresence: {
        configure: (want) =>
            ipcRenderer.invoke("rich-presence:configure", {
                local: !!want?.local,
                arrpc: !!want?.arrpc,
                scan: !!want?.scan,
                fake: !!want?.fake,
                media: !!want?.media,
                steam: !!want?.steam,
                autoRestartDiscord: !!want?.autoRestartDiscord,
                userId: String(want?.userId ?? ""),
                games: Array.isArray(want?.games)
                    ? want.games.map((g) => ({
                          id: String(g?.id ?? ""),
                          name: String(g?.name ?? ""),
                          exe: String(g?.exe ?? ""),
                      }))
                    : [],
            }),
        programs: () => ipcRenderer.invoke("rich-presence:programs"),
        image: (appId, ref) =>
            ipcRenderer.invoke(
                "rich-presence:image",
                String(appId),
                String(ref),
            ),
        status: () => ipcRenderer.invoke("rich-presence:status"),
        restartDiscord: () =>
            ipcRenderer.invoke("rich-presence:restart-discord"),
        setSteamDebugging: (enabled) =>
            ipcRenderer.invoke("rich-presence:steam-debugging", !!enabled),
        restartSteam: () => ipcRenderer.invoke("rich-presence:restart-steam"),
        // Accept a Steam game invite (see richPresence.cjs joinGame). Only the
        // known fields cross over; the main process validates the rest.
        joinGame: (req) =>
            ipcRenderer.invoke("rich-presence:join-game", {
                kind: req?.kind === "steam" ? "steam" : "",
                appId: String(req?.appId ?? ""),
                connect: String(req?.connect ?? ""),
                steamId: String(req?.steamId ?? ""),
                lobbyId: String(req?.lobbyId ?? ""),
            }),
        onEvent: (cb) => {
            const h = (_e, ev) => cb(ev);
            ipcRenderer.on("rich-presence:event", h);
            return () => ipcRenderer.removeListener("rich-presence:event", h);
        },
    },
    // Settings > General > Desktop: run at startup (autostart.cjs).
    autostart: {
        info: () => ipcRenderer.invoke("autostart:info"),
        set: (enabled) => ipcRenderer.invoke("autostart:set", !!enabled),
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
        // How a request to `url` is routed now: "DIRECT", "PROXY h:p", ...
        route: (url) => ipcRenderer.invoke("proxy:route", String(url)),
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
        memoryReport: () => ipcRenderer.invoke("gpu:memory-report"),
        // Memory reports on an interval, kept in main until the next start.
        memoryRecord: {
            start: (intervalMs) =>
                ipcRenderer.invoke(
                    "gpu:memory-record-start",
                    Number(intervalMs),
                ),
            stop: () => ipcRenderer.invoke("gpu:memory-record-stop"),
            get: (from) =>
                ipcRenderer.invoke("gpu:memory-record-get", Number(from) || 0),
        },
        setHardwareAcceleration: (enabled) =>
            ipcRenderer.invoke("gpu:set-hardware-acceleration", !!enabled),
        setNvidiaEncode: (enabled) =>
            ipcRenderer.invoke("gpu:set-nvidia-encode", !!enabled),
        setVideoEncode: (enabled) =>
            ipcRenderer.invoke("gpu:set-video-encode", !!enabled),
        setH264ProfileFix: (enabled) =>
            ipcRenderer.invoke("gpu:set-h264-profile-fix", !!enabled),
        setGameAuto: (enabled) =>
            ipcRenderer.invoke("gpu:set-game-auto", !!enabled),
        setSkiaGraphite: (enabled) =>
            ipcRenderer.invoke("gpu:set-skia-graphite", !!enabled),
        setNvidiaVideo: (mode) =>
            ipcRenderer.invoke("gpu:set-nvidia-video", String(mode)),
        relaunch: () => ipcRenderer.send("app:relaunch"),
        // Restart the GPU process so the window is drawn again from scratch.
        repaint: () => ipcRenderer.invoke("gpu:repaint"),
        // Whether a <video> is playing (src/lib/utils/videoPlaybackWatch.ts).
        setVideoPlaying: (playing) =>
            ipcRenderer.send("gpu:video-playing", !!playing),
        // Chromium's GPU process exited (crash or restart); see
        // src/lib/matrix/webrtcRealm.ts for why calls care.
        onProcessGone: (cb) => {
            const h = (_e, reason) => cb(String(reason));
            ipcRenderer.on("gpu:process-gone", h);
            return () => ipcRenderer.removeListener("gpu:process-gone", h);
        },
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
        // Right-click "Copy image": main copies the image as shown, then
        // asks for the original (a tile shows a smaller copy); the page
        // answers with its PNG bytes, which replace the clipboard image.
        onCopyImage: (cb) => {
            const h = (_e, id, url) => cb(id, url);
            ipcRenderer.on("context-menu:copy-image", h);
            return () =>
                ipcRenderer.removeListener("context-menu:copy-image", h);
        },
        copyImageData: (id, png) => {
            ipcRenderer.send("context-menu:copy-image-data", id, png);
        },
        // Message actions (React, Reply, Edit, ...) for the next right-click.
        // sendSync so main has the items stored before Chromium's own
        // context-menu event for the same click fires.
        setMessageActions: (items) => {
            ipcRenderer.sendSync("context-menu:message-actions", items);
        },
        // The key of the message action picked from the native menu.
        onMessageAction: (cb) => {
            const h = (_e, key) => cb(key);
            ipcRenderer.on("context-menu:message-action", h);
            return () =>
                ipcRenderer.removeListener("context-menu:message-action", h);
        },
    },
});
