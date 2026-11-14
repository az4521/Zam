// Picker emoji drawn from the per-category Twemoji sprite sheets made by
// scripts/build-emoji-sheets.mjs. An <img> per Twemoji SVG makes the browser
// build an SVG document per emoji on the main thread, which janked the picker
// on every row it scrolled in; a sheet is one PNG that decodes off-thread.
import manifest from "$lib/data/emojiSheets.json";
import { TWEMOJI_BASE } from "./twemoji";

interface Sprite {
    file: string;
    rows: number;
    index: number;
}

let byEmoji: Map<string, Sprite> | null = null;

function lookup(emoji: string): Sprite | undefined {
    if (!byEmoji) {
        byEmoji = new Map();
        for (const sheet of manifest.sheets)
            sheet.emojis.forEach((e, index) => {
                if (e)
                    byEmoji!.set(e, {
                        file: sheet.file,
                        rows: sheet.rows,
                        index,
                    });
            });
    }
    return byEmoji.get(emoji);
}

export function hasEmojiSprite(emoji: string): boolean {
    return lookup(emoji) !== undefined;
}

/** CSS placing `emoji`'s cell of its sheet as a background, or null. */
export function emojiSpriteStyle(emoji: string): string | null {
    const s = lookup(emoji);
    if (!s) return null;
    const cols = manifest.cols;
    const col = s.index % cols;
    const row = Math.floor(s.index / cols);
    // Percent positions: 0% puts the first cell at the left, 100% the last.
    const x = cols > 1 ? (col / (cols - 1)) * 100 : 0;
    const y = s.rows > 1 ? (row / (s.rows - 1)) * 100 : 0;
    return (
        `background-image:url(${TWEMOJI_BASE}sheets/${s.file});` +
        `background-size:${cols * 100}% ${s.rows * 100}%;` +
        `background-position:${x}% ${y}%`
    );
}
