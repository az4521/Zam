import { describe, expect, it } from "vitest";
import {
    Direction,
    EventTimeline,
    MatrixEvent,
    Room,
    type MatrixClient,
} from "matrix-js-sdk";
import { rebuildLiveTimeline } from "./timelineRebuild";

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

function chainIds(room: Room): string[] {
    const out: string[] = [];
    let tl: EventTimeline | null = room.getLiveTimeline();
    while (tl) {
        out.unshift(...tl.getEvents().map((e) => e.getId()!));
        tl = tl.getNeighbouringTimeline(Direction.Backward);
    }
    return out;
}

/** A live timeline with an older, gap-parked timeline linked behind it. */
async function roomWithHistory(): Promise<Room> {
    const room = makeRoom();
    const set = room.getUnfilteredTimelineSet();
    await room.addLiveEvents([msg("$a"), msg("$b"), msg("$c")], {
        addToState: false,
    });
    room.getLiveTimeline().setPaginationToken("tok-a", Direction.Backward);
    // A gappy sync parks those behind a fresh live timeline...
    set.resetLiveTimeline("tok-gap", "fwd");
    await room.addLiveEvents([msg("$e"), msg("$f")], { addToState: false });
    // ...and paging back joins the two.
    set.addEventsToTimeline(
        [msg("$d"), msg("$c")],
        true,
        false,
        room.getLiveTimeline(),
        "tok-x",
    );
    return room;
}

describe("rebuildLiveTimeline", () => {
    it("keeps only the given events, in one live timeline", async () => {
        const room = await roomWithHistory();
        expect(chainIds(room)).toEqual(["$a", "$b", "$c", "$d", "$e", "$f"]);

        const all = chainIds(room).map(
            (id) => room.findEventById(id) as MatrixEvent,
        );
        rebuildLiveTimeline(room, all.slice(3), "tok-before-d");

        expect(chainIds(room)).toEqual(["$d", "$e", "$f"]);
        const live = room.getLiveTimeline();
        expect(live.getNeighbouringTimeline(Direction.Backward)).toBeNull();
        expect(live.getPaginationToken(Direction.Backward)).toBe(
            "tok-before-d",
        );
        // scrollback() reads the legacy alias.
        expect(room.oldState.paginationToken).toBe("tok-before-d");
        // Dropped events are gone from the index, not just the list.
        const set = room.getUnfilteredTimelineSet();
        expect(set.getTimelines()).toEqual([live]);
        expect(set.findEventById("$a")).toBeUndefined();
        expect(set.findEventById("$e")).toBeDefined();
    });

    it("lets sync append and paging back refill the dropped history", async () => {
        const room = await roomWithHistory();
        const all = chainIds(room).map(
            (id) => room.findEventById(id) as MatrixEvent,
        );
        rebuildLiveTimeline(room, all.slice(3), "tok-before-d");

        await room.addLiveEvents([msg("$g")], { addToState: false });
        // The page /messages returns for tok-before-d, newest first.
        const set = room.getUnfilteredTimelineSet();
        set.addEventsToTimeline(
            [msg("$c"), msg("$b"), msg("$a")],
            true,
            false,
            room.getLiveTimeline(),
            "tok-a",
        );
        expect(chainIds(room)).toEqual([
            "$a",
            "$b",
            "$c",
            "$d",
            "$e",
            "$f",
            "$g",
        ]);
        expect(
            room.getLiveTimeline().getPaginationToken(Direction.Backward),
        ).toBe("tok-a");
    });
});
