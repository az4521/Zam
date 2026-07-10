import DOMPurify from "dompurify";

/**
 * Sanitize untrusted Matrix `formatted_body` HTML (format
 * `org.matrix.custom.html`) before rendering it with `{@html}`.
 *
 * The allowlist mirrors the Matrix spec's permitted subset for
 * `m.room.message`. Anything outside it — event handlers, `<script>`,
 * `<style>`, `javascript:` URLs, inline `style`, etc. — is removed.
 */

export interface SanitizeOptions {
    /** Convert an `mxc://` URI to a loadable HTTP URL (null = drop it). */
    resolveMxc?: (mxc: string) => string | null;
}

// Matrix spec: allowed tags for org.matrix.custom.html
const ALLOWED_TAGS = [
    "font",
    "del",
    "s",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "p",
    "a",
    "ul",
    "ol",
    "sup",
    "sub",
    "li",
    "b",
    "i",
    "u",
    "strong",
    "em",
    "code",
    "hr",
    "br",
    "div",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "caption",
    "pre",
    "span",
    "img",
    "details",
    "summary",
];

// Attribute allowlist (data-* attributes such as data-mx-spoiler are
// permitted separately by DOMPurify's ALLOW_DATA_ATTR default).
const ALLOWED_ATTR = [
    "href",
    "src",
    "alt",
    "title",
    "width",
    "height",
    "name",
    "target",
    "class",
    "color",
    "start",
    "data-mx-color",
    "data-mx-bg-color",
    "data-mx-spoiler",
    "data-mx-maths",
];

// Permit http(s)/ftp/mailto/magnet/matrix links, `mxc://` (rewritten by the
// hook below), relative URLs and `#` fragments. Notably rejects javascript:,
// vbscript:, data: and file: schemes.
const ALLOWED_URI_REGEXP =
    /^(?:(?:https?|ftp|mailto|magnet|matrix|mxc):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

let currentResolveMxc: SanitizeOptions["resolveMxc"];
let hookRegistered = false;

function registerHook(): void {
    if (hookRegistered || !DOMPurify.isSupported) return;
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
        const el = node as Element;
        if (!el.getAttribute) return;
        for (const attr of ["src", "href"] as const) {
            const val = el.getAttribute(attr);
            if (val && val.startsWith("mxc://")) {
                const http = currentResolveMxc?.(val) ?? null;
                if (http) el.setAttribute(attr, http);
                else el.removeAttribute(attr);
            }
        }
        // Any link that opens a new context must not leak window.opener.
        if (el.tagName === "A" && el.getAttribute("target")) {
            el.setAttribute("rel", "noopener noreferrer");
        }
    });
    hookRegistered = true;
}

export function sanitizeMatrixHtml(
    html: string,
    opts?: SanitizeOptions,
): string {
    if (!html) return "";
    // No DOM available (SSR/prerender) — render nothing rather than raw HTML.
    if (!DOMPurify.isSupported) return "";
    registerHook();
    currentResolveMxc = opts?.resolveMxc;
    try {
        return DOMPurify.sanitize(html, {
            ALLOWED_TAGS,
            ALLOWED_ATTR,
            ALLOWED_URI_REGEXP,
            FORBID_TAGS: ["style", "form", "input", "base", "svg", "math"],
            ALLOW_ARIA_ATTR: false,
        }) as string;
    } finally {
        currentResolveMxc = undefined;
    }
}
