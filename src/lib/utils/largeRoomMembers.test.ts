import { describe, it, expect } from "vitest";
import {
    LARGE_ROOM_MEMBERS,
    activityRank,
    isLargeRoomCount,
    missingMemberIds,
    pickLargeRoomMembers,
} from "./largeRoomMembers";

describe("isLargeRoomCount", () => {
    it("uses the 500 threshold, inclusive", () => {
        expect(LARGE_ROOM_MEMBERS).toBe(500);
        expect(isLargeRoomCount(499)).toBe(false);
        expect(isLargeRoomCount(500)).toBe(true);
        expect(isLargeRoomCount(10_000)).toBe(true);
    });

    it("treats an empty room as small", () => {
        expect(isLargeRoomCount(0)).toBe(false);
    });
});

describe("activityRank", () => {
    it("ranks plain presence states in order", () => {
        expect(activityRank("online", false)).toBe(1);
        expect(activityRank("busy", false)).toBe(2);
        expect(activityRank("unavailable", false)).toBe(3);
        expect(activityRank("offline", false)).toBe(4);
    });

    it("maps null presence to 4", () => {
        expect(activityRank(null, false)).toBe(4);
    });

    it("gives rich presence rank 0 whatever the presence state", () => {
        expect(activityRank("online", true)).toBe(0);
        expect(activityRank("busy", true)).toBe(0);
        expect(activityRank("unavailable", true)).toBe(0);
        expect(activityRank("offline", true)).toBe(0);
        expect(activityRank(null, true)).toBe(0);
    });
});

describe("pickLargeRoomMembers", () => {
    type M = { userId: string };
    const members: M[] = [
        { userId: "@online:x" },
        { userId: "@offline:x" },
        { userId: "@admin:x" },
        { userId: "@sender:x" },
        { userId: "@me:x" },
        { userId: "@away:x" },
    ];
    const ranks: Record<string, number> = {
        "@online:x": 1,
        "@offline:x": 4,
        "@admin:x": 4,
        "@sender:x": 4,
        "@me:x": 4,
        "@away:x": 3,
    };

    it("keeps role holders, non-offline members, recent senders and self", () => {
        const out = pickLargeRoomMembers({
            members,
            isRoleHolder: (id) => id === "@admin:x",
            rank: (id) => ranks[id] ?? 4,
            recentSenders: new Set(["@sender:x"]),
            selfId: "@me:x",
        });
        expect(out.map((m) => m.userId)).toEqual([
            "@online:x",
            "@admin:x",
            "@sender:x",
            "@me:x",
            "@away:x",
        ]);
    });

    it("drops an offline member with no other reason to show", () => {
        const out = pickLargeRoomMembers({
            members: [{ userId: "@offline:x" }],
            isRoleHolder: () => false,
            rank: () => 4,
            recentSenders: new Set(),
            selfId: null,
        });
        expect(out).toEqual([]);
    });

    it("keeps a rank-0 (rich presence) member even when the rank is the only signal", () => {
        const out = pickLargeRoomMembers({
            members: [{ userId: "@game:x" }],
            isRoleHolder: () => false,
            rank: () => 0,
            recentSenders: new Set(),
            selfId: null,
        });
        expect(out.map((m) => m.userId)).toEqual(["@game:x"]);
    });

    it("does not treat a null selfId as matching anyone", () => {
        const out = pickLargeRoomMembers({
            members: [{ userId: "@a:x" }],
            isRoleHolder: () => false,
            rank: () => 4,
            recentSenders: new Set(),
            selfId: null,
        });
        expect(out).toEqual([]);
    });

    it("keeps input order and does not mutate the input", () => {
        const input = [
            { userId: "@c:x" },
            { userId: "@a:x" },
            { userId: "@b:x" },
        ];
        const out = pickLargeRoomMembers({
            members: input,
            isRoleHolder: () => true,
            rank: () => 4,
            recentSenders: new Set(),
            selfId: null,
        });
        expect(out.map((m) => m.userId)).toEqual(["@c:x", "@a:x", "@b:x"]);
        expect(input).toHaveLength(3);
    });
});

describe("missingMemberIds", () => {
    it("drops ids the has-check already knows", () => {
        const known = new Set(["@a:x"]);
        expect(
            missingMemberIds(["@a:x", "@b:x"], (id) => known.has(id), 10),
        ).toEqual(["@b:x"]);
    });

    it("dedupes while keeping first-seen order", () => {
        expect(
            missingMemberIds(
                ["@b:x", "@a:x", "@b:x", "@c:x", "@a:x"],
                () => false,
                10,
            ),
        ).toEqual(["@b:x", "@a:x", "@c:x"]);
    });

    it("caps the result at limit", () => {
        expect(
            missingMemberIds(["@a:x", "@b:x", "@c:x"], () => false, 2),
        ).toEqual(["@a:x", "@b:x"]);
    });

    it("does not let known ids use up the limit", () => {
        expect(
            missingMemberIds(
                ["@a:x", "@b:x", "@c:x"],
                (id) => id === "@a:x",
                2,
            ),
        ).toEqual(["@b:x", "@c:x"]);
    });

    it("returns nothing for a zero limit or empty input", () => {
        expect(missingMemberIds(["@a:x"], () => false, 0)).toEqual([]);
        expect(missingMemberIds([], () => false, 5)).toEqual([]);
    });

    it("accepts any iterable", () => {
        expect(
            missingMemberIds(new Set(["@a:x", "@b:x"]), () => false, 5),
        ).toEqual(["@a:x", "@b:x"]);
    });
});
