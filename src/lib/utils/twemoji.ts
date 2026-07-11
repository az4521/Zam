import twemoji from "@twemoji/api";

// Self-hosted copy of jdecked/twemoji@314c9f493f5609ab3a2691fba9650827c3e317a1
// assets/svg, vendored in static/twemoji (see the README there). Root-absolute
// works on every target: web/PWA, Electron (localhost HTTP server) and
// Capacitor (local origin).
export const TWEMOJI_BASE = "/twemoji/";

function escapeAttr(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/**
 * True when the string is composed solely of emoji (pictographic characters,
 * variation selectors and ZWJ). Used as a safety gate before rendering a
 * value as raw HTML — arbitrary text (e.g. a hostile reaction key) returns
 * false and must be rendered as escaped text instead.
 */
export function isEmojiOnly(s: string): boolean {
    if (!s) return false;
    return /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|️|‍)+$/u.test(s);
}

function fallback(emoji: string, className: string): string {
    try {
        const cp = twemoji.convert.toCodePoint(emoji);
        return `<img src="${TWEMOJI_BASE}svg/${cp}.svg" alt="${escapeAttr(emoji)}" class="${className}" draggable="false" />`;
    } catch {
        return escapeAttr(emoji);
    }
}

/**
 * Render a single emoji character as a Twemoji <img> tag.
 * Falls back to manual URL construction for emoji newer than the npm package.
 */
export function renderEmoji(emoji: string, className: string): string {
    const result = twemoji.parse(emoji, {
        folder: "svg",
        ext: ".svg",
        base: TWEMOJI_BASE,
        className,
    }) as string;
    return result.includes("<img") ? result : fallback(emoji, className);
}

/**
 * Process an HTML string, replacing emoji with Twemoji <img> tags.
 * Does a second pass on text nodes to catch emoji newer than the npm package.
 */
export function renderHtml(html: string, className: string): string {
    const result = twemoji.parse(html, {
        folder: "svg",
        ext: ".svg",
        base: TWEMOJI_BASE,
        className,
    }) as string;

    // Second pass: only process text between tags (avoids mangling alt attributes)
    return result.replace(/>([^<]+)</g, (_match, text: string) => {
        const processed = text.replace(
            /\p{Extended_Pictographic}(\u200D\p{Extended_Pictographic})*/gu,
            (e) => fallback(e, className),
        );
        return `>${processed}<`;
    });
}
