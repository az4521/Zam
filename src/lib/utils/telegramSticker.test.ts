import { describe, expect, it } from "vitest";
import { parseStickerSetName, stickerShortcode } from "./telegramSticker";

describe("parseStickerSetName", () => {
    it("accepts the https t.me link", () => {
        expect(parseStickerSetName("https://t.me/addstickers/Pack_1")).toBe(
            "Pack_1",
        );
    });

    it("accepts the scheme-less and www link forms", () => {
        expect(parseStickerSetName("t.me/addstickers/Pack")).toBe("Pack");
        expect(parseStickerSetName("https://www.t.me/addstickers/Pack/")).toBe(
            "Pack",
        );
    });

    it("accepts the tg:// deep link", () => {
        expect(parseStickerSetName("tg://addstickers?set=Cats")).toBe("Cats");
        expect(parseStickerSetName("tg://addstickers?x=1&set=Cats")).toBe(
            "Cats",
        );
    });

    it("accepts a bare name and trims whitespace", () => {
        expect(parseStickerSetName("  Dogs2  ")).toBe("Dogs2");
    });

    it("rejects empty and invalid input", () => {
        expect(parseStickerSetName("")).toBeNull();
        expect(parseStickerSetName("   ")).toBeNull();
        expect(parseStickerSetName("has space")).toBeNull();
        expect(parseStickerSetName("bad-dash")).toBeNull();
        expect(
            parseStickerSetName("https://example.com/addstickers/X"),
        ).toBeNull();
        expect(parseStickerSetName("https://t.me/addstickers/")).toBeNull();
        expect(parseStickerSetName("https://t.me/addstickers/a.b")).toBeNull();
    });
});

describe("stickerShortcode", () => {
    const valid = /^[A-Za-z0-9_.+-]+$/;

    it("numbers stickers from 1 with the set name as prefix", () => {
        expect(stickerShortcode("Cats", 0)).toBe("Cats_1");
        expect(stickerShortcode("Cats", 9)).toBe("Cats_10");
    });

    it("always produces a shortcode that passes validateEmojiShortcode", () => {
        const names = ["Cats", "a".repeat(80), "_leading", "Mix_9_x"];
        for (const name of names) {
            const code = stickerShortcode(name, 3);
            expect(code).toMatch(valid);
            expect(code.length).toBeGreaterThan(0);
        }
    });

    it("caps the prefix so long set names stay short", () => {
        const code = stickerShortcode("a".repeat(80), 0);
        expect(code.length).toBeLessThanOrEqual(32 + 1 + 4);
    });

    it("puts the emoji's name between the set name and the number", () => {
        expect(stickerShortcode("Cats", 2, "joy")).toBe("Cats_joy_3");
    });

    it("cleans the emoji name and drops one with nothing usable left", () => {
        expect(stickerShortcode("Cats", 0, "+1")).toBe("Cats_1_1");
        expect(stickerShortcode("Cats", 0, "---")).toBe("Cats_1");
        expect(stickerShortcode("Cats", 0, "b".repeat(80))).toMatch(
            /^Cats_b{24}_1$/,
        );
    });
});
