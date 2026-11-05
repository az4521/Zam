import type { MatrixEvent, Room } from "matrix-js-sdk";

/**
 * Replace everything the room's main timeline holds with `kept` (oldest
 * first, the newest end of its live history), paginating back from
 * `backToken` (a token right before the oldest of them). Used to let go of
 * older history (client.ts trimRoomHistory).
 *
 * The SDK has no way to cut a timeline in place: older timelines are linked
 * behind the live one and indexed by event id. So the live timeline is reset,
 * which forgets every timeline, and the kept events are added back to the new
 * one the way a back-pagination adds them. Thread and filtered timelines keep
 * their own events and are left alone (room.resetLiveTimeline would reset
 * them too).
 */
export function rebuildLiveTimeline(
    room: Room,
    kept: MatrixEvent[],
    backToken: string,
): void {
    const set = room.getUnfilteredTimelineSet();
    set.resetLiveTimeline();
    // What room.resetLiveTimeline does after resetting: oldState and
    // currentState must point at the new live timeline's states, or
    // scrollback() would read the old one's token.
    (
        room as unknown as { fixUpLegacyTimelineFields(): void }
    ).fixUpLegacyTimelineFields();
    set.addEventsToTimeline(
        [...kept].reverse(),
        true,
        false,
        set.getLiveTimeline(),
        backToken,
    );
}
