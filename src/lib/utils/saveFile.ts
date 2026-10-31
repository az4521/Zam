// Save a blob the renderer already holds (fetched / decrypted media) to disk.
//
// Browsers and Electron: the usual `<a download>` click. Android (Capacitor
// WebView): that is a silent no-op, since the WebView has no download manager
// for blob: URLs, so the bytes go through the native MediaSaver plugin
// (android/.../MediaSaverPlugin.java) into the Downloads folder.
import { t } from "$lib/i18n";

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

const EXT_BY_MIME: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "application/pdf": "pdf",
};

/** Append an extension from the MIME type when `name` has none, so a file
 *  saved as e.g. "image" still opens as an image. */
export function withExtension(name: string, mime: string): string {
    if (/\.[a-z0-9]{2,5}$/i.test(name)) return name;
    const ext = EXT_BY_MIME[mime.split(";")[0].trim().toLowerCase()];
    return ext ? `${name}.${ext}` : name;
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

/** Hand a blob: URL to the browser's own download, without reading it. The
 *  URL has to outlive the download, so it stays until the page goes. */
export function downloadObjectUrl(objectUrl: string, name: string): void {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = name;
    // In the document, not detached: Firefox has historically ignored
    // `download` on an anchor that was never in the DOM.
    document.body.appendChild(a);
    a.click();
    a.remove();
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
    opts: { quiet?: boolean } = {},
): Promise<void> {
    const quietSave = opts.quiet ? window.desktop?.saveToDownloads : undefined;
    // The bytes are only needed by the quiet and Android paths; the anchor
    // download below uses the URL directly. Re-reading a large blob URL can
    // reject ("Failed to fetch"), which must not fail an otherwise fine save.
    let blob: Blob | null = null;
    try {
        blob = await (await fetch(objectUrl)).blob();
    } catch (err) {
        if (quietSave || isAndroid()) throw err;
    }
    if (blob) name = withExtension(name, blob.type);
    // Desktop shift+click: skip the save dialog and drop the file straight
    // into the Downloads folder, as Android does.
    if (quietSave && blob) {
        await quietSave(name, await blob.arrayBuffer());
        showToast(t("saveFile.savedToDownloads"), { tone: "accent" });
        return;
    }
    if (isAndroid() && blob) {
        await MediaSaver.save({
            data: await blobToBase64(blob),
            filename: name,
            mimeType: blob.type || "application/octet-stream",
        });
        showToast(t("saveFile.savedToDownloads"), { tone: "accent" });
        return;
    }
    downloadObjectUrl(objectUrl, name);
}

/** Revoke an object URL once a download it started has had time to begin. */
export function revokeLater(objectUrl: string): void {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}
