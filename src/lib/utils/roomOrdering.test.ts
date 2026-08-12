import { describe, it, expect } from "vitest";
import {
    TAG_FAVOURITE,
    TAG_LOWPRIORITY,
    roomTagKind,
    groupRoomsByTag,
    sortRoomsByTag,
    tagUpdatesForToggle,
    tagOrderRollback,
    type RoomTagMap,
} from "./roomOrdering";

interface FakeRoom {
    id: string;
    tags: RoomTagMap;
}

const room = (id: string, tags: RoomTagMap = {}): FakeRoom => ({ id, tags });
const getTags = (r: FakeRoom) => r.tags;
const ids = (rooms: FakeRoom[]) => rooms.map((r) => r.id);

describe("roomTagKind — classify a room by its tags", () => {
    it("returns normal for untagged rooms and unknown tags", () => {
        expect(roomTagKind({})).toBe("normal");
        expect(roomTagKind({ "u.work": {} })).toBe("normal");
    });

    it("recognizes m.favourite and m.lowpriority", () => {
        expect(roomTagKind({ [TAG_FAVOURITE]: {} })).toBe("favourite");
        expect(roomTagKind({ [TAG_LOWPRIORITY]: {} })).toBe("lowPriority");
    });

    it("lets favourite win when a room somehow has both tags", () => {
        expect(
            roomTagKind({ [TAG_FAVOURITE]: {}, [TAG_LOWPRIORITY]: {} }),
        ).toBe("favourite");
    });
});

describe("groupRoomsByTag — split rooms into favourites / normal / low priority", () => {
    it("puts everything in normal when nothing is tagged, preserving order", () => {
        const rooms = [room("a"), room("b"), room("c")];
        const groups = groupRoomsByTag(rooms, getTags);
        expect(ids(groups.favourites)).toEqual([]);
        expect(ids(groups.normal)).toEqual(["a", "b", "c"]);
        expect(ids(groups.lowPriority)).toEqual([]);
    });

    it("handles an empty list", () => {
        const groups = groupRoomsByTag([], getTags);
        expect(groups).toEqual({ favourites: [], normal: [], lowPriority: [] });
    });

    // Table: [description, rooms, expected favourites, normal, lowPriority]
    const cases: [string, FakeRoom[], string[], string[], string[]][] = [
        [
            "a mixed list",
            [
                room("a"),
                room("fav", { [TAG_FAVOURITE]: {} }),
                room("b"),
                room("low", { [TAG_LOWPRIORITY]: {} }),
            ],
            ["fav"],
            ["a", "b"],
            ["low"],
        ],
        [
            "only favourites",
            [
                room("f1", { [TAG_FAVOURITE]: {} }),
                room("f2", { [TAG_FAVOURITE]: {} }),
            ],
            ["f1", "f2"],
            [],
            [],
        ],
        [
            "a room with both tags counts as favourite",
            [room("both", { [TAG_FAVOURITE]: {}, [TAG_LOWPRIORITY]: {} })],
            ["both"],
            [],
            [],
        ],
        [
            "unknown tags stay in normal",
            [room("w", { "u.work": {} }), room("f", { [TAG_FAVOURITE]: {} })],
            ["f"],
            ["w"],
            [],
        ],
    ];

    for (const [name, rooms, fav, normal, low] of cases) {
        it(`groups ${name}`, () => {
            const groups = groupRoomsByTag(rooms, getTags);
            expect(ids(groups.favourites)).toEqual(fav);
            expect(ids(groups.normal)).toEqual(normal);
            expect(ids(groups.lowPriority)).toEqual(low);
        });
    }

    it("sorts favourites by their tag order, lowest first", () => {
        const rooms = [
            room("half", { [TAG_FAVOURITE]: { order: 0.5 } }),
            room("first", { [TAG_FAVOURITE]: { order: 0.1 } }),
            room("last", { [TAG_FAVOURITE]: { order: 0.9 } }),
        ];
        const groups = groupRoomsByTag(rooms, getTags);
        expect(ids(groups.favourites)).toEqual(["first", "half", "last"]);
    });

    it("puts favourites without an order after ordered ones, keeping input order", () => {
        const rooms = [
            room("no-order-1", { [TAG_FAVOURITE]: {} }),
            room("ordered", { [TAG_FAVOURITE]: { order: 0.5 } }),
            room("no-order-2", { [TAG_FAVOURITE]: {} }),
        ];
        const groups = groupRoomsByTag(rooms, getTags);
        expect(ids(groups.favourites)).toEqual([
            "ordered",
            "no-order-1",
            "no-order-2",
        ]);
    });

    it("coerces numeric string orders (legacy clients) and sorts a non-numeric order after numeric ones", () => {
        const rooms = [
            room("junk", { [TAG_FAVOURITE]: { order: "not a number" } }),
            room("legacy", { [TAG_FAVOURITE]: { order: "0.2" } }),
            room("num", { [TAG_FAVOURITE]: { order: 0.7 } }),
        ];
        const groups = groupRoomsByTag(rooms, getTags);
        expect(ids(groups.favourites)).toEqual(["legacy", "num", "junk"]);
    });

    it("sorts low priority rooms by their own tag order", () => {
        const rooms = [
            room("l2", { [TAG_LOWPRIORITY]: { order: 0.8 } }),
            room("l1", { [TAG_LOWPRIORITY]: { order: 0.2 } }),
        ];
        const groups = groupRoomsByTag(rooms, getTags);
        expect(ids(groups.lowPriority)).toEqual(["l1", "l2"]);
    });

    // compareOrder-based sort: non-numeric strings now sort lexicographically
    // by code point instead of collapsing to "last" (the old numeric-only
    // comparator treated every non-parseable order as Infinity).
    it("sorts two non-numeric string orders lexicographically by code point", () => {
        const rooms = [
            room("z", { [TAG_FAVOURITE]: { order: "zzz" } }),
            room("a", { [TAG_FAVOURITE]: { order: "aaa" } }),
        ];
        const groups = groupRoomsByTag(rooms, getTags);
        expect(ids(groups.favourites)).toEqual(["a", "z"]);
    });

    it("still sorts a missing order LAST, even after a non-numeric present one", () => {
        const rooms = [
            room("missing", { [TAG_FAVOURITE]: {} }),
            room("present", { [TAG_FAVOURITE]: { order: "mmm" } }),
        ];
        const groups = groupRoomsByTag(rooms, getTags);
        expect(ids(groups.favourites)).toEqual(["present", "missing"]);
    });

    it("sorts numeric string orders numerically, not lexicographically (10 after 2)", () => {
        const rooms = [
            room("ten", { [TAG_FAVOURITE]: { order: "10" } }),
            room("two", { [TAG_FAVOURITE]: { order: "2" } }),
        ];
        const groups = groupRoomsByTag(rooms, getTags);
        expect(ids(groups.favourites)).toEqual(["two", "ten"]);
    });
});

