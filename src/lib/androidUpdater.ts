// Renderer-side bridge to the custom Android APK updater plugin. The real
// logic lives in native Java (ApkUpdaterPlugin, see
// android/app/src/main/java/moe/crafty/matrix/ApkUpdaterPlugin.java) and is
// surfaced through Capacitor's registerPlugin. This module is a thin, guarded
// pass-through: on web/desktop/iOS `isAndroidUpdater()` is false and callers
// guard on it, so importing this module anywhere is safe.

import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

/** Progress event payload emitted by the native downloader. */
export interface ApkDownloadProgress {
    percent: number;
}

/** Native plugin surface (implemented in ApkUpdaterPlugin.java). */
export interface ApkUpdaterPlugin {
    /** Download the APK at `url` to app-private storage, emitting
     *  `downloadProgress` events; resolves with the stored file path. */
    downloadApk(options: { url: string }): Promise<{ path: string }>;
    /** Hand the downloaded APK at `path` to the OS package installer. */
    installApk(options: { path: string }): Promise<void>;
    /** Whether this app may request package installs (API 26+ unknown-sources). */
    canInstall(): Promise<{ granted: boolean }>;
    /** Open the system "Install unknown apps" settings screen for this app. */
    openUnknownSourcesSettings(): Promise<void>;
    addListener(
        eventName: "downloadProgress",
        listenerFunc: (progress: ApkDownloadProgress) => void,
    ): Promise<PluginListenerHandle>;
}

const ApkUpdater = registerPlugin<ApkUpdaterPlugin>("ApkUpdater");

/** True only on a native Android build, where the plugin is registered. */
export function isAndroidUpdater(): boolean {
    return (
        Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"
    );
}

/**
 * Download the APK, reporting progress via `onProgress` (0–100). Resolves with
 * the on-device file path. Callers guard with `isAndroidUpdater()` first.
 */
export async function downloadApk(
    url: string,
    onProgress?: (percent: number) => void,
): Promise<string> {
    let handle: PluginListenerHandle | null = null;
    if (onProgress) {
        handle = await ApkUpdater.addListener("downloadProgress", (p) =>
            onProgress(p.percent),
        );
    }
    try {
        const { path } = await ApkUpdater.downloadApk({ url });
        return path;
    } finally {
        await handle?.remove();
    }
}

/** Fire the OS package installer for a downloaded APK. */
export async function installApk(path: string): Promise<void> {
    await ApkUpdater.installApk({ path });
}

/** Whether the app may install packages (false → route to unknown-sources). */
export async function canInstall(): Promise<boolean> {
    const { granted } = await ApkUpdater.canInstall();
    return granted;
}

/** Open the system unknown-sources settings screen for this app. */
export async function openUnknownSourcesSettings(): Promise<void> {
    await ApkUpdater.openUnknownSourcesSettings();
}
