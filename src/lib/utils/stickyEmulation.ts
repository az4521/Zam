/**
 * MSC4354 sticky events for widgets on a server without them.
 *
 * Widgets such as NeoBoard announce their MatrixRTC membership with sticky
 * events and only count an event that carries the `msc4354_sticky` marker
 * (matrix-widget-toolkit's isRoomEventCurrentlySticky). Without server support
 * Zam sends these as plain events, so the marker is missing and the widget
 * ignores every peer: NeoBoard then drops all LiveKit data from them and falls
 * back to the slow room-event sync. A sticky sender always puts
 * `msc4354_sticky_key` in the content, so that key restores the marker here,
 * and the room history stands in for the server's sticky state.
 */

/** The longest sticky duration MSC4354 allows (and the toolkit honours). */
export const STICKY_MAX_DURATION_MS = 3_600_000;

interface StickyCandidate {
    type: string;
    sender: string;
    origin_server_ts: number;
    content?: unknown;
    sticky?: { duration_ms: number };
    msc4354_sticky?: { duration_ms: number };
}

function stickyKeyOf(event: { content?: unknown }): string | null {
    const content = event.content;
    if (!content || typeof content !== "object") return null;
    const key = (content as Record<string, unknown>).msc4354_sticky_key;
    return typeof key === "string" && key.length > 0 ? key : null;
}

/**
 * Adds the sticky marker to `event` (in place) when it has a sticky key but the
 * server sent no marker. The duration is unknown then; the maximum is used,
 * which is what senders such as NeoBoard ask for and refresh within.
 */
export function emulateStickyMarker<T extends object>(event: T): T {
    const e = event as T & Partial<StickyCandidate>;
    if (e.sticky || e.msc4354_sticky) return event;
    if (stickyKeyOf(e) === null) return event;
    e.msc4354_sticky = { duration_ms: STICKY_MAX_DURATION_MS };
    return event;
}

/**
 * The sticky events still active at `now`, as the server would report them:
 * the latest per sender, type and sticky key, oldest first. Events without a
 * marker or sticky key are left out.
 */
export function activeStickyEvents<T extends StickyCandidate>(
    events: T[],
    now: number,
): T[] {
    const latest = new Map<string, T>();
    for (const e of events) {
        const marker = e.sticky ?? e.msc4354_sticky;
        const key = stickyKeyOf(e);
        if (!marker || key === null) continue;
        const start = Math.min(e.origin_server_ts, now);
        const duration = Math.min(marker.duration_ms, STICKY_MAX_DURATION_MS);
        if (start + duration <= now) continue;
        const id = JSON.stringify([e.sender, e.type, key]);
        const prev = latest.get(id);
        if (!prev || prev.origin_server_ts <= e.origin_server_ts)
            latest.set(id, e);
    }
    return [...latest.values()].sort(
        (a, b) => a.origin_server_ts - b.origin_server_ts,
    );
}
