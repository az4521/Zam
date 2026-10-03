import { describe, expect, it } from "vitest";
import {
    EventTimeline,
    MatrixEvent,
    Room,
    type MatrixClient,
} from "matrix-js-sdk";

// Why getTimelineMessages / loadPreviousMessages walk the live timeline's
// backward-neighbour chain instead of reading the live timeline alone (see
// liveTimelineChain in client.ts): after a gappy sync resets the live timeline,
// back-pagination that reaches a pre-gap event links the old timeline behind
// the live one and keeps adding the OLDER history there, not to the live one.

const ROOM = "!r:x";
const msg = (id: string) =>
    new MatrixEvent({
        event_id: id,
        room_id: ROOM,
        type: "m.room.message",
        sender: "@a:x",
        origin_server_ts: 1,
        content: { msgtype: "m.text", body: id },
    });

function makeRoom(): Room {
    const client = {
        getUserId: () => "@me:x",
        supportsThreads: () => false,
        decryptEventIfNeeded: () => Promise.resolve(),
        isInitialSyncComplete: () => true,
        getRoom: () => null,
        on: () => {},
        off: () => {},
        emit: () => {},
    } as unknown as MatrixClient;
    return new Room(ROOM, client, "@me:x", { timelineSupport: true });
}

const ids = (tl: EventTimeline) => tl.getEvents().map((e) => e.getId());

describe("back-pagination across a gappy-sync reset", () => {
    it("joins the pre-gap timeline and fills it, not the live one", async () => {
        const room = makeRoom();
        const set = room.getUnfilteredTimelineSet();
        await room.addLiveEvents([msg("$a"), msg("$b")], { addToState: false });
        const preGap = room.getLiveTimeline();

        // Limited sync: fresh live timeline starting after the gap. Sync passes
        // the previous sync token forward (canResetEntireTimeline defaults to
        // false), which is what keeps the pre-gap timeline in the set.
        room.resetLiveTimeline("gap-token", "old-sync-token");
        await room.addLiveEvents([msg("$d")], { addToState: false });
        const live = room.getLiveTimeline();
        expect(live).not.toBe(preGap);

        // A backward /messages page (newest first) crossing the gap.
        set.addEventsToTimeline(
            [msg("$c"), msg("$b"), msg("$a"), msg("$older")],
            true,
            false,
            live,
            "next-token",
        );

        expect(ids(live)).toEqual(["$c", "$d"]);
        expect(live.getNeighbouringTimeline(EventTimeline.BACKWARDS)).toBe(
            preGap,
        );
        expect(ids(preGap)).toEqual(["$older", "$a", "$b"]);
        // The page's token belongs to the older timeline now.
        expect(preGap.getPaginationToken(EventTimeline.BACKWARDS)).toBe(
            "next-token",
        );
    });
});
