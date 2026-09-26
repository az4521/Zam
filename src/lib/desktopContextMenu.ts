// Renderer side of the Electron right-click "Save image as" (electron/main.cjs
// builds the menu; preload exposes `window.desktop.contextMenu`). Main cannot
// download homeserver media itself: the access token is attached by the
// renderer, so a main-process download gets the server's JSON auth error.
// Here the image is fetched with auth (or read from its blob: URL) and saved.
// A no-op on web and Android, where `window.desktop` is undefined.

import { fetchAttachmentBlob, getHomeserverBaseUrl } from "$lib/matrix/client";
import { isSameOrigin } from "$lib/utils/mxcUri";
import { saveObjectUrl, revokeLater } from "$lib/utils/saveFile";
import { showErrorToast } from "$lib/stores/toasts.svelte";

/** Timeline images may show a server-side thumbnail; save the original. */
function fullSizeUrl(url: string): string {
    try {
        const u = new URL(url);
        // /_matrix/client/v1/media/thumbnail/… or /_matrix/media/v3/thumbnail/…
        if (!/^\/_matrix\/.*\/thumbnail\//.test(u.pathname)) return url;
        u.pathname = u.pathname.replace("/thumbnail/", "/download/");
        u.search = "";
        return u.href;
    } catch {
        return url;
    }
}

/** Best filename: the <img>'s alt (timeline media alts are the filename),
 *  else the URL's last path segment. saveObjectUrl adds a missing
 *  extension from the blob's MIME type. */
function filenameFor(srcUrl: string): string {
    let name = "";
    for (const img of document.querySelectorAll("img")) {
        if (img.currentSrc === srcUrl || img.src === srcUrl) {
            name = img.alt.trim();
            break;
        }
    }
    if (!name && !srcUrl.startsWith("blob:") && !srcUrl.startsWith("data:")) {
        try {
            name = decodeURIComponent(
                new URL(srcUrl).pathname.split("/").filter(Boolean).pop() ?? "",
            );
        } catch {
            /* ignore */
        }
    }
    return name.replace(/[\\/\p{Cc}]/gu, "_") || "image";
}

async function saveImage(srcUrl: string): Promise<void> {
    let objectUrl: string;
    let owned = true;
    if (srcUrl.startsWith("blob:")) {
        // Decrypted / already-fetched media: the page owns this URL.
        objectUrl = srcUrl;
        owned = false;
    } else {
        const base = getHomeserverBaseUrl();
        if (base && isSameOrigin(srcUrl, base)) {
            objectUrl = await fetchAttachmentBlob(fullSizeUrl(srcUrl));
        } else {
            // Foreign / same-app media: no token, plain fetch.
            const resp = await fetch(srcUrl);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            objectUrl = URL.createObjectURL(await resp.blob());
        }
    }
    try {
        await saveObjectUrl(objectUrl, filenameFor(srcUrl));
    } finally {
        if (owned) revokeLater(objectUrl);
    }
}

/** Subscribe to the desktop context menu's save-image requests. Returns an
 *  unsubscribe function (a no-op off Electron). */
export function installDesktopSaveImage(): () => void {
    const bridge =
        typeof window !== "undefined" ? window.desktop?.contextMenu : undefined;
    if (!bridge) return () => {};
    return bridge.onSaveImage((url) => {
        saveImage(url).catch((err) => {
            console.error("Failed to save image", err);
            showErrorToast("Failed to save image");
        });
    });
}
