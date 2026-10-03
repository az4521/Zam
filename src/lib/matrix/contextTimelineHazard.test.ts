import { describe, expect, it } from "vitest";
import { MatrixEvent, Room, type MatrixClient } from "matrix-js-sdk";

// Why a notification jump must not build a context window before sync catches
// up (see waitForLiveEvent in client.ts): the SDK's addLiveEvent drops any
// event already held by another timeline in the set.

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

describe("context timeline vs live sync", () => {
    it("sync events already in a context timeline never reach the live timeline", async () => {
        const room = makeRoom();
        const set = room.getUnfilteredTimelineSet();
        await room.addLiveEvents([msg("$old")], { addToState: false });

        // The jump fetched /context while sync was behind.
        const ctx = set.addTimeline();
        set.addEventsToTimeline(
            [msg("$notified"), msg("$after")],
            false,
            false,
            ctx,
        );
        expect(ctx).not.toBe(room.getLiveTimeline());

        // Sync resumes and delivers the same messages plus a newer one.
        await room.addLiveEvents(
            [msg("$notified"), msg("$after"), msg("$newest")],
            { addToState: false },
        );
        const live = room
            .getLiveTimeline()
            .getEvents()
            .map((e) => e.getId());
        expect(live).toEqual(["$old", "$newest"]);
    });

    it("with sync caught up first, the live timeline keeps every message", async () => {
        const room = makeRoom();
        await room.addLiveEvents(
            [msg("$old"), msg("$notified"), msg("$after"), msg("$newest")],
            { addToState: false },
        );
        expect(
            room
                .getLiveTimeline()
                .getEvents()
                .map((e) => e.getId()),
        ).toEqual(["$old", "$notified", "$after", "$newest"]);
    });
});
