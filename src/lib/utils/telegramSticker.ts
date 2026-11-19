// Pure helpers for importing a Telegram sticker set. No network, no SDK.

const SET_NAME_RE = /^[A-Za-z0-9_]+$/;
const MAX_PREFIX_LENGTH = 32;

/**
 * Accepts a sticker set link or bare name and returns the set name, or null
 * when the input is not a usable Telegram sticker set reference.
 *
 *   https://t.me/addstickers/Name
 *   t.me/addstickers/Name
 *   tg://addstickers?set=Name
 *   Name
 */
export function parseStickerSetName(input: string): string | null {
    const value = input.trim();
    if (!value) return null;

    const link = value.match(
        /^(?:https?:\/\/)?(?:www\.)?t\.me\/addstickers\/([^/?#\s]+)\/?$/i,
    );
    if (link) return validSetName(link[1]);

    const deepLink = value.match(
        /^tg:\/\/addstickers\?(?:[^#\s]*&)?set=([^&#\s]+)$/i,
    );
    if (deepLink) return validSetName(deepLink[1]);

    return validSetName(value);
}

function validSetName(candidate: string): string | null {
    return SET_NAME_RE.test(candidate) ? candidate : null;
}

/**
 * Builds a user-sticker shortcode that passes validateEmojiShortcode
 * (`[A-Za-z0-9_.+-]+`). The index is 0-based and becomes a 1-based suffix, so
 * stickers from one set get distinct, stable names: re-importing the same set
 * maps onto the same shortcodes instead of piling up new ones.
 */
export function stickerShortcode(setName: string, index: number): string {
    const prefix = setName
        .replace(/[^A-Za-z0-9_]+/g, "_")
        .slice(0, MAX_PREFIX_LENGTH)
        .replace(/^_+|_+$/g, "");
    const base = prefix || "sticker";
    return `${base}_${index + 1}`;
}
