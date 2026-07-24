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

// Attribute allowlist. This is the OUTER gate DOMPurify applies to every tag;
// the per-tag `uponSanitizeAttribute` hook below narrows it to the spec's
// tag-specific subset. `data-mx-*` names are listed explicitly so they survive
// `ALLOW_DATA_ATTR: false` (which blocks all other generic `data-*`).
const ALLOWED_ATTR = [
    "href",
    "src",
    "alt",
    "title",
    "width",
    "height",
    "target",
    "class",
    "color",
    "start",
    "data-mx-color",
    "data-mx-bg-color",
    "data-mx-spoiler",
    "data-mx-maths",
    "data-mx-emoticon",
];

// Spec v1.19 m.room.message HTML subset: which attrs are legal on which tag.
const PER_TAG_ATTRS: Record<string, Set<string>> = {
    a: new Set(["href", "target", "rel", "title"]),
    img: new Set([
        "src",
        "alt",
        "title",
        "width",
        "height",
        "data-mx-emoticon",
    ]),
    font: new Set(["color", "data-mx-color", "data-mx-bg-color"]),
    span: new Set([
        "data-mx-color",
        "data-mx-bg-color",
        "data-mx-spoiler",
        "data-mx-maths",
    ]),
    div: new Set(["data-mx-maths"]),
    code: new Set(["class"]),
    ol: new Set(["start"]),
};
const HREF_SCHEME = /^(?:https?|ftp|mailto|magnet|matrix):/i;

// Permit http(s)/ftp/mailto/magnet/matrix links, `mxc://` (rewritten by the
// hook below), relative URLs and `#` fragments. Notably rejects javascript:,
// vbscript:, data: and file: schemes.
const ALLOWED_URI_REGEXP =
    /^(?:(?:https?|ftp|mailto|magnet|matrix|mxc):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

let currentResolveMxc: SanitizeOptions["resolveMxc"];
let hookRegistered = false;

function registerHook(): void {
    if (hookRegistered || !DOMPurify.isSupported) return;
    // Per-tag allowlist: reject any attribute not legal on its own tag, gate
    // href schemes, and require img src to be a Matrix Content URI (mxc://).
    DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
        const tag = (node as Element).tagName?.toLowerCase();
        if (!tag) return;
        const allowed = PER_TAG_ATTRS[tag];
        if (!allowed?.has(data.attrName)) {
            data.keepAttr = false;
            return;
        }
        if (tag === "code" && data.attrName === "class") {
            const langs = data.attrValue
                .split(/\s+/)
                .filter((c) => c.startsWith("language-"));
            if (!langs.length) {
                data.keepAttr = false;
                return;
            }
            data.attrValue = langs.join(" ");
        }
        if (
            tag === "img" &&
            data.attrName === "src" &&
            !data.attrValue.startsWith("mxc://")
        ) {
            data.keepAttr = false; // spec: img src must be a Matrix Content URI
        }
        if (
            tag === "a" &&
            data.attrName === "href" &&
            !HREF_SCHEME.test(data.attrValue)
        ) {
            data.keepAttr = false; // spec: not relative, listed schemes only (+ matrix:)
        }
    });
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
            ALLOW_DATA_ATTR: false,
        }) as string;
    } finally {
        currentResolveMxc = undefined;
    }
}
