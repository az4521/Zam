// src/lib/utils/threadUnread.ts
/**
 * Pure badge-state + room-level rollup for per-thread unread. SDK-free so the
 * thresholds and aggregation are table-testable independent of the live SDK
 * notification counts (which `getRoomThreads` reads and passes in). `highlight`
 * (mentions) is a subset of `total` in Matrix, so mentions are checked first.
 */

export type ThreadBadgeState = "none" | "unread" | "mention";

export interface ThreadUnreadCounts {
    total: number;
    highlight: number;
}

export interface RoomThreadRollup {
    anyUnread: boolean;
    mentions: number;
}

/** Per-thread badge: mention beats plain unread beats none. */
export function threadBadgeState({
    total,
    highlight,
}: ThreadUnreadCounts): ThreadBadgeState {
    if (highlight > 0) return "mention";
    if (total > 0) return "unread";
    return "none";
}

/**
 * Aggregate per-thread counts into a room-level indicator distinct from main
 * unread: `anyUnread` if any thread has unread/mention activity, `mentions` =
 * total mention count summed across threads.
 */
export function rollupRoomThreadUnread(
    perThread: ThreadUnreadCounts[],
): RoomThreadRollup {
    let anyUnread = false;
    let mentions = 0;
    for (const { total, highlight } of perThread) {
        if (total > 0 || highlight > 0) anyUnread = true;
        if (highlight > 0) mentions += highlight;
    }
    return { anyUnread, mentions };
}
