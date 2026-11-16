// Rooms bridged from Discord threads by ZDMB (Zam Discord-Matrix Bridge).
//
// ZDMB marks each thread room with a `moe.crafty.zdmb.thread_parent` state
// event `{ room_id, via, event_id? }`: `room_id` is the parent channel's room,
// `event_id` the message the thread was started from (when there is one). The
// same `{ room_id, event_id? }` sits under that key on the thread's
// `m.space.child` event in the parent space, so a thread is recognisable
// without joining it. Forum posts point at the forum's room, which is a space.

export const THREAD_PARENT_TYPE = "moe.crafty.zdmb.thread_parent";

export interface BridgedThreadParent {
    /** The parent channel's room (a space for forum posts). */
    roomId: string;
    /** The message in the parent room the thread was started from. */
    eventId?: string;
    via: string[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Validate a thread-parent payload (the state event's content, or the value
 *  under THREAD_PARENT_TYPE on an m.space.child event). */
export function parseThreadParent(
    content: unknown,
): BridgedThreadParent | null {
    if (!isRecord(content)) return null;
    const roomId = content["room_id"];
    if (typeof roomId !== "string" || !roomId.startsWith("!")) return null;
    const eventId = content["event_id"];
    const via = Array.isArray(content["via"])
        ? (content["via"] as unknown[]).filter(
              (s): s is string => typeof s === "string" && s.length > 0,
          )
        : [];
    return {
        roomId,
        ...(typeof eventId === "string" && eventId.startsWith("$")
            ? { eventId }
            : {}),
        via,
    };
}

/** The thread parent advertised on an m.space.child event's content, or null
 *  for a child that is not a thread or was removed from the space (no via). */
export function parseSpaceChildThreadParent(
    childContent: unknown,
): BridgedThreadParent | null {
    if (!isRecord(childContent)) return null;
    const via = childContent["via"];
    if (!Array.isArray(via) || via.length === 0) return null;
    return parseThreadParent(childContent[THREAD_PARENT_TYPE]);
}

export interface BridgedThreadIndex {
    /** thread room id -> its parent */
    parentOf: Map<string, BridgedThreadParent>;
    /** parent room id -> its thread room ids, in discovery order */
    threadsOf: Map<string, string[]>;
    /** `${parentRoomId}\n${eventId}` -> thread room id */
    byStarter: Map<string, string>;
}

export function starterKey(parentRoomId: string, eventId: string): string {
    return `${parentRoomId}\n${eventId}`;
}

/**
 * Build the index from every known (thread room, parent) pair. A room's own
 * state event comes first in `sources` and wins over a space's copy, which
 * only fills in what the room state lacks (a thread we have not joined).
 */
export function buildBridgedThreadIndex(
    sources: Iterable<{ threadRoomId: string; parent: BridgedThreadParent }>,
): BridgedThreadIndex {
    const parentOf = new Map<string, BridgedThreadParent>();
    for (const { threadRoomId, parent } of sources) {
        // A room cannot be its own thread; ignore a malformed self-reference.
        if (threadRoomId === parent.roomId) continue;
        const known = parentOf.get(threadRoomId);
        if (!known) {
            parentOf.set(threadRoomId, parent);
        } else if (known.roomId === parent.roomId) {
            // Same parent seen again: keep the first, but borrow what it lacks.
            parentOf.set(threadRoomId, {
                roomId: known.roomId,
                ...((known.eventId ?? parent.eventId)
                    ? { eventId: known.eventId ?? parent.eventId }
                    : {}),
                via: known.via.length ? known.via : parent.via,
            });
        }
    }
    const threadsOf = new Map<string, string[]>();
    const byStarter = new Map<string, string>();
    for (const [threadRoomId, parent] of parentOf) {
        const list = threadsOf.get(parent.roomId);
        if (list) list.push(threadRoomId);
        else threadsOf.set(parent.roomId, [threadRoomId]);
        if (parent.eventId) {
            const key = starterKey(parent.roomId, parent.eventId);
            if (!byStarter.has(key)) byStarter.set(key, threadRoomId);
        }
    }
    return { parentOf, threadsOf, byStarter };
}

export interface NestedRow<T> {
    item: T;
    /** 1 for a thread shown under its parent channel, else 0. */
    depth: 0 | 1;
}

/**
 * Discord-style channel list: each thread moves to just below its parent
 * channel when that parent is in the same list (threads keep their relative
 * order). A thread whose parent is not in the list stays where it is.
 */
export function nestThreadRows<T>(
    items: readonly T[],
    idOf: (item: T) => string,
    parentIdOf: (id: string) => string | null | undefined,
): NestedRow<T>[] {
    const ids = new Set(items.map(idOf));
    const childrenOf = new Map<string, T[]>();
    const nested = new Set<string>();
    for (const item of items) {
        const id = idOf(item);
        const parent = parentIdOf(id);
        if (!parent || parent === id || !ids.has(parent)) continue;
        // Only one level: a thread's parent must itself be a top-level row.
        const grand = parentIdOf(parent);
        if (grand && ids.has(grand)) continue;
        nested.add(id);
        const list = childrenOf.get(parent);
        if (list) list.push(item);
        else childrenOf.set(parent, [item]);
    }
    const out: NestedRow<T>[] = [];
    for (const item of items) {
        const id = idOf(item);
        if (nested.has(id)) continue;
        out.push({ item, depth: 0 });
        for (const child of childrenOf.get(id) ?? []) {
            out.push({ item: child, depth: 1 });
        }
    }
    return out;
}

// OOYE (and so ZDMB) names thread rooms "[⛓️] name", or "[🔒⛓️] name" for a
// private thread. Zam marks threads with its own icon, so the tag is dropped.
const THREAD_NAME_PREFIX = /^\[(?:\u{1F512}️?)?⛓️?\]\s*/u;

/** A bridged thread's name without the bridge's "[⛓️] " tag. */
export function stripThreadNamePrefix(name: string): string {
    const stripped = name.replace(THREAD_NAME_PREFIX, "");
    return stripped || name;
}
