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

    it("still lists a DM that is also a child of a joined space as a DM", () => {
        // Master's getDirectRooms has NO parentage test — `m.direct` membership
        // alone makes it a DM. The single-pass loop short-circuits on directIds
        // before the space-child check, and this pins that they agree.
        const result = classifyRooms({
            rooms: [room("!dm:s"), room("!sp:s", { isSpace: true })],
            directIds: new Set(["!dm:s"]),
            spaceChildIds: new Map([["!sp:s", ["!dm:s"]]]),
            activeSpaceId: null,
        });
        expect(ids(result.directRooms)).toEqual(["!dm:s"]);
        expect(result.orphanRooms).toEqual([]);
    });

    it("lists a sub-space alongside its parent and keeps it out of orphans", () => {
        // Master's getSpaces() is getRooms().filter(isSpaceRoom) — no parentage
        // test — so a space nested under another space is still a space.
        const result = classifyRooms({
            rooms: [
                room("!parent:s", { isSpace: true }),
                room("!sub:s", { isSpace: true }),
            ],
            directIds: new Set(),
            spaceChildIds: new Map([["!parent:s", ["!sub:s"]]]),
            activeSpaceId: null,
        });
        expect(ids(result.spaces)).toEqual(["!parent:s", "!sub:s"]);
        expect(result.orphanRooms).toEqual([]);
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
        expect(result.spaces).toEqual([]);
        expect(result.directRooms).toEqual([]);
    });

    it("keeps an invited or knocked SPACE out of the spaces bucket", () => {
        // Master's getSpaces() filters getRooms(), which is join-only — an
        // unaccepted space invite is an invite, not a space in the sidebar.
        // Pins that the isSpace branch stays BELOW the membership guard.
        const result = classifyRooms({
            rooms: [
                room("!isp:s", { isSpace: true, membership: "invite" }),
                room("!ksp:s", { isSpace: true, membership: "knock" }),
            ],
            directIds: new Set(),
            spaceChildIds: new Map(),
            activeSpaceId: null,
        });
        expect(ids(result.invitedRooms)).toEqual(["!isp:s"]);
        expect(ids(result.knockedRooms)).toEqual(["!ksp:s"]);
        expect(result.spaces).toEqual([]);
    });

    it("returns every bucket in the input rooms order", () => {
        // Master's buckets are all filters over matrixClient.getRooms(), so the
        // input order IS the contract. Ids are deliberately reverse-alphabetical
        // so an accidental sort fails too, not just a reversed push.
        const result = classifyRooms({
            rooms: [
                room("!z-sp:s", { isSpace: true }),
                room("!z-dm:s"),
                room("!z-i:s", { membership: "invite" }),
                room("!z-k:s", { membership: "knock" }),
                room("!z-or:s"),
                room("!a-sp:s", { isSpace: true }),
                room("!a-dm:s"),
                room("!a-i:s", { membership: "invite" }),
                room("!a-k:s", { membership: "knock" }),
                room("!a-or:s"),
            ],
            directIds: new Set(["!z-dm:s", "!a-dm:s"]),
            spaceChildIds: new Map(),
            activeSpaceId: null,
        });
        expect(ids(result.spaces)).toEqual(["!z-sp:s", "!a-sp:s"]);
        expect(ids(result.directRooms)).toEqual(["!z-dm:s", "!a-dm:s"]);
        expect(ids(result.invitedRooms)).toEqual(["!z-i:s", "!a-i:s"]);
        expect(ids(result.knockedRooms)).toEqual(["!z-k:s", "!a-k:s"]);
        expect(ids(result.orphanRooms)).toEqual(["!z-or:s", "!a-or:s"]);
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
