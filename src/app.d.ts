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
            tray?: {
                setMinimizeToClose: (enabled: boolean) => void;
            };
        };
    }
}

export {};
