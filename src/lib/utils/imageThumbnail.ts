/**
 * Small sender-side thumbnails for `m.image` uploads.
 *
 * Receivers show `info.thumbnail_url` / `thumbnail_file` instead of the full
 * image, which matters most in encrypted rooms: the server cannot thumbnail
 * ciphertext, so without one every client downloads the whole original just to
 * draw the timeline tile. The aim is a preview that lands in one round trip,
 * so the budget is ~10 KB rather than a high-fidelity 800×600.
 *
 * WebP: every Matrix client's image stack decodes it, it is roughly a third
 * smaller than JPEG at this size, and keeps alpha. Canvas encodes it in
 * Chromium (web, Electron, Android WebView) and Firefox. Safari's canvas does
 * not and hands back PNG instead, so that case drops to JPEG. AVIF would be
 * smaller still, but no browser canvas can encode it.
 */

/** Size budget for a thumbnail. */
export const THUMBNAIL_TARGET_BYTES = 10 * 1024;

/** Images up to this size load fast enough on their own: no thumbnail. */
export const THUMBNAIL_MIN_SOURCE_BYTES = 100 * 1024;

// Longest edge to try, largest first. A bigger edge at lower quality loses to
// a smaller edge at decent quality once the artifacts show, so each size gets
// only a couple of qualities before stepping down.
const THUMBNAIL_EDGES = [640, 480, 360, 256];
const THUMBNAIL_QUALITIES = [0.8, 0.6];

export type ThumbnailEncoder = (
    width: number,
    height: number,
    quality: number,
) => Promise<Blob | null>;

export interface ImageThumbnail {
    blob: Blob;
    /** Full image size, after EXIF orientation. */
    w: number;
    h: number;
    thumbW: number;
    thumbH: number;
}

/**
 * Walk the edge/quality ladder and keep the first encode within budget. If
 * nothing fits, the smallest encode is used: a 12 KB thumbnail still beats
 * fetching the original.
 */
export async function fitThumbnail(
    w: number,
    h: number,
    encode: ThumbnailEncoder,
    targetBytes = THUMBNAIL_TARGET_BYTES,
): Promise<{ blob: Blob; thumbW: number; thumbH: number } | null> {
    let smallest: { blob: Blob; thumbW: number; thumbH: number } | null = null;
    const longest = Math.max(w, h);
    // Never upscale; an image already under the first edge starts at its own.
    const edges = [
        ...new Set(THUMBNAIL_EDGES.map((e) => Math.min(e, longest))),
    ];
    for (const edge of edges) {
        const scale = edge / longest;
        const thumbW = Math.max(1, Math.round(w * scale));
        const thumbH = Math.max(1, Math.round(h * scale));
        for (const quality of THUMBNAIL_QUALITIES) {
            const blob = await encode(thumbW, thumbH, quality);
            if (!blob) continue;
            const attempt = { blob, thumbW, thumbH };
            if (blob.size <= targetBytes) return attempt;
            if (!smallest || blob.size < smallest.blob.size) smallest = attempt;
        }
    }
    return smallest;
}

function canvasToBlob(
    canvas: HTMLCanvasElement,
    type: string,
    quality: number,
): Promise<Blob | null> {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Decode `file` and build a thumbnail for it. Returns the full dimensions
 * alone (`blob` null) when the file is small enough not to need one, and null when
 * the browser cannot decode it (HEIC off Safari, JPEG XL, SVG, anything
 * corrupt). Never throws: a thumbnail is optional and must not block a send.
 */
export async function createImageThumbnail(
    file: Blob,
): Promise<ImageThumbnail | { blob: null; w: number; h: number } | null> {
    // An SVG decodes through createImageBitmap in some engines only, and is
    // usually tiny anyway.
    if (file.type === "image/svg+xml") return null;
    if (typeof createImageBitmap !== "function") return null;
    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(file, {
            imageOrientation: "from-image",
        });
    } catch {
        return null;
    }
    try {
        const w = bitmap.width;
        const h = bitmap.height;
        if (!w || !h) return null;
        if (file.size < THUMBNAIL_MIN_SOURCE_BYTES) return { blob: null, w, h };

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return { blob: null, w, h };
        let type = "image/webp";
        const draw = (tw: number, th: number) => {
            canvas.width = tw;
            canvas.height = th;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            // JPEG has no alpha; transparent pixels would otherwise go black.
            if (type === "image/jpeg") {
                ctx.fillStyle = "#fff";
                ctx.fillRect(0, 0, tw, th);
            }
            ctx.drawImage(bitmap, 0, 0, tw, th);
        };
        const encode: ThumbnailEncoder = async (tw, th, quality) => {
            draw(tw, th);
            let blob = await canvasToBlob(canvas, type, quality);
            // No WebP encoder (Safari): the canvas silently returns PNG.
            if (blob && blob.type !== type && type === "image/webp") {
                type = "image/jpeg";
                draw(tw, th);
                blob = await canvasToBlob(canvas, type, quality);
            }
            return blob && blob.type === type ? blob : null;
        };
        const fit = await fitThumbnail(w, h, encode);
        // Not worth sending one that saves nothing over the original.
        if (!fit || fit.blob.size >= file.size) return { blob: null, w, h };
        return { ...fit, w, h };
    } catch {
        return null;
    } finally {
        bitmap.close();
    }
}
