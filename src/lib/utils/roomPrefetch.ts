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

export interface RoomPrefetchInput {
    /** Visible room ids, top of the list first. Duplicates are ignored. */
    visibleRoomIds: readonly string[];
    /** The room being viewed; never prefetched (the room view loads it). */
    activeRoomId: string | null;
    /** Live-timeline event count per room. A room missing here counts as 0. */
    loadedCounts: ReadonlyMap<string, number>;
    /** Epoch ms of each room's last prefetch attempt. */
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
 * The rooms to start prefetching now, top of the list first. Returns at most
 * PREFETCH_CONCURRENCY minus the number already in flight.
 */
export function pickPrefetchRooms(input: RoomPrefetchInput): string[] {
    if (input.saveData || input.hidden) return [];
    const slots = PREFETCH_CONCURRENCY - input.inFlight.size;
    if (slots <= 0) return [];
    const picked: string[] = [];
    const seen = new Set<string>();
    for (const roomId of input.visibleRoomIds) {
        if (picked.length >= slots) break;
        if (seen.has(roomId)) continue;
        seen.add(roomId);
        if (roomId === input.activeRoomId) continue;
        if (input.inFlight.has(roomId)) continue;
        if ((input.loadedCounts.get(roomId) ?? 0) >= PREFETCH_TARGET) continue;
        const last = input.lastPrefetchAt.get(roomId);
        if (last !== undefined && input.now - last < PREFETCH_COOLDOWN_MS)
            continue;
        picked.push(roomId);
    }
    return picked;
}

/** How many events one prefetch page asks for to reach PREFETCH_TARGET. */
export function prefetchPageSize(loaded: number): number {
    return Math.max(1, PREFETCH_TARGET - Math.max(0, loaded));
}
