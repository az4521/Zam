/**
 * Safe CSS dimensions from untrusted media metadata.
 *
 * `m.video`'s `info.w`/`info.h` (and any third-party media API's width/height)
 * are attacker-controlled: the sender picks the JSON, so those fields can be
 * arbitrary strings rather than the numbers the types promise. Interpolating
 * one straight into a `style` attribute lets it close the declaration and add
 * its own — `w = "1px;background:url(https://tracker/x)"` turns a thumbnail
 * card into an outbound request the moment it renders.
 *
 * So no component builds style text out of raw event content: it asks here for
 * a value that can only ever be `<int> / <int>`.
 */

/**
 * Upper bound for a single dimension. Well past any real video, small enough
 * that the resulting ratio can't be used as a layout bomb.
 */
const MAX_DIMENSION = 100000;

/** Default when either side is missing or refused — ordinary landscape video. */
const DEFAULT_RATIO = "16 / 9";

/**
 * Coerce one untrusted dimension to a positive integer, or `null` if it isn't
 * one. Only numbers and strings are considered: `Number([16])` is 16 and
 * `Number(true)` is 1, so coercing anything else would let a crafted JSON
 * shape smuggle a value past the guard.
 */
export function safeDimension(value: unknown): number | null {
    if (typeof value !== "number" && typeof value !== "string") return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(Math.min(n, MAX_DIMENSION)) || null;
}

/**
 * CSS `aspect-ratio` value for a pair of untrusted dimensions. Both sides must
 * survive `safeDimension`, otherwise the caller gets `fallback` — a partially
 * valid pair is not worth guessing at.
 *
 * `fallback` is returned verbatim, so it must be a literal the caller controls,
 * never anything derived from event content.
 */
export function safeAspectRatio(
    width: unknown,
    height: unknown,
    fallback: string = DEFAULT_RATIO,
): string {
    const w = safeDimension(width);
    const h = safeDimension(height);
    if (w === null || h === null) return fallback;
    return `${w} / ${h}`;
}

/**
 * Display box (in px) for an image whose intrinsic `width`/`height` come off the
 * wire, scaled to fit within `maxWidth`×`maxHeight` while preserving aspect
 * ratio and never upscaling past intrinsic size. Returns `null` when either
 * dimension fails `safeDimension`, so the caller can fall back to CSS bounds.
 *
 * The point is layout stability: rendering these as the `<img>`'s `width`/
 * `height` attributes lets the browser reserve the exact box before the image
 * loads, so it can't pop in and shove the timeline. Both sides are sanitized
 * integers, so they are safe to interpolate into markup.
 */
export function reservedMediaBox(
    width: unknown,
    height: unknown,
    maxWidth: number,
    maxHeight: number,
): { width: number; height: number } | null {
    const w = safeDimension(width);
    const h = safeDimension(height);
    if (w === null || h === null) return null;
    const scale = Math.min(maxWidth / w, maxHeight / h, 1);
    return {
        width: Math.max(1, Math.round(w * scale)),
        height: Math.max(1, Math.round(h * scale)),
    };
}
