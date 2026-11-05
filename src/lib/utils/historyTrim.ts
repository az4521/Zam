// Older history of rooms the user isn't looking at is let go, so a long-lived
// session doesn't hold every page ever scrolled back (or synced into a busy
// room) in memory. matrix-js-sdk keeps all of it for the life of the client.
// What stays is counted in events that render, not events: a room whose
// newest 100 events are joins, reactions and redactions must not come back
// empty.

/** Rendered events kept per room. */
export const HISTORY_KEEP_VISIBLE = 100;
/** Fewer droppable events than this isn't worth a refetch on the way back. */
export const HISTORY_TRIM_MIN_DROP = 50;
/** A room left this recently is likely to be switched back to. */
export const HISTORY_TRIM_IDLE_MS = 2 * 60_000;
/** How often rooms are checked. */
export const HISTORY_TRIM_INTERVAL_MS = 2 * 60_000;

/**
 * Index into the room's events (oldest first) of the oldest one to keep, or
 * null when nothing should go. Every event from there on is kept, hidden ones
 * included, so the newest `keep` rendered events stay with whatever sits
 * between them.
 */
export function historyTrimCut(
    rendered: readonly boolean[],
    keep = HISTORY_KEEP_VISIBLE,
    minDrop = HISTORY_TRIM_MIN_DROP,
): number | null {
    let seen = 0;
    for (let i = rendered.length - 1; i >= 0; i--) {
        if (!rendered[i]) continue;
        if (++seen === keep) return i >= minDrop ? i : null;
    }
    return null;
}

/** Whether a room may be trimmed: not open, and not left a moment ago. */
export function mayTrimRoom(
    roomId: string,
    activeRoomId: string | null,
    leftAt: number | undefined,
    now: number,
): boolean {
    if (roomId === activeRoomId) return false;
    return leftAt === undefined || now - leftAt >= HISTORY_TRIM_IDLE_MS;
}
