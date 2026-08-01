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
     *  `downloadProgress` events; resolves with the stored file path.
     *  `minVersionCode` is the versionCode of the release the user was offered;
     *  native refuses an archive below it (0 = no floor). */
    downloadApk(options: {
        url: string;
        minVersionCode: number;
    }): Promise<{ path: string }>;
    /** Hand the verified downloaded APK to the OS package installer. Takes no
     *  path: native re-derives its own private file so a compromised renderer
     *  cannot choose what gets installed. */
    installApk(): Promise<void>;
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
 *
 * `minVersionCode` is the floor native verification enforces: pass the
 * versionCode of the release the user was actually offered, so a stale
 * (still-correctly-signed) archive is refused too.
 */
export async function downloadApk(
    url: string,
    minVersionCode: number,
    onProgress?: (percent: number) => void,
): Promise<string> {
    let handle: PluginListenerHandle | null = null;
    if (onProgress) {
        handle = await ApkUpdater.addListener("downloadProgress", (p) =>
            onProgress(p.percent),
        );
    }
    try {
        const { path } = await ApkUpdater.downloadApk({ url, minVersionCode });
        return path;
    } finally {
        await handle?.remove();
    }
}

/** Fire the OS package installer for the verified downloaded APK. */
export async function installApk(): Promise<void> {
    await ApkUpdater.installApk();
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
