/**
 * Pure scheduling for the visible-room message prefetch. The store that owns
 * the observer and the timers lives in stores/roomPrefetch.svelte.ts; this
 * module has no SDK, DOM or timer imports so its rules test in isolation.
 */

/** Live-timeline events a room should hold before a prefetch is skipped. */
export const PREFETCH_TARGET = 20;
/** A room is not prefetched again within this long after its last attempt. */
export const PREFETCH_COOLDOWN_MS = 5 * 60_000;
/** Prefetches allowed in flight at once. */
export const PREFETCH_CONCURRENCY = 2;
/** The visible set must hold still this long before a prefetch starts (scrolling). */
export const PREFETCH_SETTLE_MS = 400;
/**
 * How long a prefetched read-position window stays usable. It lives in its
 * own timeline set, so edits and redactions arriving by sync never reach it;
 * past this the room view loads a fresh one instead. Matches the cooldown so
 * an expired window is fetched again the next time its row is on screen.
 */
export const ANCHOR_WINDOW_TTL_MS = PREFETCH_COOLDOWN_MS;

/** One room to prefetch. */
export interface PrefetchPick {
    roomId: string;
    /**
     * The event the room will open at (its read position, which is not
     * loaded): build a window there. Null: page the newest history instead.
     */
    anchor: string | null;
}

export interface RoomPrefetchInput {
    /** Visible room ids, top of the list first. Duplicates are ignored. */
    visibleRoomIds: readonly string[];
    /** The room being viewed; never prefetched (the room view loads it). */
    activeRoomId: string | null;
    /**
     * Rooms that will open at an unloaded read position: room id -> the event
     * the room view opens a window at. The user lands there, not at the
     * newest messages, so that is what gets fetched.
     */
    unreadAnchors: ReadonlyMap<string, string>;
    /** Room id -> the anchor event of a ready (or loading) prefetched window. */
    preparedAnchors: ReadonlyMap<string, string>;
    /** Live-timeline event count per room. A room missing here counts as 0. */
    loadedCounts: ReadonlyMap<string, number>;
    /** Epoch ms of each last prefetch attempt, keyed by prefetchKey. */
    lastPrefetchAt: ReadonlyMap<string, number>;
    /** Rooms with a prefetch already running. */
    inFlight: ReadonlySet<string>;
    now: number;
    /** navigator.connection.saveData: the user asked for less data. */
    saveData: boolean;
    /** document.hidden: nobody is looking at the list. */
    hidden: boolean;
}

/**
 * The cooldown key of a pick. An anchor pick is keyed by its event, so a read
 * position that moved (read on another device) is fetched again at once.
 */
export function prefetchKey(pick: PrefetchPick): string {
    return pick.anchor ? `${pick.roomId}|${pick.anchor}` : pick.roomId;
}

/**
 * The rooms to start prefetching now, top of the list first. Returns at most
 * PREFETCH_CONCURRENCY minus the number already in flight. An unread room
 * whose read position is not loaded gets a window at that position (where it
 * opens); any other room gets its newest history.
 */
export function pickPrefetchRooms(input: RoomPrefetchInput): PrefetchPick[] {
    if (input.saveData || input.hidden) return [];
    const slots = PREFETCH_CONCURRENCY - input.inFlight.size;
    if (slots <= 0) return [];
    const picked: PrefetchPick[] = [];
    const seen = new Set<string>();
    for (const roomId of input.visibleRoomIds) {
        if (picked.length >= slots) break;
        if (seen.has(roomId)) continue;
        seen.add(roomId);
        if (roomId === input.activeRoomId) continue;
        if (input.inFlight.has(roomId)) continue;
        const anchor = input.unreadAnchors.get(roomId) ?? null;
        if (anchor) {
            if (input.preparedAnchors.get(roomId) === anchor) continue;
        } else if ((input.loadedCounts.get(roomId) ?? 0) >= PREFETCH_TARGET) {
            continue;
        }
        const pick = { roomId, anchor };
        const last = input.lastPrefetchAt.get(prefetchKey(pick));
        if (last !== undefined && input.now - last < PREFETCH_COOLDOWN_MS)
            continue;
        picked.push(pick);
    }
    return picked;
}

/** How many events one prefetch page asks for to reach PREFETCH_TARGET. */
export function prefetchPageSize(loaded: number): number {
    return Math.max(1, PREFETCH_TARGET - Math.max(0, loaded));
}
