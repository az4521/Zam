// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
    namespace App {
        // interface Error {}
        // interface Locals {}
        // interface PageData {}
        // interface PageState {}
        // interface Platform {}
    }

    /** App version, injected from package.json at build time (see vite.config.ts). */
    const __APP_VERSION__: string;

    interface Window {
        /** Electron renderer bridge (electron/preload.cjs); absent in the
         *  browser and on native. Restores a tray-hidden window (which
         *  `window.focus()` cannot do), drives the desktop auto-updater, and
         *  arbitrates screen-share source selection. */
        desktop?: {
            showWindow?: () => void;
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
                    featureStatus: Record<string, string>;
                    /** app.getGPUInfo("complete"), or `{ error }`. */
                    info: unknown;
                    switches: Record<string, string>;
                    env: Record<string, string>;
                }>;
                setHardwareAcceleration: (enabled: boolean) => Promise<void>;
                setNvidiaVideo: (
                    mode: "auto" | "vulkan" | "off",
                ) => Promise<void>;
                relaunch: () => void;
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
                ) => void;
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
            /** Write bytes into the Downloads folder with no save dialog;
             *  resolves to the path written. */
            saveToDownloads?: (
                name: string,
                data: ArrayBuffer,
            ) => Promise<string>;
            contextMenu?: {
                onSaveImage: (cb: (url: string) => void) => () => void;
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
        };
    }
}

export {};
