/**
 * Zam's own JPEG thumbnails: the first scans of the full progressive JPEG,
 * sent as the thumbnail instead of a separately encoded WebP. A receiver that
 * has the prefix can fetch the rest of the file from where the prefix ends
 * (see thumbnailResume.ts), so the thumbnail is never downloaded twice.
 *
 * Marked on the event with a Zam key, so other clients (which see an ordinary
 * JPEG thumbnail) and Zam receivers of older events never try the resume.
 */

import { choosePrefix } from "./jpegScans";

/** The `content.info` key Zam sets on an event whose thumbnail is a prefix. */
export const THUMBNAIL_PREFIX_KEY = "moe.crafty.zam.thumbnail_prefix";

/** A prefix is never bigger than this, whatever the file size. */
export const PREFIX_MAX_BYTES = 256 * 1024;
/** Nor bigger than this share of the file, so the thumbnail stays small. */
export const PREFIX_MAX_FRACTION = 0.3;

/** The largest prefix the upload may use for a file of `fileSize` bytes. */
export function prefixBudget(fileSize: number): number {
    return Math.min(
        PREFIX_MAX_BYTES,
        Math.floor(fileSize * PREFIX_MAX_FRACTION),
    );
}

/**
 * The prefix to send as this file's thumbnail, or null when none qualifies: not
 * a JPEG, not progressive, or no scan set (DC of every component plus one luma
 * AC scan) fits the budget. `bytes` is the final upload, already progressive
 * when the sender's settings allow it. Pure: no decoding.
 */
export function chooseThumbnailPrefix(
    bytes: Uint8Array,
    mimetype: string,
    budget = prefixBudget(bytes.length),
): { length: number } | null {
    if (mimetype.split(";")[0].trim().toLowerCase() !== "image/jpeg") {
        return null;
    }
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
        return null;
    }
    if (budget <= 0) return null;
    const found = choosePrefix(bytes, budget);
    return found ? { length: found.length } : null;
}

/**
 * The JPEG end-of-image marker. A prefix is sent with it appended: browsers
 * reject a progressive JPEG with no EOI (createImageBitmap, ImageDecoder), but
 * decode the same bytes once it is there. The marker is not part of the file's
 * first `length` bytes, so the resume never uses it.
 */
export const JPEG_EOI = new Uint8Array([0xff, 0xd9]);

/**
 * The bytes to upload as a prefix thumbnail: the prefix followed by the EOI
 * marker. The thumbnail's size is the prefix length plus JPEG_EOI.length.
 */
export function prefixThumbnailBytes(
    prefix: Uint8Array,
): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(prefix.length + JPEG_EOI.length);
    out.set(prefix, 0);
    out.set(JPEG_EOI, prefix.length);
    return out;
}

/**
 * Splits a downloaded prefix thumbnail into the whole thumbnail (with its EOI,
 * for decoding) and the shared prefix (the file's first `length` bytes, for the
 * resume). Null unless the bytes are exactly `length + 2` long and end in EOI.
 */
export function splitThumbnailPrefix(
    thumb: Uint8Array,
    length: number,
): { thumb: Uint8Array; prefix: Uint8Array } | null {
    if (thumb.length !== length + JPEG_EOI.length) return null;
    if (thumb[length] !== JPEG_EOI[0] || thumb[length + 1] !== JPEG_EOI[1]) {
        return null;
    }
    return { thumb, prefix: thumb.subarray(0, length) };
}

/** The `content.info` fields that mark an event's thumbnail as a prefix. */
export function thumbnailPrefixFields(length: number): {
    [THUMBNAIL_PREFIX_KEY]: { length: number };
} {
    return { [THUMBNAIL_PREFIX_KEY]: { length } };
}

/**
 * The prefix length an event's `info` declares, or null when it does not
 * declare one, or the declaration does not hold together. A prefix needs a JPEG
 * full image, a JPEG thumbnail whose size is the declared length plus the two
 * EOI bytes, and a length within the upload cap.
 */
export function thumbnailPrefixLength(info: unknown): number | null {
    if (!isRecord(info)) return null;
    const mark = info[THUMBNAIL_PREFIX_KEY];
    if (!isRecord(mark)) return null;
    const n = mark.length;
    if (typeof n !== "number" || !Number.isSafeInteger(n)) return null;
    if (n <= 0 || n > PREFIX_MAX_BYTES) return null;
    if (!isJpegMime(info.mimetype)) return null;
    const thumb = info.thumbnail_info;
    if (!isRecord(thumb) || !isJpegMime(thumb.mimetype)) return null;
    if (thumb.size !== n + JPEG_EOI.length) return null;
    return n;
}

function isJpegMime(v: unknown): boolean {
    return (
        typeof v === "string" &&
        v.split(";")[0].trim().toLowerCase() === "image/jpeg"
    );
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
