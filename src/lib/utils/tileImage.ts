/**
 * Receiver-side downscaling of images shown much smaller than they are:
 * decrypted `m.image` tiles, avatars, link-preview cards.
 *
 * An encrypted image arrives as one plaintext blob (the server cannot
 * thumbnail ciphertext). Pointing the tile's <img> at it makes the browser
 * keep a full-resolution decode for as long as the tile is mounted — tens of
 * MB for a phone photo shown at 512×384. The tile gets a copy sized to its
 * box instead; the original blob stays for the lightbox, where an <img> only
 * decodes it while open.
 *
 * Avatars are the same problem at a larger scale: they are loaded at full
 * size so animated ones keep animating (server thumbnails drop frames), and a
 * 4K avatar costs ~32 MB decoded at every place it is drawn at 40 px. They get
 * a small copy (mediaAuth's shrunkMediaUrl); animated ones are re-encoded
 * frame by frame as a smaller animated WebP (utils/gifToWebp).
 */
import { shrinkAnimatedImage } from "./gifToWebp";

/** Tile bounds (CSS max-w-lg / max-h-96) at 2× for high-DPI screens. */
export const TILE_MAX_W = 1024;
export const TILE_MAX_H = 768;

// How much of the file isAnimatedImage may look at: PNG metadata chunks
// (iCCP, eXIf) can sit before the first frame.
const SNIFF_BYTES = 256 * 1024;

/**
 * Downscaled size, or null when the image is already small enough. "contain"
 * fits the whole image inside the box; "cover" only shrinks it until it still
 * covers the box, for an `object-fit: cover` element that crops the rest.
 */
export function fitSize(
    w: number,
    h: number,
    maxW: number,
    maxH: number,
    fit: "contain" | "cover" = "contain",
): { w: number; h: number } | null {
    const scale =
        fit === "cover"
            ? Math.max(maxW / w, maxH / h)
            : Math.min(maxW / w, maxH / h);
    if (!(scale < 1)) return null;
    return {
        w: Math.max(1, Math.round(w * scale)),
        h: Math.max(1, Math.round(h * scale)),
    };
}

/** Downscaled size for the timeline tile, or null when it already fits. */
export function tileSize(
    w: number,
    h: number,
): { w: number; h: number } | null {
    return fitSize(w, h, TILE_MAX_W, TILE_MAX_H);
}

const ascii = (b: Uint8Array, at: number, s: string) =>
    at + s.length <= b.length &&
    [...s].every((c, i) => b[at + i] === c.charCodeAt(0));

/**
 * Whether the file is, or might be, animated: a canvas copy would keep only
 * the first frame. Errs towards true (GIF always, anything it can't walk far
 * enough to rule out); a false positive only costs the downscale.
 */
export function isAnimatedImage(b: Uint8Array): boolean {
    if (ascii(b, 0, "GIF8")) return true;
    if (b[0] === 0x89 && ascii(b, 1, "PNG")) {
        // APNG declares acTL before the first IDAT.
        let at = 8;
        while (at + 8 <= b.length) {
            const len =
                ((b[at] << 24) |
                    (b[at + 1] << 16) |
                    (b[at + 2] << 8) |
                    b[at + 3]) >>>
                0;
            if (ascii(b, at + 4, "acTL")) return true;
            if (ascii(b, at + 4, "IDAT")) return false;
            at += 12 + len;
        }
        return true;
    }
    if (ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP")) {
        // Simple (VP8/VP8L) WebP is a single frame; VP8X carries an
        // animation flag.
        if (!ascii(b, 12, "VP8X")) return false;
        return b.length <= 20 || (b[20] & 0x02) !== 0;
    }
    if (ascii(b, 4, "ftyp")) {
        // ISO-BMFF (AVIF/HEIF): an image sequence lists an avis/msf1 brand.
        const size = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
        for (let at = 8; at + 4 <= Math.min(size, b.length); at += 4) {
            if (ascii(b, at, "avis") || ascii(b, at, "msf1")) return true;
        }
        return false;
    }
    // JPEG and BMP are single-frame; JPEG XL and anything unknown may not be.
    if (b[0] === 0xff && b[1] === 0xd8) return false;
    if (ascii(b, 0, "BM")) return false;
    return true;
}

/** MIME type of an animation-capable image from its header, or null. */
export function animatedMime(b: Uint8Array): string | null {
    if (ascii(b, 0, "GIF8")) return "image/gif";
    if (b[0] === 0x89 && ascii(b, 1, "PNG")) return "image/png";
    if (ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP")) return "image/webp";
    if (ascii(b, 4, "ftyp")) return "image/avif";
    return null;
}

function canvasToBlob(
    canvas: HTMLCanvasElement,
    type: string,
    quality: number,
): Promise<Blob | null> {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * A copy of `blob` sized to the timeline tile, or null when the original
 * should be shown as is. See downscaleImage.
 */
export function createTileImage(blob: Blob): Promise<Blob | null> {
    return downscaleImage(blob, TILE_MAX_W, TILE_MAX_H);
}

/**
 * A copy of `blob` no bigger than `maxW`×`maxH` needs (see fitSize), or null
 * when the original should be shown as is: it is already that small, is an
 * animation that can't be re-encoded here, is SVG, or the browser can't decode
 * it. Animations come back as animated WebP. Never throws.
 */
export async function downscaleImage(
    blob: Blob,
    maxW: number,
    maxH: number,
    fit: "contain" | "cover" = "contain",
): Promise<Blob | null> {
    if (blob.type === "image/svg+xml") return null;
    if (typeof createImageBitmap !== "function") return null;
    let bitmap: ImageBitmap | null = null;
    try {
        const head = new Uint8Array(
            await blob.slice(0, SNIFF_BYTES).arrayBuffer(),
        );
        if (isAnimatedImage(head)) {
            const type = animatedMime(head);
            if (!type) return null;
            const small = await shrinkAnimatedImage(blob, type, (w, h) =>
                fitSize(w, h, maxW, maxH, fit),
            );
            if (small !== "still") return small;
        }
        bitmap = await createImageBitmap(blob, {
            imageOrientation: "from-image",
        });
        const size = fitSize(bitmap.width, bitmap.height, maxW, maxH, fit);
        if (!size) return null;
        const canvas = document.createElement("canvas");
        canvas.width = size.w;
        canvas.height = size.h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bitmap, 0, 0, size.w, size.h);
        // WebP keeps alpha; Safari has no WebP encoder and hands back PNG,
        // which is fine for a local-only copy.
        const out = await canvasToBlob(canvas, "image/webp", 0.9);
        canvas.width = canvas.height = 0;
        return out;
    } catch {
        return null;
    } finally {
        bitmap?.close();
    }
}
