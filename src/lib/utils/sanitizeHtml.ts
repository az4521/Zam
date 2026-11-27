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
    /**
     * Sprite for a custom emoticon (`<img data-mx-emoticon>`) by its mxc URI,
     * from a pack sprite sheet (see matrix/packSheets.ts). A still sprite
     * replaces the image with a 1x1 transparent GIF painted by `style`. An
     * animated sprite is ignored: the plain <img> is kept, because a poster
     * under animated pixels shows through their transparent areas. Null, an
     * animated sprite, or a missing option keeps the plain <img>.
     */
    emoticonSprite?: (mxc: string) => EmoticonSprite | null;
}

export interface EmoticonSprite {
    /** CSS declarations from spriteFor; only blob: backgrounds are accepted. */
    style: string;
    animated: boolean;
}

/** 1x1 transparent GIF, so a sprite-painted emoticon loads no remote bytes. */
const BLANK_GIF =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
/** Only the shape spriteFor emits: a blob: background and nothing else. */
const SPRITE_STYLE = /^background-image:url\("blob:[^"'()\\;<>\s]+"\);/;

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
    // Zam inline timestamp (see inlineTimestamp.ts); attributes below.
    "time",
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
    "datetime",
    "data-zam-ts-style",
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
    // Zam inline timestamp only: the value is validated where it is rendered.
    time: new Set(["datetime", "data-zam-ts-style"]),
};
const HREF_SCHEME = /^(?:https?|ftp|mailto|magnet|matrix):/i;

// Permit http(s)/ftp/mailto/magnet/matrix links, `mxc://` (rewritten by the
// hook below), relative URLs and `#` fragments. Notably rejects javascript:,
// vbscript:, data: and file: schemes.
const ALLOWED_URI_REGEXP =
    /^(?:(?:https?|ftp|mailto|magnet|matrix|mxc):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

let currentResolveMxc: SanitizeOptions["resolveMxc"];
let currentEmoticonSprite: SanitizeOptions["emoticonSprite"];
let hookRegistered = false;

/** The sprite for an emoticon <img> whose src is still its mxc URI, or null. */
function emoticonSpriteFor(el: Element): EmoticonSprite | null {
    if (!currentEmoticonSprite) return null;
    if (el.tagName !== "IMG" || !el.hasAttribute("data-mx-emoticon"))
        return null;
    const mxc = el.getAttribute("src");
    if (!mxc || !mxc.startsWith("mxc://")) return null;
    const sprite = currentEmoticonSprite(mxc);
    if (!sprite || sprite.animated === true) return null;
    if (typeof sprite.style !== "string") return null;
    if (!SPRITE_STYLE.test(sprite.style)) return null;
    return { style: sprite.style, animated: false };
}

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
        // This hook runs after DOMPurify has checked the attributes, so what
        // is set here is not re-checked. Only the sprite style is set here,
        // and only from spriteFor's output (see SPRITE_STYLE).
        const sprite = emoticonSpriteFor(el);
        for (const attr of ["src", "href"] as const) {
            const val = el.getAttribute(attr);
            if (val && val.startsWith("mxc://")) {
                if (sprite && attr === "src") {
                    el.setAttribute("src", BLANK_GIF);
                    continue;
                }
                const http = currentResolveMxc?.(val) ?? null;
                if (http) el.setAttribute(attr, http);
                else el.removeAttribute(attr);
            }
        }
        if (sprite) el.setAttribute("style", sprite.style);
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
    currentEmoticonSprite = opts?.emoticonSprite;
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
        currentEmoticonSprite = undefined;
    }
}
