// Renderer side of the Electron right-click "Save image as" (electron/main.cjs
// builds the menu; preload exposes `window.desktop.contextMenu`). Main cannot
// download homeserver media itself: the access token is attached by the
// renderer, so a main-process download gets the server's JSON auth error.
// Here the image is fetched with auth (or read from its blob: URL) and saved.
// A no-op on web and Android, where `window.desktop` is undefined.
import { t } from "$lib/i18n";

import {
    fetchAttachmentBlob,
    fetchDecryptedAttachmentBlob,
    getHomeserverBaseUrl,
} from "$lib/matrix/client";
import {
    fullImageSourceOf,
    type FullImageSource,
} from "$lib/actions/fullImage";
import { isSameOrigin } from "$lib/utils/mxcUri";
import { safeMediaBlob } from "$lib/utils/attachmentMime";
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

// The image last right-clicked, so the menu's actions can find the original
// it marks with use:fullImage. Weak so a tile scrolled away isn't kept alive.
let lastContextImg: WeakRef<HTMLImageElement> | null = null;

/** The use:fullImage source of the image right-clicked for this menu, when
 *  that image is the one main named. */
function markedOriginal(srcUrl: string): FullImageSource | null {
    const img = lastContextImg?.deref();
    if (!img || !img.isConnected) return null;
    if (img.currentSrc !== srcUrl && img.src !== srcUrl) return null;
    return fullImageSourceOf(img);
}

/** Fetch or decrypt a marked original. `owned`: the caller revokes it. */
async function fetchOriginal(
    src: FullImageSource,
): Promise<{ url: string; owned: boolean }> {
    if (src.kind === "encrypted")
        return {
            url: await fetchDecryptedAttachmentBlob(src.file, src.mimetype),
            owned: true,
        };
    if (src.url.startsWith("blob:")) return { url: src.url, owned: false };
    return { url: await fetchAttachmentBlob(src.url), owned: true };
}

async function saveImage(srcUrl: string): Promise<void> {
    const marked = markedOriginal(srcUrl);
    if (marked) {
        const { url, owned } = await fetchOriginal(marked);
        try {
            await saveObjectUrl(url, marked.name || filenameFor(srcUrl));
        } finally {
            if (owned) revokeLater(url);
        }
        return;
    }
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
            objectUrl = URL.createObjectURL(
                await safeMediaBlob(await resp.blob()),
            );
        }
    }
    try {
        await saveObjectUrl(objectUrl, filenameFor(srcUrl));
    } finally {
        if (owned) revokeLater(objectUrl);
    }
}

// Canvas size browsers reliably allow; a bigger original is scaled down.
const MAX_CANVAS_PIXELS = 16384 * 16384;

/** Re-encode an image as PNG, the format the OS clipboard takes for any
 *  source type (an animated image gives its first frame, as Chromium's own
 *  copy does). */
async function toPng(objectUrl: string): Promise<ArrayBuffer> {
    const img = new Image();
    img.src = objectUrl;
    await img.decode();
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (!w || !h) throw new Error("image has no size");
    const shrink = Math.min(1, Math.sqrt(MAX_CANVAS_PIXELS / (w * h)));
    w = Math.max(1, Math.floor(w * shrink));
    h = Math.max(1, Math.floor(h * shrink));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("PNG encode failed");
    return blob.arrayBuffer();
}

/** The original's PNG bytes for "Copy image", or null when the image shown
 *  already is the original (main has copied it as shown). */
async function originalPng(srcUrl: string): Promise<ArrayBuffer | null> {
    let src = markedOriginal(srcUrl);
    if (!src) {
        // Unmarked: only a homeserver thumbnail has a bigger original to get.
        const full = fullSizeUrl(srcUrl);
        const base = getHomeserverBaseUrl();
        if (full === srcUrl || !base || !isSameOrigin(srcUrl, base))
            return null;
        src = { kind: "url", url: full };
    }
    // The tile may be the original already (a small image, a GIF).
    if (src.kind === "url" && src.url === srcUrl) return null;
    const { url, owned } = await fetchOriginal(src);
    try {
        return await toPng(url);
    } finally {
        if (owned) URL.revokeObjectURL(url);
    }
}

/** Subscribe to the desktop context menu's image requests. Returns an
 *  unsubscribe function (a no-op off Electron). */
export function installDesktopSaveImage(): () => void {
    const bridge =
        typeof window !== "undefined" ? window.desktop?.contextMenu : undefined;
    if (!bridge) return () => {};
    const onContextMenu = (e: MouseEvent) => {
        lastContextImg =
            e.target instanceof HTMLImageElement ? new WeakRef(e.target) : null;
    };
    // Capture: a handler further down may stop the event, and the native
    // menu still opens.
    document.addEventListener("contextmenu", onContextMenu, true);
    const offSave = bridge.onSaveImage((url) => {
        saveImage(url).catch((err) => {
            console.error("Failed to save image", err);
            showErrorToast(t("desktopContextMenu.failedToSaveImage"));
        });
    });
    // An older desktop build has no copy hook; its menu copies the image as
    // shown.
    const offCopy =
        bridge.onCopyImage?.((id, url) => {
            // Main has already copied the image as shown; this swaps in the
            // original once it is here. On failure the shown one stays.
            originalPng(url)
                .then((png) => {
                    if (png) bridge.copyImageData?.(id, png);
                })
                .catch((err) =>
                    console.error("Failed to copy full-size image", err),
                );
        }) ?? (() => {});
    return () => {
        document.removeEventListener("contextmenu", onContextMenu, true);
        offSave();
        offCopy();
    };
}
