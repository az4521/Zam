// Recently used emoji: the list the picker shows first, synced per account.
//
// Pure logic only. The store (stores/recentEmoji.svelte.ts) owns persistence.
// Account data is untrusted, so everything read back goes through
// `parseRecentEmoji` before the picker sees it.

import { parseMxc } from "./mxcUri";

export const RECENT_EMOJI_LIMIT = 10;

// Generous caps for untrusted input. A ZWJ family sequence is about 25 UTF-16
// units; a flag is 4. Shortcodes in real packs are far shorter.
const MAX_UNICODE_LENGTH = 32;
const MAX_SHORTCODE_LENGTH = 128;
const MAX_MXC_LENGTH = 255;

export type RecentEmoji =
    | { kind: "unicode"; emoji: string }
    | {
          kind: "custom";
          shortcode: string;
          /** The custom emoji's mxc:// URL (CustomEmoji.mxcUrl). */
          url: string;
      };

/** Identity of a recent entry: the character for unicode, the image for custom. */
export function recentEmojiKey(item: RecentEmoji): string {
    return item.kind === "unicode" ? "u:" + item.emoji : "c:" + item.url;
}

/**
 * `item` first, any earlier copy of it removed, capped at the limit. Returns a
 * new array; `list` is never mutated.
 */
export function pushRecentEmoji(
    list: readonly RecentEmoji[],
    item: RecentEmoji,
): RecentEmoji[] {
    const key = recentEmojiKey(item);
    return [item, ...list.filter((e) => recentEmojiKey(e) !== key)].slice(
        0,
        RECENT_EMOJI_LIMIT,
    );
}

// Control characters, whitespace and the characters that would matter if a
// value ever reached markup. Real emoji and shortcodes contain none of them.
const UNSAFE_CHARS = /[\s<>&"'`\\\u0000-\u001f\u007f]/;

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseEntry(raw: unknown): RecentEmoji | null {
    if (!isPlainObject(raw)) return null;
    if (raw.kind === "unicode") {
        const emoji = raw.emoji;
        if (
            typeof emoji !== "string" ||
            emoji.length === 0 ||
            emoji.length > MAX_UNICODE_LENGTH ||
            UNSAFE_CHARS.test(emoji)
        )
            return null;
        return { kind: "unicode", emoji };
    }
    if (raw.kind === "custom") {
        const shortcode = raw.shortcode;
        const url = raw.url;
        if (
            typeof shortcode !== "string" ||
            shortcode.length === 0 ||
            shortcode.length > MAX_SHORTCODE_LENGTH ||
            UNSAFE_CHARS.test(shortcode)
        )
            return null;
        if (
            typeof url !== "string" ||
            url.length > MAX_MXC_LENGTH ||
            parseMxc(url) === null
        )
            return null;
        return { kind: "custom", shortcode, url };
    }
    return null;
}

/**
 * The stored list from account data (`{ items }`'s items), validated. Anything
 * malformed is dropped entry by entry; duplicates keep their first position.
 * Rebuilt objects, so unknown extra fields never survive.
 */
export function parseRecentEmoji(raw: unknown): RecentEmoji[] {
    if (!Array.isArray(raw)) return [];
    const out: RecentEmoji[] = [];
    const seen = new Set<string>();
    for (const entry of raw) {
        if (out.length >= RECENT_EMOJI_LIMIT) break;
        const item = parseEntry(entry);
        if (!item) continue;
        const key = recentEmojiKey(item);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
    }
    return out;
}
