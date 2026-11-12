// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
    namespace App {
        // interface Error {}
        // interface Locals {}
        // interface PageData {}
        // interface PageState {}
        // interface Platform {}
    }

    /** Settings > General > Network (electron/proxy.cjs). */
    interface MemoryRecording {
        running: boolean;
        intervalMs?: number;
        startedAt?: number;
        /** Oldest samples dropped once the recording hit its cap. */
        dropped?: number;
        /** Index of samples[0] in the whole recording. */
        from?: number;
        samples: import("$lib/utils/memorySeries").MemorySample[];
    }

    interface DesktopProxyPrefs {
        mode: "system" | "direct" | "manual" | "pac";
        /** Manual mode: Chromium proxy rules, e.g. "socks5://127.0.0.1:9050". */
        rules: string;
        /** Manual mode: hosts, IPs or CIDRs that skip the proxy. */
        bypass: string;
        pacUrl: string;
        /** How calls treat the proxy: Chromium's default (UDP direct, TCP
         *  through it), straight to the call servers, or only through it. */
        calls: "default" | "direct" | "proxy";
    }
    interface DesktopProxyInfo extends DesktopProxyPrefs {
        /** The --proxy-* flags Zam was launched with. */
        launchFlags: string[];
        /** Call server hosts currently sent direct (every IP address goes
         *  direct too while calls are "direct"). */
        callBypassAddresses: string[];
        /** False when calls can't bypass (OS proxy settings in use). */
        callBypassAvailable: boolean;
        error: string | null;
    }

    interface DesktopRichPresenceStatus {
        msc4544: {
            listening: boolean;
            port: number | null;
            /** Path of the Unix socket (not on Windows). */
            socket: string | null;
            error: string | null;
        };
        /** Discord Rich Presence servers (electron/discordRpc.cjs). */
        arrpc: {
            running: boolean;
            ipcPath: string | null;
            wsPort: number | null;
            /** Which discord-ipc-N we hold; above 0 means something else
             *  answers apps first. */
            slot: number | null;
            /** Whether Zam can restart Discord for the user. */
            canRestartDiscord: boolean;
            /** In a Flatpak: restarting needs org.freedesktop.Flatpak. */
            needsPermission: boolean;
            error: string | null;
        };
        /** Game detection (electron/gameScanner.cjs). */
        scan: {
            running: boolean;
            error: string | null;
            /** In a Flatpak: scanning is on but the user has not granted
             *  org.freedesktop.Flatpak, so it cannot list host processes. */
            needsPermission: boolean;
        };
        /** Media players, from the system's now-playing info (electron/mediaSession.cjs).
         *  Optional so an older main process without it still works. */
        media?: {
            running: boolean;
            error: string | null;
        };
        /** The game Steam reports as running (electron/steamPresence.cjs), and
         *  Steam's debug setting (electron/steamDebug.cjs). */
        steam: {
            running: boolean;
            /** Steam's local rich presence is being read. */
            connected: boolean;
            /** Steam's local rich presence port answers. */
            portOpen: boolean;
            error: string | null;
            /** Steam's debug setting can be changed on this computer. */
            supported: boolean;
            /** The debug setting is on. */
            enabled: boolean;
            steamRunning: boolean;
            /** In a Flatpak: changing Steam needs org.freedesktop.Flatpak. */
            needsPermission: boolean;
        };
        /** The stand-in Discord process (electron/fakeDiscord.cjs). */
        fake: {
            supported: boolean;
            running: boolean;
            /** In a Flatpak: it needs org.freedesktop.Flatpak. */
            needsPermission: boolean;
            error: string | null;
        };
        /** Discord's list of detectable games, downloaded on first use. */
        games: {
            count: number;
            /** When the saved list was fetched (ms), or null if there is none. */
            updated: number | null;
            downloading: boolean;
            error: string | null;
        };
    }

    /** One add/replace (`presence` set) or removal (null) from a local app. */
    interface DesktopRichPresenceEvent {
        source: "msc4544" | "arrpc";
        app: { id: string; name: string };
        presenceId: string;
        presence: unknown;
    }

    /** A Steam game invite the user accepted: the game, its connect string and
     *  the friend's Steam id and lobby (electron/richPresence.cjs joinGame).
     *  The connect string is needed unless a lobby and a Steam id are given. */
    type DesktopGameJoinRequest = {
        kind: "steam";
        appId: string;
        connect?: string;
        /** The friend's SteamID64 (digits); without it the run link is used. */
        steamId?: string;
        /** The lobby the friend is in (digits), when Steam says it is valid. */
        lobbyId?: string;
    };

    /** App version, injected from package.json at build time (see vite.config.ts). */
    const __APP_VERSION__: string;

    interface Window {
        /** Electron renderer bridge (electron/preload.cjs); absent in the
         *  browser and on native. Restores a tray-hidden window (which
         *  `window.focus()` cannot do), drives the desktop auto-updater, and
         *  arbitrates screen-share source selection. */
        desktop?: {
            showWindow?: () => void;
            /** Settings > General > Network (electron/proxy.cjs). */
            proxy?: {
                info: () => Promise<DesktopProxyInfo>;
                set: (prefs: DesktopProxyPrefs) => Promise<DesktopProxyInfo>;
                /** Hosts of call servers about to be connected to, so they
                 *  can bypass the proxy; resolves once the rules apply. */
                callTargets: (hosts: string[]) => Promise<void>;
                /** How a request to `url` is routed right now, in PAC form
                 *  ("DIRECT", "PROXY host:port", "SOCKS5 host:port"); null
                 *  when it can't be told. */
                route?: (url: string) => Promise<string | null>;
            };
            /** Tell main a call is (dis)connected, to raise process
             *  priority during it (electron/callPriority.cjs). */
            call?: { setActive: (active: boolean) => void };
            /** Settings > Debug GPU section (electron/main.cjs). */
            gpu?: {
                info: () => Promise<{
                    /** The saved preference (applies on the next launch). */
                    hardwareAcceleration: boolean;
                    /** What this run started with. */
                    hardwareAccelerationAtLaunch: boolean;
                    /** Flatpak only: NVIDIA's Vulkan video decode path (zam.sh). */
                    nvidiaVideo: {
                        /** The saved choice (applies on the next launch). */
                        mode: "auto" | "vulkan" | "off";
                        /** Whether this run uses the Vulkan path. */
                        activeAtLaunch: boolean;
                        /** Chromium reported an NVIDIA GPU (zam.sh missed it). */
                        detected: boolean;
                        /** When automatic mode gave up after GPU crashes. */
                        failedAt: number | null;
                    } | null;
                    /** Flatpak only: NVENC encoding through flatpak/va-nvenc (zam.sh). */
                    nvidiaEncode: {
                        /** The saved choice (applies on the next launch). */
                        enabled: boolean;
                        /** Whether this run has the driver and flags. */
                        activeAtLaunch: boolean;
                    } | null;
                    /** Linux only: VA-API video encoding (AcceleratedVideoEncoder). */
                    videoEncode: {
                        /** The saved choice (applies on the next launch). */
                        enabled: boolean;
                        /** Whether this run has the flag on. */
                        activeAtLaunch: boolean;
                    } | null;
                    /** Go without the GPU while a game holds its memory. */
                    gameAuto: {
                        /** The saved choice. */
                        enabled: boolean;
                        /** This run started without the GPU for a game. */
                        pausedAtLaunch: boolean;
                    };
                    /** Skia Graphite renderer (SkiaGraphite feature). */
                    skiaGraphite: {
                        /** The saved choice (applies on the next launch). */
                        enabled: boolean;
                        /** Whether this run has the flag on. */
                        activeAtLaunch: boolean;
                        /** When it was switched off after a failed launch or
                         *  GPU crash. */
                        failedAt: number | null;
                    };
                    featureStatus: Record<string, string>;
                    /** app.getGPUInfo("complete"), or `{ error }`. */
                    info: unknown;
                    switches: Record<string, string>;
                    env: Record<string, string>;
                }>;
                /** Chromium's memory by process and allocator (memory-infra),
                 *  sizes in bytes, largest first. */
                memoryReport?: () => Promise<
                    | {
                          processes: {
                              pid: number;
                              name: string;
                              allocators: [string, number][];
                              workingSetKb: number | null;
                          }[];
                      }
                    | { error: string }
                >;
                /** memoryReport on an interval, kept by the main process so
                 *  it carries on with Settings closed. `get(from)` returns the
                 *  samples from index `from` of the recording on. */
                memoryRecord?: {
                    start: (intervalMs: number) => Promise<MemoryRecording>;
                    stop: () => Promise<MemoryRecording>;
                    get: (from: number) => Promise<MemoryRecording>;
                };
                setHardwareAcceleration: (enabled: boolean) => Promise<void>;
                setVideoEncode: (enabled: boolean) => Promise<void>;
                /** Windows: the PlatformH264CbpEncoding flag, on the next launch. */
                setH264ProfileFix: (enabled: boolean) => Promise<void>;
                setGameAuto: (enabled: boolean) => Promise<void>;
                setSkiaGraphite: (enabled: boolean) => Promise<void>;
                setNvidiaEncode: (enabled: boolean) => Promise<void>;
                setNvidiaVideo: (
                    mode: "auto" | "vulkan" | "off",
                ) => Promise<void>;
                relaunch: () => void;
                /** Restart the GPU process so the window is drawn again. */
                repaint?: () => Promise<void>;
                /** Whether a <video> on the page is playing. */
                setVideoPlaying?: (playing: boolean) => void;
                /** Chromium's GPU process exited; `reason` is Electron's. */
                onProcessGone?: (cb: (reason: string) => void) => () => void;
            };
            /** System-wide input idleness, for presence auto-away. */
            idle?: {
                get: () => Promise<{ seconds: number; locked: boolean }>;
            };
            /** The OS's General MIDI sound bank (DLS/SF2) bytes, or null. */
            readSystemSoundBank?: () => Promise<Uint8Array | null>;
            /** Whether readSystemSoundBank would find a bank. */
            hasSystemSoundBank?: () => Promise<boolean>;
            sso?: {
                /** SSO redirect caught by the local server (path + query). */
                onCallback: (cb: (url: string) => void) => () => void;
            };
            updates?: {
                check: () => void;
                download: () => void;
                restartToInstall: () => void;
                setAutoDownload: (enabled: boolean) => void;
                /** The page loaded, so a web bundle just applied is good. */
                bundleReady: () => void;
                onStatus: (
                    cb: (
                        s: import("$lib/utils/updateStatus").UpdateStatusInput,
                    ) => void,
                ) => () => void;
            };
            screenShare?: {
                onRequest: (
                    cb: (
                        req: import("$lib/utils/displaySources").DisplaySourceRequest,
                    ) => void,
                ) => () => void;
                onCancel: (cb: (requestId: number) => void) => () => void;
                respond: (
                    requestId: number,
                    sourceId: string | null,
                    sourceName?: string,
                    audio?: string,
                ) => void;
                /** How a picked share's audio was set up; a PCM port
                 *  comes separately, posted to the window as
                 *  "zam:share-audio-port:<id>". */
                onAudio?: (
                    cb: (info: {
                        id: number;
                        kind: string;
                        label?: string;
                    }) => void,
                ) => () => void;
                /** Stop the share-audio capture. */
                stopAudio?: () => void;
            };
            notify?: {
                flash: () => void;
                show: (payload: {
                    id: number;
                    title: string;
                    body: string;
                    tag?: string;
                    silent?: boolean;
                }) => void;
                close: (id: number) => void;
                onEvent: (
                    cb: (ev: { id: number; type: "click" | "close" }) => void,
                ) => () => void;
            };
            tray?: {
                setUnread: (unread: boolean) => void;
                setMinimizeToClose: (enabled: boolean) => void;
            };
            /** Rich presence sources (electron/richPresence.cjs). Idle until
             *  `configure` turns them on. */
            richPresence?: {
                configure: (want: {
                    local: boolean;
                    arrpc: boolean;
                    scan: boolean;
                    /** Report what media players are playing (the system's
                     *  now-playing info), as Discord "listening" entries. */
                    media: boolean;
                    /** Report the game Steam says is running, as a "Playing"
                     *  entry (electron/steamPresence.cjs). */
                    steam: boolean;
                    /** Run a stand-in process named Discord, for apps that
                     *  look for one. */
                    fake: boolean;
                    /** Once per run, restart Discord if it holds the first
                     *  discord-ipc slot. */
                    autoRestartDiscord: boolean;
                    /** Names the Unix socket (as an opaque hash). */
                    userId: string;
                    /** Games the user added by hand (exe is a full path). */
                    games: { id: string; name: string; exe: string }[];
                }) => Promise<DesktopRichPresenceStatus>;
                /** Programs running now, to pick a game from. */
                programs: () => Promise<{ path: string; name: string }[]>;
                /** A picture a presence refers to (an icon, a cover), fetched
                 *  from Discord's or Spotify's hosts only; null if none. */
                image: (
                    appId: string,
                    ref: string,
                ) => Promise<{ type: string; data: Uint8Array } | null>;
                status: () => Promise<DesktopRichPresenceStatus>;
                /** Close Discord, let Zam take the first slot, start Discord
                 *  again. Only after the user confirmed. */
                restartDiscord: () => Promise<{ ok: boolean; error?: string }>;
                /** Turn Steam's debug setting on or off (it asks the user
                 *  first, so `cancelled` is set when they say no). */
                setSteamDebugging: (enabled: boolean) => Promise<{
                    ok: boolean;
                    cancelled?: boolean;
                    error?: string;
                }>;
                /** Restart Steam. Only after the user confirmed. */
                restartSteam: () => Promise<{ ok: boolean; error?: string }>;
                /** Accept a Steam game invite: open Steam's link to the game. */
                joinGame: (req: DesktopGameJoinRequest) => Promise<
                    | { ok: true }
                    | {
                          ok: false;
                          error: "unsupported" | "invalid";
                      }
                >;
                onEvent: (
                    cb: (event: DesktopRichPresenceEvent) => void,
                ) => () => void;
            };
            /** Run at startup (electron/autostart.cjs). `available` is false
             *  in an unpacked build. `set` rejects if the system refuses. */
            autostart?: {
                info: () => Promise<{ available: boolean; enabled: boolean }>;
                set: (
                    enabled: boolean,
                ) => Promise<{ available: boolean; enabled: boolean }>;
            };
            /** Write bytes into the Downloads folder with no save dialog;
             *  resolves to the path written. */
            saveToDownloads?: (
                name: string,
                data: ArrayBuffer,
            ) => Promise<string>;
            contextMenu?: {
                onSaveImage: (cb: (url: string) => void) => () => void;
                /** Actions for the message under the next right-click; null clears. */
                setMessageActions: (
                    items:
                        | { key: string; label: string; danger?: boolean }[]
                        | null,
                ) => void;
                onMessageAction: (cb: (key: string) => void) => () => void;
            };
            /** Voice keybinds while the window isn't focused
             *  (electron/globalHotkeys.cjs, $lib/keybinds/globalHotkeys). */
            hotkeys?: {
                /** The DOM key codes and mouse buttons to forward, or on
                 *  Wayland the shortcuts to bind through the portal; empty
                 *  lists stop it. Resolves to the hook's status. */
                watch: (
                    codes: string[],
                    buttons: number[],
                    shortcuts: import("$lib/keybinds/globalHotkeys").PortalShortcut[],
                ) => Promise<
                    import("$lib/keybinds/globalHotkeys").GlobalHotkeyStatus
                >;
                /** Wayland, portal v2+: the desktop's shortcut editor. */
                configure: () => Promise<void>;
                /** macOS: ask for the Accessibility permission. */
                requestPermission: () => Promise<
                    import("$lib/keybinds/globalHotkeys").GlobalHotkeyStatus
                >;
                onInput: (
                    cb: (
                        ev: import("$lib/keybinds/globalHotkeys").GlobalInput,
                    ) => void,
                ) => () => void;
                onStatus: (
                    cb: (
                        s: import("$lib/keybinds/globalHotkeys").GlobalHotkeyStatus,
                    ) => void,
                ) => () => void;
            };
            /** Plugins' native code ($lib/plugins/pluginNative): open()
             *  installs (after a system consent dialog) and starts the
             *  plugin's host, whose port arrives as the window message
             *  "zam:plugin-native-port:<id>". */
            pluginNative?: {
                /** `${process.platform}-${process.arch}`, e.g. "win32-x64". */
                platform: string;
                open: (req: {
                    id: string;
                    pluginId: string;
                    owner: string;
                    repo: string;
                    sha: string;
                    path: string;
                }) => Promise<{ ok: boolean; error?: string }>;
                remove: (pluginId: string) => Promise<void>;
            };
            /** zam.frames (electron/pluginFrames.cjs): the Referer main
             *  sends and the script it runs for the window's iframes whose
             *  URL starts with a rule's prefix. */
            pluginFrames?: {
                add: (rule: {
                    id: string;
                    urlPrefixes: string[];
                    script?: string;
                    referrer?: string;
                }) => Promise<boolean>;
                remove: (id: string) => Promise<void>;
            };
        };
    }
}

export {};
