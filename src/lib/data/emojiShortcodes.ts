// Discord-style `:shortcode:` names for unicode emoji (`:tm:` → ™,
// `:thumbsup:` → 👍). Discord's names come from JoyPixels (formerly EmojiOne);
// GitHub's gemoji names are folded in as aliases since most people know both.
// The emoji itself is taken from ALL_EMOJIS (unicode-emoji-json), except that
// (c) (R) TM come out as their plain text glyphs ("™", not "™️"), as in Discord.

import joypixels from "emojibase-data/en/shortcodes/joypixels.json";
import github from "emojibase-data/en/shortcodes/github.json";
import { ALL_EMOJIS } from "./emojis";
import { textSymbolPresentation } from "$lib/utils/twemoji";

type ShortcodeData = Record<string, string | string[]>;

// Emojibase keys are uppercase hex codepoints joined by "-", and drop the
// FE0F variation selector inconsistently, so compare with it stripped.
function hexKey(emoji: string): string {
    return [...emoji]
        .map((c) => c.codePointAt(0)!)
        .filter((cp) => cp !== 0xfe0f)
        .map((cp) => cp.toString(16).toUpperCase().padStart(4, "0"))
        .join("-");
}
function normalizeKey(hex: string): string {
    return hex
        .split("-")
        .filter((p) => p !== "FE0F")
        .join("-");
}

const byKey = new Map<string, string[]>();
for (const data of [joypixels, github] as ShortcodeData[]) {
    for (const [hex, codes] of Object.entries(data)) {
        const key = normalizeKey(hex);
        const list = byKey.get(key) ?? [];
        for (const code of Array.isArray(codes) ? codes : [codes])
            if (!list.includes(code)) list.push(code);
        byKey.set(key, list);
    }
}

const shortcodesByEmoji = new Map<string, string[]>();
const emojiByShortcode = new Map<string, string>();
for (const { emoji } of ALL_EMOJIS) {
    const codes = byKey.get(hexKey(emoji));
    if (!codes) continue;
    shortcodesByEmoji.set(emoji, codes);
    // First emoji to claim a name keeps it (JoyPixels before GitHub).
    for (const code of codes)
        if (!emojiByShortcode.has(code))
            emojiByShortcode.set(code, textSymbolPresentation(emoji));
}

/** The `:shortcode:` names of a unicode emoji (without colons), best first. */
export function shortcodesFor(emoji: string): string[] {
    return shortcodesByEmoji.get(emoji) ?? [];
}

/** The unicode emoji a shortcode (without colons) stands for, if any. */
export function emojiForShortcode(code: string): string | undefined {
    return emojiByShortcode.get(code.toLowerCase());
}

// Shortcode characters: GitHub/JoyPixels names use word chars plus "+" and
// "-" (":+1:", ":-1:", ":t-rex:").
const SHORTCODE = "[\\w+-]+";

/**
 * If `before` (the text up to the caret) ends with a complete `:shortcode:`
 * for a unicode emoji, the text with it swapped for the emoji. Used as you
 * type, so closing the colon converts like Discord. `isCustom` names custom
 * emotes, which win and stay as `:shortcode:` tokens.
 */
export function convertTrailingShortcode(
    before: string,
    isCustom: (code: string) => boolean = () => false,
): string | null {
    const m = new RegExp(`:(${SHORTCODE}):$`).exec(before);
    if (!m || isCustom(m[1])) return null;
    const emoji = emojiForShortcode(m[1]);
    return emoji ? before.slice(0, m.index) + emoji : null;
}

/**
 * Replace every `:shortcode:` naming a unicode emoji, outside inline code and
 * code blocks. Catches text that wasn't typed (paste, drafts, edits) at send.
 */
export function replaceEmojiShortcodes(
    text: string,
    isCustom: (code: string) => boolean = () => false,
): string {
    // Odd-indexed parts are inside backtick code (``` blocks or `spans`).
    return text
        .split(/(```[\s\S]*?```|`[^`\n]*`)/)
        .map((part, i) =>
            i % 2 === 1
                ? part
                : part.replace(
                      new RegExp(`:(${SHORTCODE}):`, "g"),
                      (whole, code: string) =>
                          isCustom(code)
                              ? whole
                              : (emojiForShortcode(code) ?? whole),
                  ),
        )
        .join("");
}
