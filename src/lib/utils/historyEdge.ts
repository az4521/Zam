import { Direction, type EventTimeline } from "matrix-js-sdk";

/**
 * What sits at the top of a room's timeline while the user is scrolled to the
 * oldest loaded message: the chat-start banner, a loading indicator, or nothing.
 *
 * "start" only when the room's `m.room.create` is really in the timeline. Until
 * then the top may just be history that has not been paginated yet, and calling
 * that the beginning of the chat was the bug in issue #49.
 */
export type HistoryEdge = "start" | "loading" | "none";

/** Whether an event list holds the room's `m.room.create`. Hidden from the messages list by design, so check the raw events. */
export function hasRoomCreate(events: { getType(): string }[]): boolean {
    return events.some((e) => e.getType() === "m.room.create");
}

/**
 * Whether the live timeline chain (walked backwards through every linked older
 * timeline) contains an `m.room.create` event.
 */
export function timelineReachesRoomCreate(live: EventTimeline): boolean {
    const seen = new Set<EventTimeline>();
    let tl: EventTimeline | null = live;
    while (tl && !seen.has(tl)) {
        seen.add(tl);
        if (hasRoomCreate(tl.getEvents())) return true;
        tl = tl.getNeighbouringTimeline(Direction.Backward);
    }
    return false;
}

/**
 * Decide the top-of-timeline indicator.
 *  - `reachedStart`: the room's `m.room.create` is in the timeline.
 *  - `hasOlder`: older history may still be fetched (pagination token or the
 *    context window's backwards edge). Starts true for a fresh room.
 *  - `loadingOlder`: a backwards page is in flight right now.
 *
 * Once pagination is known to be exhausted without reaching the create event
 * (the server has nothing more), no banner is shown: the start was not
 * verified, so claiming it would be a lie.
 */
export function historyEdge(state: {
    reachedStart: boolean;
    hasOlder: boolean;
    loadingOlder: boolean;
}): HistoryEdge {
    if (state.reachedStart) return "start";
    if (state.loadingOlder || state.hasOlder) return "loading";
    return "none";
}
