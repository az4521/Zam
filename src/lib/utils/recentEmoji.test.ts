import { describe, it, expect } from "vitest";
import {
    RECENT_EMOJI_LIMIT,
    parseRecentEmoji,
    pushRecentEmoji,
    type RecentEmoji,
} from "./recentEmoji";

const u = (emoji: string): RecentEmoji => ({ kind: "unicode", emoji });
const c = (shortcode: string, n = shortcode): RecentEmoji => ({
    kind: "custom",
    shortcode,
    url: `mxc://example.org/${n}`,
});

describe("pushRecentEmoji", () => {
    it("puts a new item first and keeps the rest in order", () => {
        const out = pushRecentEmoji([u("a"), u("b")], u("c"));
        expect(out).toEqual([u("c"), u("a"), u("b")]);
    });

    it("moves an existing unicode emoji to the front without duplicating it", () => {
        const out = pushRecentEmoji([u("a"), u("b"), u("c")], u("c"));
        expect(out).toEqual([u("c"), u("a"), u("b")]);
    });

    it("moves an existing custom emoji to the front by its mxc url", () => {
        const list = [c("x", "1"), c("y", "2")];
        const out = pushRecentEmoji(list, c("y", "2"));
        expect(out).toEqual([c("y", "2"), c("x", "1")]);
    });

    it("treats a unicode and a custom entry as different even with similar text", () => {
        const out = pushRecentEmoji([c("smile", "1")], u("smile"));
        expect(out).toHaveLength(2);
    });

    it("keeps a custom emoji whose shortcode is re-used for a different image", () => {
        const out = pushRecentEmoji([c("blob", "old")], c("blob", "new"));
        expect(out).toEqual([c("blob", "new"), c("blob", "old")]);
    });

    it("caps the list at the limit, dropping the oldest", () => {
        let list: RecentEmoji[] = [];
        for (let i = 0; i < RECENT_EMOJI_LIMIT + 3; i++) {
            list = pushRecentEmoji(list, u(`e${i}`));
        }
        expect(list).toHaveLength(RECENT_EMOJI_LIMIT);
        expect(list[0]).toEqual(u(`e${RECENT_EMOJI_LIMIT + 2}`));
        expect(list.at(-1)).toEqual(u("e3"));
    });

    it("does not mutate the list it was given", () => {
        const list = [u("a")];
        pushRecentEmoji(list, u("b"));
        expect(list).toEqual([u("a")]);
    });

    it("limit is 10", () => {
        expect(RECENT_EMOJI_LIMIT).toBe(10);
    });
});

describe("parseRecentEmoji", () => {
    it("returns an empty list for anything that is not an array", () => {
        for (const raw of [null, undefined, "x", 3, {}, { 0: u("a") }]) {
            expect(parseRecentEmoji(raw)).toEqual([]);
        }
    });

    it("keeps well-formed unicode and custom entries in order", () => {
        const raw = [
            { kind: "unicode", emoji: "😀" },
            { kind: "custom", shortcode: "blob", url: "mxc://h.org/abc_-1" },
        ];
        expect(parseRecentEmoji(raw)).toEqual([
            u("😀"),
            { kind: "custom", shortcode: "blob", url: "mxc://h.org/abc_-1" },
        ]);
    });

    it("drops entries that are not objects or have an unknown kind", () => {
        const raw = [null, "😀", 1, [], { kind: "sticker", emoji: "😀" }];
        expect(parseRecentEmoji(raw)).toEqual([]);
    });

    it("drops unicode entries with a non-string, empty, oversized or unsafe value", () => {
        const raw = [
            { kind: "unicode", emoji: 5 },
            { kind: "unicode", emoji: "" },
            { kind: "unicode", emoji: "x".repeat(33) },
            { kind: "unicode", emoji: "<img src=x>" },
            { kind: "unicode", emoji: "a\u0000b" },
            { kind: "unicode", emoji: "a b" },
        ];
        expect(parseRecentEmoji(raw)).toEqual([]);
    });

    it("drops custom entries whose url is not a strict mxc uri", () => {
        const raw = [
            { kind: "custom", shortcode: "a", url: "https://h.org/x" },
            { kind: "custom", shortcode: "a", url: "mxc://h.org/a/b" },
            { kind: "custom", shortcode: "a", url: "mxc://h.org/../x" },
            { kind: "custom", shortcode: "a", url: "mxc://h.org/x?y" },
            {
                kind: "custom",
                shortcode: "a",
                url: "mxc://h.org/" + "x".repeat(300),
            },
            { kind: "custom", shortcode: "a", url: 7 },
        ];
        expect(parseRecentEmoji(raw)).toEqual([]);
    });

    it("drops custom entries with a bad shortcode", () => {
        const raw = [
            { kind: "custom", shortcode: "", url: "mxc://h.org/x" },
            {
                kind: "custom",
                shortcode: "x".repeat(129),
                url: "mxc://h.org/x",
            },
            { kind: "custom", shortcode: "a:b\n", url: "mxc://h.org/x" },
            { kind: "custom", url: "mxc://h.org/x" },
        ];
        expect(parseRecentEmoji(raw)).toEqual([]);
    });

    it("de-duplicates, keeping the first position", () => {
        const raw = [
            { kind: "unicode", emoji: "a" },
            { kind: "unicode", emoji: "b" },
            { kind: "unicode", emoji: "a" },
            { kind: "custom", shortcode: "x", url: "mxc://h.org/1" },
            { kind: "custom", shortcode: "y", url: "mxc://h.org/1" },
        ];
        expect(parseRecentEmoji(raw)).toEqual([
            u("a"),
            u("b"),
            { kind: "custom", shortcode: "x", url: "mxc://h.org/1" },
        ]);
    });

    it("caps the result at the limit even when more valid entries arrive", () => {
        const raw = Array.from({ length: 50 }, (_, i) => ({
            kind: "unicode",
            emoji: `e${i}`,
        }));
        const out = parseRecentEmoji(raw);
        expect(out).toHaveLength(RECENT_EMOJI_LIMIT);
        expect(out[0]).toEqual(u("e0"));
    });

    it("skips bad entries without dropping the good ones around them", () => {
        const raw = [
            null,
            { kind: "unicode", emoji: "👍" },
            { kind: "unicode", emoji: 9 },
            { kind: "unicode", emoji: "🎉" },
        ];
        expect(parseRecentEmoji(raw)).toEqual([u("👍"), u("🎉")]);
    });

    it("does not carry unknown fields through", () => {
        const raw = [{ kind: "unicode", emoji: "a", extra: "<script>" }];
        const out = parseRecentEmoji(raw);
        expect(out).toEqual([u("a")]);
        expect(Object.keys(out[0])).toEqual(["kind", "emoji"]);
    });
});
