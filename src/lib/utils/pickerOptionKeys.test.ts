import { describe, it, expect } from "vitest";
import { emojiOptionKeys, stickerOptionKeys } from "./pickerOptionKeys";

const custom = (
    packId: string,
    shortcode: string,
    mxcUrl = "mxc://s/" + shortcode,
) => ({
    kind: "custom" as const,
    data: { packId, shortcode, mxcUrl },
});
const standard = (emoji: string, name: string) => ({
    kind: "standard" as const,
    data: { emoji, name },
});

describe("emojiOptionKeys", () => {
    it("keys a standard emoji by the character it would insert", () => {
        expect(emojiOptionKeys([standard("😀", "grinning")])).toEqual([
            "s\u0000😀",
        ]);
    });

    it("keys a custom emoji by its pack, shortcode and mxc url", () => {
        expect(
            emojiOptionKeys([custom("room:!a", "blob", "mxc://h/1")]),
        ).toEqual(["c\u0000room:!a\u0000blob\u0000mxc://h/1"]);
    });

    it("never lets a custom key collide with a standard one", () => {
        const keys = emojiOptionKeys([
            standard("x", "x"),
            custom("p", "x", "x"),
        ]);
        expect(new Set(keys).size).toBe(2);
    });

    it("distinguishes the same shortcode in two different packs", () => {
        const keys = emojiOptionKeys([
            custom("packA", "blob"),
            custom("packB", "blob"),
        ]);
        expect(new Set(keys).size).toBe(2);
    });

    it("distinguishes one shortcode re-pointed at a different image", () => {
        const keys = emojiOptionKeys([
            custom("p", "blob", "mxc://h/old"),
            custom("p", "blob", "mxc://h/new"),
        ]);
        expect(new Set(keys).size).toBe(2);
    });

    it("preserves order and length", () => {
        const keys = emojiOptionKeys([
            standard("a", "a"),
            custom("p", "b"),
            standard("c", "c"),
        ]);
        expect(keys).toHaveLength(3);
        expect(keys[1]).toContain("b");
    });

    it("returns an empty array for an empty list", () => {
        expect(emojiOptionKeys([])).toEqual([]);
    });
});

describe("stickerOptionKeys", () => {
    it("keys a sticker by its shortcode and mxc url", () => {
        expect(
            stickerOptionKeys([{ shortcode: "wave", mxcUrl: "mxc://h/w" }]),
        ).toEqual(["c\u0000\u0000wave\u0000mxc://h/w"]);
    });

    it("distinguishes two stickers sharing a shortcode", () => {
        const keys = stickerOptionKeys([
            { shortcode: "wave", mxcUrl: "mxc://h/1" },
            { shortcode: "wave", mxcUrl: "mxc://h/2" },
        ]);
        expect(new Set(keys).size).toBe(2);
    });

    it("returns an empty array for an empty list", () => {
        expect(stickerOptionKeys([])).toEqual([]);
    });
});
