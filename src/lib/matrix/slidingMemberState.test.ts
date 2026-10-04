import { describe, expect, it } from "vitest";
import {
    EventTimeline,
    MatrixEvent,
    Room,
    type MatrixClient,
} from "matrix-js-sdk";
import { applyTimelineMemberEvent } from "./slidingMemberState";

const ROOM = "!r:x";
const BOB = "@bob:x";

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

const member = (id: string, ts: number, displayname?: string) =>
    new MatrixEvent({
        event_id: id,
        room_id: ROOM,
        type: "m.room.member",
        state_key: BOB,
        sender: BOB,
        origin_server_ts: ts,
        content: { membership: "join", displayname },
    });

// What sliding sync does: append to the live timeline WITHOUT touching state.
async function slidingAppend(room: Room, ev: MatrixEvent) {
    await room.addLiveEvents([ev], { addToState: false });
}

describe("applyTimelineMemberEvent", () => {
    it("shows that sliding sync's append leaves the member stale on its own", async () => {
        const room = makeRoom();
        await slidingAppend(room, member("$join", 1, "Bob"));
        expect(room.getMember(BOB)).toBeNull();
    });

    it("applies a join from the live timeline so the sender resolves", async () => {
        const room = makeRoom();
        const ev = member("$join", 1, "Bob");
        await slidingAppend(room, ev);
        expect(
            applyTimelineMemberEvent(room, ev, room.getLiveTimeline(), false),
        ).toBe(true);
        expect(room.getMember(BOB)?.name).toBe("Bob");
    });

    it("applies a later name change over the earlier member event", () => {
        const room = makeRoom();
        room.getLiveTimeline()
            .getState(EventTimeline.FORWARDS)!
            .setStateEvents([member("$join", 1, "Bob")]);
        const rename = member("$rename", 2, "Robert");
        applyTimelineMemberEvent(room, rename, room.getLiveTimeline(), false);
        expect(room.getMember(BOB)?.name).toBe("Robert");
    });

    it("never overwrites newer state (required_state is state after the timeline)", () => {
        const room = makeRoom();
        room.getLiveTimeline()
            .getState(EventTimeline.FORWARDS)!
            .setStateEvents([member("$newer", 5, "Robert")]);
        const older = member("$older", 2, "Bob");
        expect(
            applyTimelineMemberEvent(
                room,
                older,
                room.getLiveTimeline(),
                false,
            ),
        ).toBe(false);
        expect(room.getMember(BOB)?.name).toBe("Robert");
    });

    it("ignores back-pagination and other timelines", () => {
        const room = makeRoom();
        const ev = member("$old", 1, "Bob");
        expect(
            applyTimelineMemberEvent(room, ev, room.getLiveTimeline(), true),
        ).toBe(false);
        const other = room.getUnfilteredTimelineSet().addTimeline();
        expect(applyTimelineMemberEvent(room, ev, other, false)).toBe(false);
        expect(room.getMember(BOB)).toBeNull();
    });
});
