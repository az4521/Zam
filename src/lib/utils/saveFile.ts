// Save a blob the renderer already holds (fetched / decrypted media) to disk.
//
// Browsers and Electron: the usual `<a download>` click. Android (Capacitor
// WebView): that is a silent no-op, since the WebView has no download manager
// for blob: URLs, so the bytes go through the native MediaSaver plugin
// (android/.../MediaSaverPlugin.java) into the Downloads folder.

import { Capacitor, registerPlugin } from "@capacitor/core";
import { showToast } from "$lib/stores/toasts.svelte";

interface MediaSaverPlugin {
    save(options: {
        data: string;
        filename: string;
        mimeType: string;
    }): Promise<{ location: string }>;
}

const MediaSaver = registerPlugin<MediaSaverPlugin>("MediaSaver");

function isAndroid(): boolean {
    return (
        Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"
    );
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const url = reader.result as string;
            resolve(url.slice(url.indexOf(",") + 1));
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

/**
 * Save the file behind `objectUrl` (a blob: URL) as `name`. The caller keeps
 * ownership of the URL, but must not revoke it synchronously: mobile browsers
 * start the download asynchronously, so revoke on a delay (see
 * `revokeLater`).
 */
export async function saveObjectUrl(
    objectUrl: string,
    name: string,
): Promise<void> {
    if (isAndroid()) {
        const blob = await (await fetch(objectUrl)).blob();
        await MediaSaver.save({
            data: await blobToBase64(blob),
            filename: name,
            mimeType: blob.type || "application/octet-stream",
        });
        showToast(`Saved to Downloads`, { tone: "accent" });
        return;
    }
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = name;
    // In the document, not detached: Firefox has historically ignored
    // `download` on an anchor that was never in the DOM.
    document.body.appendChild(a);
    a.click();
    a.remove();
}

/** Revoke an object URL once a download it started has had time to begin. */
export function revokeLater(objectUrl: string): void {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}
