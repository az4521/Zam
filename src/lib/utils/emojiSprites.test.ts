// @vitest-environment node
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import manifest from "$lib/data/emojiSheets.json";
import { EMOJI_CATEGORIES } from "$lib/data/emojis";
import { renderEmoji } from "./twemoji";
import { emojiSpriteStyle, hasEmojiSprite } from "./emojiSprites";

describe("emoji sprite sheets", () => {
    it("cover every picker emoji that Twemoji draws", () => {
        // Fails when the emoji data or the vendored Twemoji changed without
        // re-running scripts/build-emoji-sheets.mjs. Missing emoji would still
        // show (the picker falls back to the SVG), just slowly.
        const missing = EMOJI_CATEGORIES.flatMap((c) => c.emojis)
            .map((e) => e.emoji)
            .filter((e) => renderEmoji(e, "x").includes("<img"))
            .filter((e) => !hasEmojiSprite(e));
        expect(missing).toEqual([]);
    });

    it("ship every sheet the manifest names", () => {
        for (const s of manifest.sheets) {
            const path = fileURLToPath(
                new URL(
                    `../../../static/twemoji/sheets/${s.file}`,
                    import.meta.url,
                ),
            );
            expect(existsSync(path), s.file).toBe(true);
        }
    });

    it("positions a cell by percent of its sheet", () => {
        const first = manifest.sheets[0];
        const style = emojiSpriteStyle(first.emojis[0])!;
        expect(style).toContain(`sheets/${first.file}`);
        expect(style).toContain(
            `background-size:${manifest.cols * 100}% ${first.rows * 100}%`,
        );
        expect(style).toContain("background-position:0% 0%");
        const lastCol = first.emojis[manifest.cols - 1];
        expect(emojiSpriteStyle(lastCol)).toContain(
            "background-position:100% 0%",
        );
    });

    it("has no sprite for text symbols", () => {
        expect(emojiSpriteStyle("™")).toBeNull();
        expect(emojiSpriteStyle("not an emoji")).toBeNull();
    });
});
