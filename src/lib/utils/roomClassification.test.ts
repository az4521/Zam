import { describe, it, expect } from "vitest";
import {
    classifyRooms,
    sameOrder,
    type RoomDescriptor,
} from "./roomClassification";

interface FakeRoom {
    id: string;
}

function room(
    roomId: string,
    opts: {
        isSpace?: boolean;
        membership?: string;
        pendingLeave?: boolean;
    } = {},
): RoomDescriptor<FakeRoom> {
    return {
        room: { id: roomId },
        roomId,
        isSpace: opts.isSpace ?? false,
        membership: opts.membership ?? "join",
        pendingLeave: opts.pendingLeave ?? false,
    };
}

const ids = (rooms: FakeRoom[]) => rooms.map((r) => r.id);

describe("classifyRooms", () => {
    it("puts joined non-space rooms with no parent space and no m.direct entry in orphans", () => {
        const result = classifyRooms({
            rooms: [room("!a:s"), room("!b:s")],
            directIds: new Set(),
            spaceChildIds: new Map(),
            activeSpaceId: null,
        });
        expect(ids(result.orphanRooms)).toEqual(["!a:s", "!b:s"]);
    });

    it("excludes rooms that are a child of any joined space from orphans", () => {
        const result = classifyRooms({
            rooms: [
                room("!a:s"),
                room("!b:s"),
                room("!sp:s", { isSpace: true }),
            ],
            directIds: new Set(),
            spaceChildIds: new Map([["!sp:s", ["!b:s"]]]),
            activeSpaceId: null,
        });
        expect(ids(result.orphanRooms)).toEqual(["!a:s"]);
    });

    it("excludes m.direct rooms from orphans and lists them as DMs", () => {
        const result = classifyRooms({
            rooms: [room("!a:s"), room("!dm:s")],
            directIds: new Set(["!dm:s"]),
            spaceChildIds: new Map(),
            activeSpaceId: null,
        });
        expect(ids(result.orphanRooms)).toEqual(["!a:s"]);
        expect(ids(result.directRooms)).toEqual(["!dm:s"]);
    });

    it("never lists a space as a DM", () => {
        const result = classifyRooms({
            rooms: [room("!sp:s", { isSpace: true })],
            directIds: new Set(["!sp:s"]),
            spaceChildIds: new Map(),
            activeSpaceId: null,
        });
        expect(result.directRooms).toEqual([]);
        expect(ids(result.spaces)).toEqual(["!sp:s"]);
    });

    it("drops rooms with a pending leave from the joined buckets", () => {
        const result = classifyRooms({
            rooms: [
                room("!a:s", { pendingLeave: true }),
                room("!sp:s", { isSpace: true, pendingLeave: true }),
                room("!dm:s", { pendingLeave: true }),
            ],
            directIds: new Set(["!dm:s"]),
            spaceChildIds: new Map(),
            activeSpaceId: null,
        });
        expect(result.orphanRooms).toEqual([]);
        expect(result.spaces).toEqual([]);
        expect(result.directRooms).toEqual([]);
    });

    it("keeps invited and knocked rooms even when a leave is pending", () => {
        const result = classifyRooms({
            rooms: [
                room("!i:s", { membership: "invite", pendingLeave: true }),
                room("!k:s", { membership: "knock", pendingLeave: true }),
            ],
            directIds: new Set(),
            spaceChildIds: new Map(),
            activeSpaceId: null,
        });
        expect(ids(result.invitedRooms)).toEqual(["!i:s"]);
        expect(ids(result.knockedRooms)).toEqual(["!k:s"]);
    });

    it("keeps invited and knocked rooms out of the joined buckets", () => {
        const result = classifyRooms({
            rooms: [
                room("!i:s", { membership: "invite" }),
                room("!k:s", { membership: "knock" }),
            ],
            directIds: new Set(),
            spaceChildIds: new Map(),
            activeSpaceId: null,
        });
        expect(result.orphanRooms).toEqual([]);
    });

    it("orders roomsInSpace by the space child list, not the rooms array", () => {
        const result = classifyRooms({
            rooms: [
                room("!b:s"),
                room("!a:s"),
                room("!sp:s", { isSpace: true }),
            ],
            directIds: new Set(),
            spaceChildIds: new Map([["!sp:s", ["!a:s", "!b:s"]]]),
            activeSpaceId: "!sp:s",
        });
        expect(ids(result.roomsInSpace)).toEqual(["!a:s", "!b:s"]);
    });

    it("skips space children that are unknown, unjoined, leaving, or themselves spaces", () => {
        const result = classifyRooms({
            rooms: [
                room("!ok:s"),
                room("!invited:s", { membership: "invite" }),
                room("!leaving:s", { pendingLeave: true }),
                room("!sub:s", { isSpace: true }),
                room("!sp:s", { isSpace: true }),
            ],
            directIds: new Set(),
            spaceChildIds: new Map([
                [
                    "!sp:s",
                    ["!gone:s", "!invited:s", "!leaving:s", "!sub:s", "!ok:s"],
                ],
            ]),
            activeSpaceId: "!sp:s",
        });
        expect(ids(result.roomsInSpace)).toEqual(["!ok:s"]);
    });

    it("returns an empty roomsInSpace when no space is active", () => {
        const result = classifyRooms({
            rooms: [room("!a:s")],
            directIds: new Set(),
            spaceChildIds: new Map([["!sp:s", ["!a:s"]]]),
            activeSpaceId: null,
        });
        expect(result.roomsInSpace).toEqual([]);
    });

    it("carries the opaque room object through, not the descriptor", () => {
        const r = room("!a:s");
        const result = classifyRooms({
            rooms: [r],
            directIds: new Set(),
            spaceChildIds: new Map(),
            activeSpaceId: null,
        });
        expect(result.orphanRooms[0]).toBe(r.room);
    });
});

describe("sameOrder", () => {
    it("is true for the same references in the same order", () => {
        const a = { n: 1 };
        const b = { n: 2 };
        expect(sameOrder([a, b], [a, b])).toBe(true);
    });

    it("is false when the order differs", () => {
        const a = { n: 1 };
        const b = { n: 2 };
        expect(sameOrder([a, b], [b, a])).toBe(false);
    });

    it("is false when the lengths differ", () => {
        const a = { n: 1 };
        expect(sameOrder([a], [a, a])).toBe(false);
    });

    it("is false for equal-but-distinct objects", () => {
        expect(sameOrder([{ n: 1 }], [{ n: 1 }])).toBe(false);
    });

    it("is true for two empty lists", () => {
        expect(sameOrder([], [])).toBe(true);
    });
});
