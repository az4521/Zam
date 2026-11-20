import { describe, it, expect } from "vitest";
import {
    buildWatchingMap,
    encodeWatchingAttribute,
    parseWatchingAttribute,
    shareViewers,
    watcherSlots,
} from "./shareWatchers";

describe("watcherSlots", () => {
    it("shows everyone when they fit", () => {
        expect(watcherSlots(["a", "b"], 3)).toEqual({
            shown: ["a", "b"],
            extra: 0,
        });
    });
    it("caps the avatars and counts the rest", () => {
        expect(watcherSlots(["a", "b", "c", "d", "e"], 3)).toEqual({
            shown: ["a", "b", "c"],
            extra: 2,
        });
    });
    it("handles no viewers and a zero cap", () => {
        expect(watcherSlots([], 3)).toEqual({ shown: [], extra: 0 });
        expect(watcherSlots(["a"], 0)).toEqual({ shown: [], extra: 1 });
    });
});

describe("encodeWatchingAttribute", () => {
    it("sorts and dedupes identities", () => {
        expect(encodeWatchingAttribute(["@b:x:D2", "@a:x:D1", "@b:x:D2"])).toBe(
            '["@a:x:D1","@b:x:D2"]',
        );
    });

    it("encodes an empty list as an empty array", () => {
        expect(encodeWatchingAttribute([])).toBe("[]");
    });
});

describe("parseWatchingAttribute", () => {
    it("reads a list back, sorted and deduped", () => {
        expect(parseWatchingAttribute('["@b:x:D","@a:x:D","@a:x:D"]')).toEqual([
            "@a:x:D",
            "@b:x:D",
        ]);
    });

    it("returns empty for unset, malformed or non-list values", () => {
        expect(parseWatchingAttribute(undefined)).toEqual([]);
        expect(parseWatchingAttribute("")).toEqual([]);
        expect(parseWatchingAttribute("not json")).toEqual([]);
        expect(parseWatchingAttribute('{"a":1}')).toEqual([]);
    });

    it("drops non-string entries", () => {
        expect(parseWatchingAttribute('["@a:x:D", 3, null]')).toEqual([
            "@a:x:D",
        ]);
    });

    it("round-trips what it encodes", () => {
        const ids = ["@c:x:D1", "@a:x:D2"];
        expect(parseWatchingAttribute(encodeWatchingAttribute(ids))).toEqual([
            "@a:x:D2",
            "@c:x:D1",
        ]);
    });
});

describe("shareViewers", () => {
    const share = "@sharer:x:S1";

    it("lists the distinct users watching the share", () => {
        const watching = {
            "@bob:x:B1": [share],
            "@bob:x:B2": [share],
            "@amy:x:A1": [share, "@other:x:O1"],
            "@cat:x:C1": ["@other:x:O1"],
        };
        expect(shareViewers(watching, share)).toEqual(["@amy:x", "@bob:x"]);
    });

    it("does not count the sharer as a viewer of their own share", () => {
        const watching = {
            "@sharer:x:S1": [share],
            "@sharer:x:S2": [share],
            "@bob:x:B1": [share],
        };
        expect(shareViewers(watching, share)).toEqual(["@bob:x"]);
    });

    it("is empty when nobody watches it", () => {
        expect(shareViewers({ "@bob:x:B1": [] }, share)).toEqual([]);
        expect(shareViewers({}, share)).toEqual([]);
    });
});

describe("buildWatchingMap", () => {
    const share = "@sharer:x:S1";
    const watch = (identity: string, shares: string[]) => ({
        identity,
        attribute: JSON.stringify(shares),
    });

    it("maps every remote participant's announced shares by identity", () => {
        const map = buildWatchingMap([[watch("@bob:x:B1", [share])]], null);
        expect(map).toEqual({ "@bob:x:B1": [share] });
    });

    it("drops a watcher who left every room", () => {
        const before = buildWatchingMap([[watch("@bob:x:B1", [share])]], {
            identity: "@me:x:M1",
            shares: [],
        });
        expect(before["@bob:x:B1"]).toEqual([share]);
        const after = buildWatchingMap([[]], {
            identity: "@me:x:M1",
            shares: [],
        });
        expect(after["@bob:x:B1"]).toBeUndefined();
        expect(shareViewers(after, share)).toEqual([]);
    });

    it("brings a watcher back when it rejoins and announces again", () => {
        const left = buildWatchingMap([[]], null);
        expect(shareViewers(left, share)).toEqual([]);
        // Rejoin: a new session of the same device, announcing the share.
        const back = buildWatchingMap([[watch("@bob:x:B1", [share])]], null);
        expect(shareViewers(back, share)).toEqual(["@bob:x"]);
    });

    it("keeps a watcher whose sharer left and rejoined on the same identity", () => {
        // Watcher still announces the sharer while the sharer is away.
        const sharerGone = buildWatchingMap(
            [[watch("@bob:x:B1", [share])]],
            null,
        );
        expect(sharerGone["@bob:x:B1"]).toEqual([share]);
        // Sharer rejoins with the same identity: the viewer still counts.
        const sharerBack = buildWatchingMap(
            [[watch("@bob:x:B1", [share])], [{ identity: share }]],
            null,
        );
        expect(shareViewers(sharerBack, share)).toEqual(["@bob:x"]);
    });

    it("does not show a watcher of a sharer on a new identity (sharer rejoined on another device)", () => {
        const map = buildWatchingMap([[watch("@bob:x:B1", [share])]], null);
        expect(shareViewers(map, "@sharer:x:S2")).toEqual([]);
    });

    it("unions a watcher seen in several SFU rooms", () => {
        const map = buildWatchingMap(
            [
                [watch("@bob:x:B1", ["@s1:x:S1"])],
                [watch("@bob:x:B1", [share]), watch("@amy:x:A1", [share])],
            ],
            null,
        );
        expect(map["@bob:x:B1"]).toEqual(["@s1:x:S1", share]);
        expect(shareViewers(map, share)).toEqual(["@amy:x", "@bob:x"]);
    });

    it("takes our own shares from our state, not a room echo", () => {
        const map = buildWatchingMap([[watch("@me:x:M1", [share])]], {
            identity: "@me:x:M1",
            shares: [],
        });
        expect(map["@me:x:M1"]).toEqual([]);
    });

    it("drops unparseable attributes without losing the participant", () => {
        const map = buildWatchingMap(
            [[{ identity: "@bob:x:B1", attribute: "garbage" }]],
            null,
        );
        expect(map).toEqual({ "@bob:x:B1": [] });
    });
});
