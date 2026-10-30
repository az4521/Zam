/**
 * Pin a decrypted attachment's blob MIME type to a safe allowlist (audit
 * SEC-L9). The `mimetype` on an `m.room.encrypted` attachment is
 * sender-controlled, and `fetchDecryptedAttachmentBlob` wraps the plaintext in
 * a `Blob` with that type before handing out an object URL. Today those object
 * URLs are only consumed by `<img>/<video>/<audio>` or `<a download>` — all
 * inert — but the moment any "open in a new tab" / iframe sink appears, a blob
 * typed `text/html` or `image/svg+xml` would execute the sender's script in our
 * origin. Forcing every non-media type to `application/octet-stream` closes
 * that in advance; a downloaded blob is MIME-agnostic (the filename drives the
 * app association), so nothing legitimate regresses.
 */

import DOMPurify from "dompurify";

const OCTET_STREAM = "application/octet-stream";
const SVG = "image/svg+xml";

/**
 * The safe blob MIME for a decrypted attachment: the sender's type when it is an
 * inert media type this app renders in `<img>/<video>/<audio>`, otherwise
 * `application/octet-stream`.
 *
 * `image/svg+xml` is deliberately EXCLUDED even though it is `image/*`: an SVG
 * can run script if its blob URL is ever navigated to or iframed. Types are
 * validated case-insensitively and with any `; parameters` stripped, but an
 * allowed value is returned verbatim (trimmed) so a legitimate
 * `video/mp4; codecs="…"` keeps its playback hint.
 */
export function safeAttachmentMimeType(
    mimetype: string | null | undefined,
): string {
    if (!mimetype) return OCTET_STREAM;
    const trimmed = mimetype.trim();
    if (!trimmed) return OCTET_STREAM;
    // Validate on the bare type: lower-cased, parameters removed.
    const base = trimmed.toLowerCase().split(";")[0].trim();
    if (base === "image/svg+xml") return OCTET_STREAM;
    if (
        base.startsWith("image/") ||
        base.startsWith("video/") ||
        base.startsWith("audio/")
    ) {
        return trimmed;
    }
    return OCTET_STREAM;
}

/** True when `mimetype` is SVG, ignoring case and parameters. */
export function isSvgMimeType(mimetype: string | null | undefined): boolean {
    return (mimetype ?? "").toLowerCase().split(";")[0].trim() === SVG;
}

/** SMIL animation values. DOMPurify drops them all because an animation of
 *  `href` could set it to `javascript:`; svgPurifier allows them on anything
 *  else, so animated SVGs keep moving. */
const ANIMATION_VALUES = new Set(["from", "to", "by", "values"]);

/** A CSS `url(...)` that points anywhere but the same document (`url(#id)`). */
const EXTERNAL_URL_SRC = String.raw`url\(\s*['"]?\s*(?!#)[^)]`;
const EXTERNAL_URL = new RegExp(EXTERNAL_URL_SRC, "i");
const EXTERNAL_URL_GLOBAL = new RegExp(EXTERNAL_URL_SRC + "[^)]*\\)?", "gi");

let purifier: ReturnType<typeof DOMPurify> | null = null;

/**
 * A DOMPurify instance of our own. The default export is shared with
 * sanitizeHtml.ts, whose global hooks drop every attribute not on its
 * message-HTML allowlist, which left every SVG blank once a formatted message
 * had been rendered.
 */
function svgPurifier(): ReturnType<typeof DOMPurify> {
    if (purifier) return purifier;
    purifier = DOMPurify(window);
    purifier.addHook("uponSanitizeAttribute", (node, data) => {
        // An SVG opened as a document (blob URL in a tab) fetches whatever it
        // references, which tells the sender who opened it. Keep only
        // same-document references and embedded raster data.
        if (
            /^(?:xlink:)?href$/i.test(data.attrName) &&
            !/^\s*(?:#|data:image\/(?:png|jpe?g|gif|webp);)/i.test(
                data.attrValue,
            )
        ) {
            data.keepAttr = false;
            return;
        }
        if (EXTERNAL_URL.test(data.attrValue)) {
            data.keepAttr = false;
            return;
        }
        if (!ANIMATION_VALUES.has(data.attrName)) return;
        const target = (node as Element).getAttribute("attributeName") ?? "";
        if (/href/i.test(target)) data.keepAttr = false;
    });
    // <style> text isn't an attribute: strip imports and non-fragment url()s.
    purifier.addHook("afterSanitizeElements", (node) => {
        if (node.nodeName.toLowerCase() !== "style") return;
        node.textContent = (node.textContent ?? "")
            .replace(/@import[^;]*;?/gi, "")
            .replace(EXTERNAL_URL_GLOBAL, "none");
    });
    return purifier;
}

/**
 * An encrypted SVG made safe to keep its real type. safeAttachmentMimeType
 * turns SVG into octet-stream, which an `<img>` won't render at all, so an
 * E2EE SVG showed as a broken image. Instead the markup is parsed as XML and
 * run through DOMPurify's SVG profile (no `<script>`, no `on*` handlers, no
 * `javascript:` links, no `<foreignObject>`), so the `image/svg+xml` blob stays
 * inert even if its URL is opened in a tab of our origin. Null when the bytes
 * aren't a well-formed SVG; the caller then keeps the octet-stream blob.
 */
export function sanitizedSvgBlob(bytes: ArrayBuffer | Uint8Array): Blob | null {
    const text = new TextDecoder().decode(bytes);
    const doc = new DOMParser().parseFromString(text, SVG);
    const root = doc.documentElement;
    if (
        root.localName !== "svg" ||
        doc.getElementsByTagName("parsererror").length
    )
        return null;
    svgPurifier().sanitize(root, {
        IN_PLACE: true,
        USE_PROFILES: { svg: true, svgFilters: true },
        ADD_ATTR: [...ANIMATION_VALUES],
    });
    return new Blob([new XMLSerializer().serializeToString(root)], {
        type: SVG,
    });
}

/**
 * `blob` retyped by the rules above, for any media we wrap in an object URL
 * ourselves. Unencrypted homeserver media is just as sender-controlled as an
 * encrypted attachment: the server's response carries a sandbox CSP that keeps
 * an SVG inert, but a blob URL has no headers and belongs to our origin, so
 * the same allowlist and SVG sanitizing apply. `mimetype` defaults to the
 * blob's own (the response's Content-Type).
 */
export async function safeMediaBlob(
    blob: Blob,
    mimetype: string | null | undefined = blob.type,
): Promise<Blob> {
    if (isSvgMimeType(mimetype)) {
        const svg = sanitizedSvgBlob(await blob.arrayBuffer());
        if (svg) return svg;
    }
    const type = safeAttachmentMimeType(mimetype);
    return type === blob.type ? blob : new Blob([blob], { type });
}
