// Renderer-side bridge to the Android web-bundle updater (WebBundlePlugin.java),
// which updates the web UI without a new APK. Native does everything that
// decides or verifies (what is newer, the signature, the hash, what is served);
// this is a thin, guarded pass-through. Off Android every function no-ops, so
// importing it anywhere is safe.
//
// An Android app in the background is frozen after about 30 seconds, so the
// check and download run while the app is open, and native applies a staged
// bundle itself as the app goes to the background or at the next launch.

import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

export interface WebBundleCheck {
    /** "bundle": this shell can take it. "shell": newer, but needs the APK. */
    kind: "none" | "shell" | "bundle";
    version?: string;
    /** Already downloaded and waiting to be applied. */
    staged?: boolean;
}

interface WebBundlePlugin {
    check(): Promise<WebBundleCheck>;
    download(): Promise<{ version: string }>;
    apply(): Promise<void>;
    ready(): Promise<void>;
    setAuto(options: { enabled: boolean }): Promise<void>;
    addListener(
        eventName: "progress",
        listenerFunc: (p: { percent: number }) => void,
    ): Promise<PluginListenerHandle>;
}

const WebBundle = registerPlugin<WebBundlePlugin>("WebBundle");

/** True only on a native Android build, where the plugin is registered. */
export function isAndroidWebBundle(): boolean {
    return (
        Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"
    );
}

export async function webBundleCheck(): Promise<WebBundleCheck> {
    return WebBundle.check();
}

/** Download and stage what the last check found; `onProgress` gets 0 to 100. */
export async function webBundleDownload(
    onProgress: (percent: number) => void,
): Promise<void> {
    const handle = await WebBundle.addListener("progress", (p) =>
        onProgress(p.percent),
    );
    try {
        await WebBundle.download();
    } finally {
        await handle.remove();
    }
}

/** Switch to the staged bundle and reload the page onto it. */
export async function webBundleApply(): Promise<void> {
    await WebBundle.apply();
}

/** The page loaded: a bundle just applied is confirmed good. */
export function webBundleReady(): void {
    if (isAndroidWebBundle()) void WebBundle.ready().catch(() => {});
}

/** Tell native the "Automatic updates" choice, for apply-on-background. */
export function webBundleSetAuto(enabled: boolean): void {
    if (isAndroidWebBundle())
        void WebBundle.setAuto({ enabled }).catch(() => {});
}
