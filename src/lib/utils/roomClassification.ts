/**
 * Pure room classification. `AppShell.refreshRooms()` used to call six separate
 * client.ts helpers, each of which re-scanned every room and re-derived every
 * space's child list — four full table scans plus a per-space sort, on every
 * sync. This computes all six buckets from one snapshot instead.
 *
 * Rooms are carried opaquely through `T` so this file imports nothing and stays
 * unit-testable; the caller hands in the SDK facts it already had to read.
 */

export interface RoomDescriptor<T> {
    room: T;
    roomId: string;
    isSpace: boolean;
    /** Raw `getMyMembership()` — "join" | "invite" | "knock" | "leave" | … */
    membership: string;
    /** A local leave is in flight; the SDK still lists the room. */
    pendingLeave: boolean;
}

export interface ClassificationInput<T> {
    rooms: RoomDescriptor<T>[];
    /** Room ids named by `m.direct` account data. */
    directIds: ReadonlySet<string>;
    /**
     * JOINED spaces only, space id → ordered child room ids. This feeds the
     * orphan test ONLY: master's `getOrphanRooms` derives its child set from
     * `getSpaces()`, which is join-filtered, so the children of a space we are
     * leaving (or were removed from) really are orphans.
     */
    spaceChildIds: ReadonlyMap<string, readonly string[]>;
    /**
     * Ordered child ids of the ACTIVE space, whatever our membership in that
     * space is — master's `getRoomsInSpace()` gates the children, never the
     * space itself, so a space you are leaving still lists its rooms until the
     * view moves away. Empty when nothing is active.
     */
    activeSpaceChildIds: readonly string[];
}

export interface RoomClassification<T> {
    spaces: T[];
    orphanRooms: T[];
    directRooms: T[];
    invitedRooms: T[];
    knockedRooms: T[];
    roomsInSpace: T[];
}

export function classifyRooms<T>(
    input: ClassificationInput<T>,
): RoomClassification<T> {
    const { rooms, directIds, spaceChildIds, activeSpaceChildIds } = input;

    const childOfSomeSpace = new Set<string>();
    for (const ids of spaceChildIds.values()) {
        for (const id of ids) childOfSomeSpace.add(id);
    }

    const spaces: T[] = [];
    const orphanRooms: T[] = [];
    const directRooms: T[] = [];
    const invitedRooms: T[] = [];
    const knockedRooms: T[] = [];
    const byId = new Map<string, RoomDescriptor<T>>();

    for (const d of rooms) {
        byId.set(d.roomId, d);
        if (d.membership === "invite") invitedRooms.push(d.room);
        if (d.membership === "knock") knockedRooms.push(d.room);
        if (d.membership !== "join" || d.pendingLeave) continue;
        if (d.isSpace) {
            spaces.push(d.room);
            continue;
        }
        if (directIds.has(d.roomId)) {
            directRooms.push(d.room);
            continue;
        }
        if (!childOfSomeSpace.has(d.roomId)) orphanRooms.push(d.room);
    }

    const roomsInSpace: T[] = [];
    for (const id of activeSpaceChildIds) {
        const d = byId.get(id);
        if (!d) continue;
        if (d.isSpace) continue;
        if (d.membership !== "join" || d.pendingLeave) continue;
        roomsInSpace.push(d.room);
    }

    return {
        spaces,
        orphanRooms,
        directRooms,
        invitedRooms,
        knockedRooms,
        roomsInSpace,
    };
}

/** Element-wise reference equality — the test for "nothing to publish". */
export function sameOrder<T>(a: readonly T[], b: readonly T[]): boolean {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}
