/**
 * Property test: `classifyRooms` must agree with the six client.ts helpers it
 * replaced, bucket for bucket, element for element, order for order.
 *
 * The reference implementations below are master@5016125's `getRooms`,
 * `getSpaces`, `getRoomsInSpace`, `getOrphanRooms`, `getDirectRooms`,
 * `getInvitedRooms` and `getKnockedRooms`, transcribed over the same fake-room
 * shape the unit tests use — SDK reads replaced by lookups into a generated
 * world, everything else identical. Worlds come from a seeded PRNG so a failure
 * is reproducible and the suite can never be flaky.
 *
 * The input handed to `classifyRooms` is built exactly the way
 * `client.ts:getRoomClassification` builds it, so a divergence here is a real
 * divergence in the shipped path — including the join gate on `spaceChildIds`
 * (orphans) versus no gate on `activeSpaceChildIds` (the active space's rooms).
 */
import { describe, it, expect } from "vitest";
import { classifyRooms, type RoomDescriptor } from "./roomClassification";

interface FakeRoom {
    id: string;
}

interface World {
    /** The raw, UNFILTERED SDK room list, in SDK order. */
    rooms: RoomDescriptor<FakeRoom>[];
    directIds: Set<string>;
    /** Every space room's own m.space.child order, regardless of membership. */
    childIds: Map<string, string[]>;
    activeSpaceId: string | null;
}

// ── master@5016125 reference implementations ──────────────────────────────

/** getRooms(): join-only, minus pending local leaves. */
const refGetRooms = (w: World) =>
    w.rooms.filter((r) => r.membership === "join" && !r.pendingLeave);

/** getSpaces(): getRooms().filter(isSpaceRoom). */
const refGetSpaces = (w: World) => refGetRooms(w).filter((r) => r.isSpace);

/** getSpaceChildIds(): reads room state; [] for a room the client doesn't have. */
const refGetSpaceChildIds = (w: World, spaceId: string): string[] =>
    w.childIds.get(spaceId) ?? [];

/** getRoomsInSpace(): gates the CHILDREN; never the space itself. */
const refGetRoomsInSpace = (w: World, spaceId: string): FakeRoom[] =>
    refGetSpaceChildIds(w, spaceId)
        .map((id) => w.rooms.find((r) => r.roomId === id))
        .filter(
            (r): r is RoomDescriptor<FakeRoom> =>
                !!r && !r.isSpace && r.membership === "join" && !r.pendingLeave,
        )
        .map((r) => r.room);

/** getOrphanRooms(): child set from getSpaces() — joined spaces only. */
const refGetOrphanRooms = (w: World): FakeRoom[] => {
    const allSpaceChildIds = new Set<string>();
    for (const space of refGetSpaces(w))
        for (const id of refGetSpaceChildIds(w, space.roomId))
            allSpaceChildIds.add(id);
    return refGetRooms(w)
        .filter(
            (r) =>
                !r.isSpace &&
                !allSpaceChildIds.has(r.roomId) &&
                !w.directIds.has(r.roomId),
        )
        .map((r) => r.room);
};

/** getDirectRooms(): m.direct membership alone, no parentage test. */
const refGetDirectRooms = (w: World): FakeRoom[] =>
    refGetRooms(w)
        .filter((r) => w.directIds.has(r.roomId) && !r.isSpace)
        .map((r) => r.room);

/** getInvitedRooms()/getKnockedRooms(): the RAW list, no pendingLeaves filter. */
const refGetInvitedRooms = (w: World): FakeRoom[] =>
    w.rooms.filter((r) => r.membership === "invite").map((r) => r.room);
const refGetKnockedRooms = (w: World): FakeRoom[] =>
    w.rooms.filter((r) => r.membership === "knock").map((r) => r.room);

// ── seeded world generation ───────────────────────────────────────────────

