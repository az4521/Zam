import { describe, it, expect } from "vitest";
import {
    applyPackMeta,
    hasEmoteRoom,
    hasPackContent,
    mergePackContent,
    packWriteTypes,
    parseEmoteRooms,
    resolveImageUsage,
    uniqueShortcode,
    usageWithout,
    withEmoteRoom,
    withKnownUsage,
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
    it("keeps usages it doesn't know", () => {
        const pack = { pack: { usage: ["soundboard", "emoticon"] } };
        expect(applyPackMeta(pack, { usage: ["sticker"] }).pack?.usage).toEqual(
            ["soundboard", "sticker"],
        );
        // "Both" has to be spelled out, or the unknown usage would be lost.
        expect(applyPackMeta(pack, { usage: null }).pack?.usage).toEqual([
            "soundboard",
            "emoticon",
            "sticker",
        ]);
    });
});

describe("resolveImageUsage", () => {
    it("takes the image's usage, else the pack's, else both", () => {
        expect(resolveImageUsage(["sticker"], ["emoticon"])).toEqual([
            "sticker",
        ]);
        expect(resolveImageUsage([], ["emoticon"])).toEqual(["emoticon"]);
        expect(resolveImageUsage(undefined, undefined)).toEqual([
            "emoticon",
            "sticker",
        ]);
        expect(resolveImageUsage([], [])).toEqual(["emoticon", "sticker"]);
    });
    it("means neither for a list of only unknown usages", () => {
        // An MSC4577 sound pack: never offered as emotes or stickers.
        expect(resolveImageUsage(undefined, ["soundboard"])).toEqual([]);
        expect(resolveImageUsage(["soundboard"], ["emoticon"])).toEqual([]);
        expect(
            resolveImageUsage(["soundboard", "emoticon"], undefined),
        ).toEqual(["emoticon"]);
    });
    it("tolerates junk", () => {
        expect(resolveImageUsage("emoticon", 5)).toEqual([
            "emoticon",
            "sticker",
        ]);
        expect(resolveImageUsage([1, null], undefined)).toEqual([]);
    });
});

describe("withKnownUsage", () => {
    it("replaces the known kinds and keeps the rest", () => {
        expect(withKnownUsage(["soundboard", "sticker"], ["emoticon"])).toEqual(
            ["soundboard", "emoticon"],
        );
        expect(withKnownUsage(undefined, ["sticker", "sticker"])).toEqual([
            "sticker",
        ]);
        expect(withKnownUsage([3, "x"], [])).toEqual(["x"]);
    });
});

describe("usageWithout", () => {
    it("leaves what the image is still used for", () => {
        expect(usageWithout(undefined, undefined, "emoticon")).toEqual([
            "sticker",
        ]);
        expect(usageWithout(["emoticon", "sticker"], [], "sticker")).toEqual([
            "emoticon",
        ]);
        expect(usageWithout(undefined, ["sticker"], "emoticon")).toEqual([
            "sticker",
        ]);
    });
    it("is null once nothing is left", () => {
        expect(usageWithout(["emoticon"], undefined, "emoticon")).toBeNull();
        expect(usageWithout(undefined, ["emoticon"], "emoticon")).toBeNull();
    });
    it("keeps an image another client still uses", () => {
        expect(
            usageWithout(["soundboard", "emoticon"], undefined, "emoticon"),
        ).toEqual(["soundboard"]);
        expect(
            usageWithout(undefined, ["soundboard", "emoticon"], "emoticon"),
        ).toEqual(["soundboard"]);
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

describe("mergePackContent", () => {
    type Pack = Parameters<typeof applyPackMeta>[0];
    const legacy: Pack = {
        pack: { display_name: "Old", attribution: "me" },
        images: { a: { url: "mxc://x/a" }, b: { url: "mxc://x/b" } },
    };
    it("uses whichever event has content", () => {
        expect(mergePackContent(undefined, legacy)).toBe(legacy);
        expect(mergePackContent(legacy, undefined)).toBe(legacy);
        expect(mergePackContent(undefined, undefined)).toEqual({});
    });
    it("lets the stable event win per key", () => {
        const stable: Pack = {
            pack: { display_name: "New" },
            images: { b: { url: "mxc://x/b2" }, c: { url: "mxc://x/c" } },
        };
        expect(mergePackContent(stable, legacy)).toEqual({
            pack: { display_name: "New", attribution: "me" },
            images: {
                a: { url: "mxc://x/a" },
                b: { url: "mxc://x/b2" },
                c: { url: "mxc://x/c" },
            },
        });
    });
    it("treats an empty stable event as a deleted pack, as Sable does", () => {
        expect(mergePackContent<Pack>({}, legacy)).toEqual({});
        expect(mergePackContent<Pack>(legacy, {})).toBe(legacy);
        expect(hasPackContent({})).toBe(false);
        expect(hasPackContent({ images: {} })).toBe(true);
    });
});

describe("packWriteTypes", () => {
    const pack = { images: { a: { url: "mxc://x/a" } } };
    const STABLE = "m.room.image_pack";
    const LEGACY = "im.ponies.room_emotes";
    it("creates a new pack under the stable name only", () => {
        expect(packWriteTypes(undefined, undefined)).toEqual([STABLE]);
        // A legacy pack that was deleted counts as new.
        expect(packWriteTypes(undefined, {})).toEqual([STABLE]);
    });
    it("falls back to im.ponies when only that level is ours", () => {
        const onlyLegacy = (type: string) => type === LEGACY;
        expect(packWriteTypes(undefined, undefined, onlyLegacy)).toEqual([
            LEGACY,
        ]);
    });
    it("leaves a legacy-only pack legacy-only", () => {
        expect(packWriteTypes(undefined, pack)).toEqual([LEGACY]);
    });
    it("never copies a stable-only pack into the legacy event", () => {
        expect(packWriteTypes(pack, undefined)).toEqual([STABLE]);
        expect(packWriteTypes(pack, {})).toEqual([STABLE]);
    });
    it("keeps a legacy event with content in step with the stable one", () => {
        expect(packWriteTypes(pack, pack)).toEqual([STABLE, LEGACY]);
        // Deleted in the stable event but still listed in the legacy one.
        expect(packWriteTypes({}, pack)).toEqual([STABLE, LEGACY]);
    });
});
