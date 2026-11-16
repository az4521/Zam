/**
 * Progress types and pure math for the one-shot full index build
 * (matrix/eventIndex buildFullIndex). No SDK or DOM imports, so it is testable.
 */

export interface FullIndexProgress {
    /** Candidate rooms whose history crawl is finished. */
    roomsDone: number;
    roomsTotal: number;
    /** Backwards pages fetched by this run. */
    pages: number;
    /** Messages newly queued into the index by this run. */
    messagesIndexed: number;
    currentRoomId?: string;
}

export type FullIndexReason =
    "complete" | "partial" | "storage" | "aborted" | "unavailable";

export interface FullIndexResult {
    reason: FullIndexReason;
    progress: FullIndexProgress;
    /** Rooms still not done when the run ended (only meaningful for partial). */
    failedRooms: number;
}

/** Whole-number percent of rooms done. No candidate rooms counts as done. */
export function fullIndexPercent(
    roomsDone: number,
    roomsTotal: number,
): number {
    if (!(roomsTotal > 0)) return 100;
    const done = Math.min(Math.max(roomsDone, 0), roomsTotal);
    return Math.floor((done / roomsTotal) * 100);
}

/** Rooms not finished. Never negative. */
export function unfinishedRoomCount(
    roomsDone: number,
    roomsTotal: number,
): number {
    return Math.max(0, roomsTotal - Math.max(roomsDone, 0));
}

/** 3210 -> "3,210". Plain digit grouping, so output is the same in every locale. */
export function groupThousands(n: number): string {
    const whole = Math.trunc(Math.max(0, n) || 0);
    return String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
