import { describe, it, expect } from "vitest";
import { loadEmojiData } from "./emojis";
import { EMOJI_SEQUENCE } from "./emojiSequence";

describe("emoji dataset", () => {
    it("includes common base emoji that support skin tones", async () => {
        const { all } = await loadEmojiData();
        const set = new Set(all.map((e) => e.emoji));
        // These are base emoji flagged skin_tone_support: true — they must NOT
        // be filtered out (the dataset has one entry per base emoji).
        expect(set.has("👋")).toBe(true); // waving hand
        expect(set.has("👍")).toBe(true); // thumbs up
        expect(set.has("🙏")).toBe(true); // folded hands
    });

    it("keeps a well-populated People & Body category", async () => {
        const { categories } = await loadEmojiData();
        const people = categories.find((c) => c.name === "People & Body");
        expect(people).toBeTruthy();
        expect(people!.emojis.length).toBeGreaterThan(100);
    });

    it("matches the static order list the shortcode maps are built from", async () => {
        const { all } = await loadEmojiData();
        expect(all.map((e) => e.emoji)).toEqual([...EMOJI_SEQUENCE]);
    });
});