/** Tiny deterministic LCG (Numerical Recipes constants). No dependency, no flake. */
function makeRng(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

const MEMBERSHIPS = [
    "join",
    "join",
    "join",
    "join",
    "invite",
    "knock",
    "leave",
    "ban",
];

function makeWorld(rng: () => number): World {
    const roomCount = 1 + Math.floor(rng() * 12);
    const rooms: RoomDescriptor<FakeRoom>[] = [];
    for (let i = 0; i < roomCount; i++) {
        const roomId = `!r${i}:s`;
        rooms.push({
            room: { id: roomId },
            roomId,
            isSpace: rng() < 0.3,
            membership: MEMBERSHIPS[Math.floor(rng() * MEMBERSHIPS.length)],
            pendingLeave: rng() < 0.15,
        });
    }

    // m.direct can name anything the server once called a DM: ordinary rooms,
    // a room that is also a space child, a space, or a room we no longer have.
    const directIds = new Set<string>();
    for (const r of rooms) if (rng() < 0.25) directIds.add(r.roomId);
    if (rng() < 0.2) directIds.add("!unknown-dm:s");

    // Every space lists children: real rooms, sub-spaces, ids we don't have,
    // and occasionally the same child twice.
    const childIds = new Map<string, string[]>();
    for (const space of rooms) {
        if (!space.isSpace) continue;
        const children: string[] = [];
        for (const candidate of rooms) {
            if (candidate.roomId === space.roomId) continue;
            if (rng() < 0.4) children.push(candidate.roomId);
        }
        if (rng() < 0.25) children.push("!unknown-child:s");
        if (children.length && rng() < 0.15) children.push(children[0]);
        // Shuffle so child order never coincides with SDK order by accident.
        for (let i = children.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [children[i], children[j]] = [children[j], children[i]];
        }
        childIds.set(space.roomId, children);
    }

    // The active space is UNRESTRICTED: Home, a joined space, a space we are
    // leaving or were removed from, a non-space room, or an id we don't have.
    const roll = rng();
    let activeSpaceId: string | null = null;
    if (roll < 0.15) activeSpaceId = null;
    else if (roll < 0.9) {
        const spaces = rooms.filter((r) => r.isSpace);
        activeSpaceId = spaces.length
            ? spaces[Math.floor(rng() * spaces.length)].roomId
            : null;
    } else if (roll < 0.96)
        activeSpaceId = rooms[Math.floor(rng() * rooms.length)].roomId;
    else activeSpaceId = "!unknown-space:s";

    return { rooms, directIds, childIds, activeSpaceId };
}

/** Exactly what client.ts:getRoomClassification hands the util. */
function classifyWorld(w: World) {
    const spaceChildIds = new Map<string, readonly string[]>();
    for (const d of w.rooms) {
        if (!d.isSpace || d.membership !== "join" || d.pendingLeave) continue;
        spaceChildIds.set(d.roomId, refGetSpaceChildIds(w, d.roomId));
    }
    return classifyRooms({
        rooms: w.rooms,
        directIds: w.directIds,
        spaceChildIds,
        activeSpaceChildIds: w.activeSpaceId
            ? refGetSpaceChildIds(w, w.activeSpaceId)
            : [],
    });
}

/** Element-wise AND order-wise, on object identity — not deep equality. */
function divergence(
    bucket: string,
    actual: FakeRoom[],
    expected: FakeRoom[],
): string | null {
    if (actual.length !== expected.length)
        return `${bucket}: got [${actual.map((r) => r.id)}] want [${expected.map((r) => r.id)}]`;
    for (let i = 0; i < actual.length; i++) {
        if (actual[i] !== expected[i])
            return `${bucket}[${i}]: got ${actual[i]?.id} want ${expected[i]?.id}`;
    }
    return null;
}

describe("classifyRooms vs master@5016125", () => {
    it("matches all six buckets across 500 randomized worlds", () => {
        const rng = makeRng(0x5eed1234);
        const divergences: string[] = [];

        for (let n = 0; n < 500; n++) {
            const w = makeWorld(rng);
            const got = classifyWorld(w);
            const want = {
                spaces: refGetSpaces(w).map((r) => r.room),
                orphanRooms: refGetOrphanRooms(w),
                directRooms: refGetDirectRooms(w),
                invitedRooms: refGetInvitedRooms(w),
                knockedRooms: refGetKnockedRooms(w),
                roomsInSpace: w.activeSpaceId
                    ? refGetRoomsInSpace(w, w.activeSpaceId)
                    : [],
            };
            for (const bucket of Object.keys(want) as (keyof typeof want)[]) {
                const d = divergence(bucket, got[bucket], want[bucket]);
                if (d) divergences.push(`world ${n} ${d}`);
            }
        }

        expect(
            divergences.length,
            `divergences: ${divergences.slice(0, 5).join(" | ")}`,
        ).toBe(0);
    });

    it("generates worlds that actually exercise every bucket", () => {
        // A property test over empty worlds proves nothing. This pins that the
        // generator reaches each bucket, including the cases the review cared
        // about: a non-joined active space, and a DM that is a space child.
        const rng = makeRng(0x5eed1234);
        const seen = {
            spaces: 0,
            orphanRooms: 0,
            directRooms: 0,
            invitedRooms: 0,
            knockedRooms: 0,
            roomsInSpace: 0,
            unjoinedActiveSpace: 0,
            dmInsideSpace: 0,
        };
        for (let n = 0; n < 500; n++) {
            const w = makeWorld(rng);
            const got = classifyWorld(w);
            for (const bucket of [
                "spaces",
                "orphanRooms",
                "directRooms",
                "invitedRooms",
                "knockedRooms",
                "roomsInSpace",
            ] as const) {
                if (got[bucket].length) seen[bucket]++;
            }
            const active = w.activeSpaceId
                ? w.rooms.find((r) => r.roomId === w.activeSpaceId)
                : undefined;
            if (
                active &&
                (active.membership !== "join" || active.pendingLeave) &&
                refGetRoomsInSpace(w, w.activeSpaceId!).length
            )
                seen.unjoinedActiveSpace++;
            for (const [, children] of w.childIds)
                if (children.some((id) => w.directIds.has(id)))
                    seen.dmInsideSpace++;
        }
        for (const [name, count] of Object.entries(seen))
            expect(count, `${name} never occurred`).toBeGreaterThan(0);
    });
});
