// Pure decisions behind the sliding-sync wiring in matrix/client.ts, split out
// so they can be tested without a homeserver.

/**
 * The next range end for a growing list, or null once the window already
 * covers all `total` rooms. `end` is the inclusive index the list currently
 * requests up to.
 */
export function nextWindowEnd(
    end: number | undefined,
    total: number,
    step: number,
): number | null {
    if (end === undefined || total <= 0) return null;
    if (end + 1 >= total) return null;
    return Math.min(end + step, total - 1);
}

/**
 * Whether a failed sliding-sync probe means the homeserver lacks the endpoint
 * (so we should fall back to classic /sync). Transient failures (network
 * errors, 5xx, rate limits, auth) return false: those are not evidence the
 * server can't do it, and silently downgrading on a blip would be worse.
 */
export function isSlidingSyncUnsupportedError(err: unknown): boolean {
    const e = err as { httpStatus?: number; errcode?: string } | null;
    if (!e || typeof e !== "object") return false;
    if (e.errcode === "M_UNRECOGNIZED") return true;
    return e.httpStatus === 404 || e.httpStatus === 405 || e.httpStatus === 501;
}

/**
 * Whether a sliding-sync room update skipped over events we never received,
 * so the room's live timeline must be reset before the update is applied.
 *
 * matrix-js-sdk's sliding-sync layer never does this itself (its reset code
 * is a commented-out TODO): a `limited` update with no overlap is appended
 * straight onto the old timeline with no gap marker, and when a later update
 * DOES overlap, every unknown event before the known one is treated as
 * scrollback and inserted at the START of the timeline. With a room-list
 * timeline_limit of 1 that happens whenever two messages land in a room you
 * aren't viewing, so opening it (say, from a notification) showed the newest
 * message but put the ones in between above all the older history. Classic
 * /sync resets the live timeline on a gap; this restores that behaviour.
 *
 * A gap is a `limited` update, into a room whose live timeline already has
 * events, where none of the update's events is known ANYWHERE in the room.
 * Known means any timeline, not just the live one: a notification tap opens
 * the notified message in a separate context timeline before sync catches
 * up, and thread replies live in thread timelines. Treating those as unknown
 * reset the room under an open context view, which discarded the timeline
 * on screen. Any overlap means the update joins on and the SDK's own
 * dedupe/scrollback split places it correctly.
 */
export function isSlidingTimelineGap(
    update: { limited?: boolean; timelineEventIds: string[] },
    room: { liveIsEmpty: boolean; isKnown: (eventId: string) => boolean },
): boolean {
    if (!update.limited) return false;
    if (update.timelineEventIds.length === 0 || room.liveIsEmpty) return false;
    return !update.timelineEventIds.some((id) => room.isKnown(id));
}

/** Long-poll timeout both sync loops use (classic pollTimeout default and
 *  SLIDING_TIMEOUT_MS): a healthy loop answers at least this often. */
export const SYNC_POLL_MS = 30_000;

/**
 * Whether to abort the in-flight sync request and restart it now.
 *
 * After a network blip or an OS suspend (app backgrounded, notification tap
 * back in) the long-poll can sit on a dead connection without erroring, and
 * matrix-js-sdk only gives up on it after poll + 80s (110s), so new messages
 * just don't arrive for up to two minutes. The SDK's own `online` handler
 * only helps once a request has already FAILED. So restart when:
 *   - the browser says we're back online,
 *   - the app becomes visible after being hidden for a few seconds (timers
 *     and sockets may have been frozen), or
 *   - no sync response has landed for well over a poll interval (watchdog,
 *     for blips that fire no event at all).
 */
export function shouldKickSync(
    trigger: "online" | "visible" | "watchdog",
    sinceLastSyncMs: number,
    hiddenForMs = 0,
    overdueAfterMs = SYNC_POLL_MS + 15_000,
): boolean {
    const overdue = sinceLastSyncMs > overdueAfterMs;
    switch (trigger) {
        case "online":
            return true;
        case "visible":
            return hiddenForMs >= 5_000 || overdue;
        case "watchdog":
            return overdue;
    }
}

/**
 * How long without a sync response before the watchdog restarts the request.
 *
 * A fixed threshold never let a slow connection finish: a catch-up response
 * still downloading after 45s was aborted and re-requested, forever. Each
 * watchdog restart that brings no response doubles the wait (`strikes`, reset
 * by any response), capped at 5 minutes, and it never undercuts the time the
 * in-flight request is itself allowed (`requestTimeoutMs`).
 */
export function watchdogOverdueMs(
    strikes: number,
    requestTimeoutMs = 0,
): number {
    const base = SYNC_POLL_MS + 15_000;
    const backedOff = Math.min(base * 2 ** strikes, 5 * 60_000);
    return Math.max(backedOff, requestTimeoutMs + 15_000);
}
