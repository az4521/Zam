/**
 * Low-res stand-ins painted behind an `<img>` until its own src loads.
 *
 * They go on the element as CSS background layers rather than as extra
 * `<img>`s, so they share its box, rounding and (in the lightbox) its
 * zoom/pan transform, and need no layering of their own. The `<img>`'s pixels
 * paint over its background, so the real image simply covers them once it
 * decodes; the caller drops them then so a transparent image doesn't show the
 * stand-in through.
 */

/** Only URLs we produced ourselves: homeserver media or a decrypted blob. */
function cssUrl(url: string): string | null {
    let scheme: string;
    try {
        scheme = new URL(url).protocol;
    } catch {
        return null;
    }
    if (scheme !== "https:" && scheme !== "http:" && scheme !== "blob:")
        return null;
    // A CSS string: escape what could end it or the declaration.
    const escaped = url.replace(/[\\"\n\r\f]/g, (c) =>
        c === "\\" || c === '"'
            ? `\\${c}`
            : `\\${c.charCodeAt(0).toString(16)} `,
    );
    return `url("${escaped}")`;
}

/**
 * Inline style for placeholder layers, best first (the first layer paints on
 * top, so a sharper one covers a blurrier one once it arrives). Missing or
 * unusable URLs are skipped; `""` when nothing is left.
 */
export function placeholderStyle(
    urls: readonly (string | null | undefined)[],
): string {
    const layers = urls
        .filter((u): u is string => !!u)
        .map(cssUrl)
        .filter((u): u is string => u !== null);
    if (layers.length === 0) return "";
    return (
        `background-image: ${layers.join(", ")}; ` +
        "background-size: 100% 100%; background-repeat: no-repeat;"
    );
}