describe("sortRoomsByTag — flat ordering for single-section lists (DMs)", () => {
    it("returns favourites, then normal, then low priority", () => {
        const rooms = [
            room("low", { [TAG_LOWPRIORITY]: {} }),
            room("a"),
            room("fav", { [TAG_FAVOURITE]: {} }),
            room("b"),
        ];
        expect(ids(sortRoomsByTag(rooms, getTags))).toEqual([
            "fav",
            "a",
            "b",
            "low",
        ]);
    });
});

describe("tagUpdatesForToggle — which tags to set/delete on toggle", () => {
    it("favourites an untagged room", () => {
        expect(tagUpdatesForToggle({}, "favourite")).toEqual({
            add: TAG_FAVOURITE,
            remove: [],
        });
    });

    it("unfavourites a favourite room", () => {
        expect(
            tagUpdatesForToggle({ [TAG_FAVOURITE]: {} }, "favourite"),
        ).toEqual({ add: null, remove: [TAG_FAVOURITE] });
    });

    it("favouriting a low-priority room clears low priority (mutually exclusive)", () => {
        expect(
            tagUpdatesForToggle({ [TAG_LOWPRIORITY]: {} }, "favourite"),
        ).toEqual({ add: TAG_FAVOURITE, remove: [TAG_LOWPRIORITY] });
    });

    it("marks an untagged room low priority", () => {
        expect(tagUpdatesForToggle({}, "lowPriority")).toEqual({
            add: TAG_LOWPRIORITY,
            remove: [],
        });
    });

    it("clears low priority from a low-priority room", () => {
        expect(
            tagUpdatesForToggle({ [TAG_LOWPRIORITY]: {} }, "lowPriority"),
        ).toEqual({ add: null, remove: [TAG_LOWPRIORITY] });
    });

    it("marking a favourite room low priority clears favourite (mutually exclusive)", () => {
        expect(
            tagUpdatesForToggle({ [TAG_FAVOURITE]: {} }, "lowPriority"),
        ).toEqual({ add: TAG_LOWPRIORITY, remove: [TAG_FAVOURITE] });
    });

    it("toggling off a tag on a both-tagged room removes only that tag", () => {
        const both = { [TAG_FAVOURITE]: {}, [TAG_LOWPRIORITY]: {} };
        expect(tagUpdatesForToggle(both, "favourite")).toEqual({
            add: null,
            remove: [TAG_FAVOURITE],
        });
    });

    it("ignores unknown tags when toggling", () => {
        expect(tagUpdatesForToggle({ "u.work": {} }, "favourite")).toEqual({
            add: TAG_FAVOURITE,
            remove: [],
        });
    });
});

describe("tagOrderRollback", () => {
    it("returns nothing when no writes were applied", () => {
        expect(tagOrderRollback(["a", "b"], [0.1, 0.2], 0)).toEqual([]);
    });

    it("restores only the applied rooms, in reverse order", () => {
        expect(
            tagOrderRollback(["a", "b", "c", "d"], [0.1, 0.2, 0.3, 0.4], 2),
        ).toEqual([
            { roomId: "b", order: 0.2 },
            { roomId: "a", order: 0.1 },
        ]);
    });

    it("preserves undefined and string original orders", () => {
        expect(tagOrderRollback(["a", "b"], [undefined, "0.5"], 2)).toEqual([
            { roomId: "b", order: "0.5" },
            { roomId: "a", order: undefined },
        ]);
    });

    it("clamps appliedCount to the list length", () => {
        expect(tagOrderRollback(["a"], [0.1], 5)).toEqual([
            { roomId: "a", order: 0.1 },
        ]);
    });
});
