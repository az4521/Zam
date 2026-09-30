import { describe, it, expect } from "vitest";
import {
    applyPackMeta,
    hasEmoteRoom,
    parseEmoteRooms,
    uniqueShortcode,
    withEmoteRoom,
} from "./emotePacks";

describe("parseEmoteRooms", () => {
    it("lists every room and state key", () => {
        expect(
            parseEmoteRooms({
                rooms: { "!a:x": { "": {}, big: {} }, "!b:x": { "": {} } },
            }),
        ).toEqual([
            { roomId: "!a:x", stateKey: "" },
            { roomId: "!a:x", stateKey: "big" },
            { roomId: "!b:x", stateKey: "" },
        ]);
    });
    it("tolerates missing or malformed content", () => {
        expect(parseEmoteRooms(undefined)).toEqual([]);
        expect(parseEmoteRooms({})).toEqual([]);
        expect(parseEmoteRooms({ rooms: [] as never })).toEqual([]);
        expect(parseEmoteRooms({ rooms: { nope: { "": {} } } })).toEqual([]);
        expect(parseEmoteRooms({ rooms: { "!a:x": null as never } })).toEqual(
            [],
        );
    });
});

describe("withEmoteRoom", () => {
    it("enables a pack without touching others", () => {
        const before = { rooms: { "!a:x": { "": {} } }, extra: 1 };
        const after = withEmoteRoom(before as never, "!b:x", "s", true);
        expect(after).toEqual({
            rooms: { "!a:x": { "": {} }, "!b:x": { s: {} } },
            extra: 1,
        });
        expect(before.rooms).toEqual({ "!a:x": { "": {} } });
    });
    it("keeps an existing entry's payload when re-enabling", () => {
        const after = withEmoteRoom(
            { rooms: { "!a:x": { "": { k: 1 } } } },
            "!a:x",
            "",
            true,
        );
        expect(after.rooms?.["!a:x"]?.[""]).toEqual({ k: 1 });
    });
    it("disables a pack and drops an emptied room", () => {
        const c = { rooms: { "!a:x": { "": {}, s: {} }, "!b:x": { "": {} } } };
        const one = withEmoteRoom(c, "!a:x", "s", false);
        expect(hasEmoteRoom(one, "!a:x", "s")).toBe(false);
        expect(hasEmoteRoom(one, "!a:x", "")).toBe(true);
        const two = withEmoteRoom(one, "!a:x", "", false);
        expect(two.rooms).toEqual({ "!b:x": { "": {} } });
    });
    it("builds from nothing", () => {
        expect(withEmoteRoom(undefined, "!a:x", "", true)).toEqual({
            rooms: { "!a:x": { "": {} } },
        });
    });
});

describe("applyPackMeta", () => {
    it("sets fields and preserves unknown ones", () => {
        const out = applyPackMeta(
            { images: { a: { url: "mxc://x/a" } }, pack: { custom: 1 } },
            {
                displayName: "  Cats ",
                attribution: "by me",
                avatarMxc: "mxc://x/av",
                usage: ["sticker", "sticker"],
            },
        );
        expect(out.pack).toEqual({
            custom: 1,
            display_name: "Cats",
            attribution: "by me",
            avatar_url: "mxc://x/av",
            usage: ["sticker"],
        });
        expect(out.images).toEqual({ a: { url: "mxc://x/a" } });
    });
    it("removes fields on null or blank and leaves untouched ones alone", () => {
        const out = applyPackMeta(
            {
                pack: {
                    display_name: "Old",
                    attribution: "x",
                    avatar_url: "mxc://x/av",
                    usage: ["emoticon"],
                },
            },
            { attribution: "  ", avatarMxc: null, usage: null },
        );
        expect(out.pack).toEqual({ display_name: "Old" });
    });
});

describe("uniqueShortcode", () => {
    it("returns the wanted name when free", () => {
        expect(uniqueShortcode(new Set(["a"]), "b")).toBe("b");
    });
    it("suffixes on collision", () => {
        expect(uniqueShortcode(new Set(["a", "a_2"]), "a")).toBe("a_3");
    });
});
