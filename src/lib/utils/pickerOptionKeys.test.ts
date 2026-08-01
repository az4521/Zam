import { describe, it, expect } from "vitest";
import { emojiOptionKeys, stickerOptionKeys } from "./pickerOptionKeys";
import { anchoredActiveIndex } from "./listboxAnchor";
import { clampActiveIndex } from "./listboxNavigation";

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

describe("anchoring a picker cursor across a list rewrite", () => {
    it("drops the active option when a sync inserts an emoji above the cursor", () => {
        const before = [
            custom("p", "aa"),
            custom("p", "bb"),
            custom("p", "cc"),
        ];
        const keysBefore = emojiOptionKeys(before);
        // The user arrowed onto "bb".
        const cursor = 1;
        const anchor = keysBefore[cursor];
        expect(anchoredActiveIndex(cursor, anchor, keysBefore)).toBe(1);

        // A sync rewrites the pack, inserting one emoji at the FRONT. Index 1
        // is still a real option, so a clamp sees nothing wrong.
        const after = [custom("p", "zz"), ...before];
        const keysAfter = emojiOptionKeys(after);
        expect(clampActiveIndex(cursor, keysAfter.length)).toBe(1);

        // The anchor refuses it: "bb" is no longer at index 1.
        expect(anchoredActiveIndex(cursor, anchor, keysAfter)).toBe(-1);
    });

    it("does not chase the emoji to its new index", () => {
        const before = emojiOptionKeys([custom("p", "aa"), custom("p", "bb")]);
        const after = emojiOptionKeys([
            custom("p", "zz"),
            custom("p", "aa"),
            custom("p", "bb"),
        ]);
        // "bb" moved from 1 to 2; the answer is "nothing active", not 2.
        expect(anchoredActiveIndex(1, before[1], after)).toBe(-1);
    });

    it("keeps the cursor when the rewrite happens BELOW it", () => {
        const before = emojiOptionKeys([custom("p", "aa"), custom("p", "bb")]);
        const after = emojiOptionKeys([
            custom("p", "aa"),
            custom("p", "bb"),
            custom("p", "cc"),
        ]);
        expect(anchoredActiveIndex(1, before[1], after)).toBe(1);
    });

    it("drops the active option when a sync inserts a sticker above the cursor", () => {
        const before = [
            { shortcode: "aa", mxcUrl: "mxc://h/aa" },
            { shortcode: "bb", mxcUrl: "mxc://h/bb" },
        ];
        const keysBefore = stickerOptionKeys(before);
        const anchor = keysBefore[1];
        const keysAfter = stickerOptionKeys([
            { shortcode: "zz", mxcUrl: "mxc://h/zz" },
            ...before,
        ]);
        expect(clampActiveIndex(1, keysAfter.length)).toBe(1);
        expect(anchoredActiveIndex(1, anchor, keysAfter)).toBe(-1);
    });

    it("drops the active option when a pack re-points a shortcode at a new image", () => {
        const keysBefore = stickerOptionKeys([
            { shortcode: "wave", mxcUrl: "mxc://h/old" },
        ]);
        const keysAfter = stickerOptionKeys([
            { shortcode: "wave", mxcUrl: "mxc://h/new" },
        ]);
        expect(anchoredActiveIndex(0, keysBefore[0], keysAfter)).toBe(-1);
    });
});
