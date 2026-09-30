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
            /** The OS's General MIDI sound bank (DLS/SF2) bytes, or null. */
            readSystemSoundBank?: () => Promise<Uint8Array | null>;
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
            contextMenu?: {
                onSaveImage: (cb: (url: string) => void) => () => void;
            };
        };
    }
}

export {};
