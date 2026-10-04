import { EventTimeline, type MatrixEvent, type Room } from "matrix-js-sdk";

/**
 * Apply an `m.room.member` event that sliding sync appended to the live
 * timeline to the room's current state.
 *
 * Classic sync rolls the room state forward over every state event in the
 * timeline. matrix-js-sdk's sliding-sync layer adds timeline events with
 * `addToState: false` and relies on the server to resend changed state in
 * `required_state`, but lazy-loaded members (`$LAZY`) are only sent once per
 * connection. So a join or a name/avatar change that arrived in the timeline
 * never reached `room.getMember()`, and every row from that sender kept the
 * placeholder (raw user id, default avatar) however often it re-rendered.
 *
 * Skips anything that isn't a live-timeline append, and never overwrites a
 * member event the state already has that is as new or newer (required_state
 * can carry the state AFTER this event).
 */
export function applyTimelineMemberEvent(
    room: Room,
    event: MatrixEvent,
    timeline: EventTimeline | undefined,
    toStartOfTimeline: boolean | undefined,
): boolean {
    if (toStartOfTimeline || timeline !== room.getLiveTimeline()) return false;
    if (event.getType() !== "m.room.member") return false;
    const stateKey = event.getStateKey();
    if (!stateKey) return false;
    const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    if (!state) return false;
    const current = state.getStateEvents("m.room.member", stateKey);
    if (current) {
        if (current.getId() === event.getId()) return false;
        if (current.getTs() > event.getTs()) return false;
    }
    state.setStateEvents([event]);
    return true;
}
