/**
 * Scrollback sizing: aim for visible messages, not raw events.
 *
 * The server pages history in events, and in rooms full of joins, leaves or
 * reactions most of them render nothing; a fixed 15-event page could show one
 * message. Instead the timeline keeps a buffer of visible messages above the
 * viewport, and each request is sized from how many events have recently
 * turned out visible, so every page shows about the same amount.
 */

/** Visible messages to keep loaded above the viewport while scrolling up. */
export const BACKFILL_BUFFER_ROWS = 30;
/** Visible messages one page aims to add: each lands in one frame, and ~28
 *  rows measured as a ~50ms frame, so pages stay below that. */
export const BACKFILL_ROWS_PER_PAGE = 15;
export const BACKFILL_MIN_EVENTS = 15;
export const BACKFILL_MAX_EVENTS = 100;
/** Starting guess for a room: an ordinary chat shows nearly every event. */
export const INITIAL_VISIBLE_RATIO = 1;
// Below this a page is effectively empty; keeps the division finite.
const MIN_RATIO = 0.01;

/** Events to request for the next page. */
export function nextBackfillLimit(
    rowsNeeded: number,
    visibleRatio: number,
): number {
    const rows = Math.min(Math.max(rowsNeeded, 1), BACKFILL_ROWS_PER_PAGE);
    const events = Math.ceil(rows / Math.max(visibleRatio, MIN_RATIO));
    return Math.min(BACKFILL_MAX_EVENTS, Math.max(BACKFILL_MIN_EVENTS, events));
}

/** Blend the last page's share of visible events into the running estimate
 *  (half and half: reacts within a page or two, ignores a one-off). */
export function updateVisibleRatio(
    previous: number,
    rowsGained: number,
    eventsRequested: number,
): number {
    if (eventsRequested <= 0) return previous;
    const page = Math.min(1, Math.max(0, rowsGained) / eventsRequested);
    return previous * 0.5 + page * 0.5;
}

/**
 * How many of `rows` (top-to-bottom, in document order) end above `top`:
 * a binary search, so a long timeline costs a handful of layout reads
 * rather than one per row.
 */
export function countRowsAbove(
    rows: ArrayLike<{ getBoundingClientRect(): { bottom: number } }>,
    top: number,
): number {
    let lo = 0;
    let hi = rows.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (rows[mid].getBoundingClientRect().bottom <= top) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}
