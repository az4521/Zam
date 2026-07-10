import { describe, it, expect } from "vitest";
import { ALL_EMOJIS, EMOJI_CATEGORIES } from "./emojis";

describe("emoji dataset", () => {
    it("includes common base emoji that support skin tones", () => {
        const set = new Set(ALL_EMOJIS.map((e) => e.emoji));
        // These are base emoji flagged skin_tone_support: true — they must NOT
        // be filtered out (the dataset has one entry per base emoji).
        expect(set.has("👋")).toBe(true); // waving hand
        expect(set.has("👍")).toBe(true); // thumbs up
        expect(set.has("🙏")).toBe(true); // folded hands
    });

    it("keeps a well-populated People & Body category", () => {
        const people = EMOJI_CATEGORIES.find((c) => c.name === "People & Body");
        expect(people).toBeTruthy();
        expect(people!.emojis.length).toBeGreaterThan(100);
    });
});
