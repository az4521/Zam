import { describe, it, expect } from "vitest";
import { createClient, EventType, MatrixEvent, Room } from "matrix-js-sdk";
import {
    buildSnapshot,
    dropRedactedFromSnapshot,
    materializeSnapshot,
    type RoomListSnapshot,
} from "./roomListCache";

const ME = "@me:example.org";
const BOB = "@bob:example.org";

function stateEvent(
    roomId: string,
    type: string,
    stateKey: string,
    content: Record<string, unknown>,
    sender = ME,
) {
    return new MatrixEvent({
        type,
        state_key: stateKey,
        content,
        room_id: roomId,
        sender,
        event_id: `$${type}-${stateKey}-${roomId}`,
        origin_server_ts: 1,
    });
}

function makeClient() {
    const client = createClient({
        baseUrl: "https://example.org",
        userId: ME,
        deviceId: "DEV",
    });
    const add = (roomId: string, events: MatrixEvent[]) => {
        const room = new Room(roomId, client, ME);
        room.getLiveTimeline().initialiseState(events);
        room.updateMyMembership("join");
        room.recalculate();
        client.store.storeRoom(room);
        return room;
    };
    return { client, add };
}

describe("roomListCache", () => {
    it("round-trips spaces, names, children, tags and DMs", () => {
        const { client, add } = makeClient();
        add("!space", [
            stateEvent("!space", "m.room.create", "", { type: "m.space" }),
            stateEvent("!space", "m.room.name", "", { name: "My Space" }),
            stateEvent("!space", "m.space.child", "!chan", { via: ["x"] }),
            stateEvent("!space", "m.room.member", ME, { membership: "join" }),
        ]);
        const chan = add("!chan", [
            stateEvent("!chan", "m.room.create", "", {}),
            stateEvent("!chan", "m.room.name", "", { name: "general" }),
            stateEvent("!chan", "m.room.member", ME, { membership: "join" }),
        ]);
        chan.addAccountData([
            new MatrixEvent({
                type: "m.tag",
                content: { tags: { "m.favourite": { order: 0.5 } } },
            }),
        ]);
        add("!dm", [
            stateEvent("!dm", "m.room.create", "", {}),
            stateEvent("!dm", "m.room.member", ME, { membership: "join" }),
            stateEvent(
                "!dm",
                "m.room.member",
                BOB,
                { membership: "join", displayname: "Bob" },
                BOB,
            ),
        ]);
        client.store.storeAccountDataEvents([
            new MatrixEvent({
                type: EventType.Direct,
                content: { [BOB]: ["!dm"] },
            }),
        ]);

        const snap = JSON.parse(JSON.stringify(buildSnapshot(client)));
        const fresh = makeClient().client;
        const { rooms, accountData } = materializeSnapshot(fresh, snap);

        expect(fresh.getRooms()).toHaveLength(0); // never enters the SDK store
        const space = rooms.get("!space")!;
        expect(space.isSpaceRoom()).toBe(true);
        expect(space.name).toBe("My Space");
        expect(
            space.currentState
                .getStateEvents("m.space.child")
                .map((e) => e.getStateKey()),
        ).toEqual(["!chan"]);
        expect(rooms.get("!chan")!.name).toBe("general");
        expect(rooms.get("!chan")!.tags["m.favourite"]).toEqual({
            order: 0.5,
        });
        expect(rooms.get("!chan")!.getMyMembership()).toBe("join");
        expect(rooms.get("!dm")!.name).toBe("Bob");
        expect(accountData.get(EventType.Direct)?.getContent()).toEqual({
            [BOB]: ["!dm"],
        });
    });

    it("keeps each room's timeline tail and replays it read-only", () => {
        const { client, add } = makeClient();
        const room = add("!chan", [
            stateEvent("!chan", "m.room.create", "", {}),
            stateEvent("!chan", "m.room.member", ME, { membership: "join" }),
        ]);
        const message = (n: number) =>
            new MatrixEvent({
                type: EventType.RoomMessage,
                room_id: "!chan",
                sender: BOB,
                event_id: `$m${n}`,
                origin_server_ts: 1000 + n,
                content: { msgtype: "m.text", body: `message ${n}` },
            });
        for (let n = 0; n < 45; n++)
            room.getLiveTimeline().addEvent(message(n), {
                toStartOfTimeline: false,
                addToState: true,
            });
        // A state event in the timeline is not conversation and stays out.
        room.getLiveTimeline().addEvent(
            stateEvent("!chan", "m.room.topic", "", { topic: "later" }),
            { toStartOfTimeline: false, addToState: true },
        );

        const snap = JSON.parse(JSON.stringify(buildSnapshot(client)));
        expect(snap.rooms[0].timeline).toHaveLength(40);
        expect(snap.rooms[0].timeline.at(-1).event_id).toBe("$m44");

        const fresh = makeClient().client;
        const { rooms } = materializeSnapshot(fresh, snap);
        const bodies = rooms
            .get("!chan")!
            .getLiveTimeline()
            .getEvents()
            .map((e) => e.getContent().body);
        expect(bodies).toHaveLength(40);
        expect(bodies.at(0)).toBe("message 5");
        expect(bodies.at(-1)).toBe("message 44");
    });

    it("saves the tail's senders and indexes replayed events by id", () => {
        const { client, add } = makeClient();
        const room = add("!chan", [
            stateEvent("!chan", "m.room.create", "", {}),
            stateEvent("!chan", "m.room.member", ME, { membership: "join" }),
            stateEvent(
                "!chan",
                "m.room.member",
                BOB,
                {
                    membership: "join",
                    displayname: "Bob",
                    avatar_url: "mxc://x/y",
                },
                BOB,
            ),
            // Not in the tail: must not be saved.
            stateEvent(
                "!chan",
                "m.room.member",
                "@idle:example.org",
                { membership: "join", displayname: "Idle" },
                "@idle:example.org",
            ),
        ]);
        room.getLiveTimeline().addEvent(
            new MatrixEvent({
                type: EventType.RoomMessage,
                room_id: "!chan",
                sender: BOB,
                event_id: "$parent",
                origin_server_ts: 1000,
                content: { msgtype: "m.text", body: "hello" },
            }),
            { toStartOfTimeline: false, addToState: false },
        );

        const snap = JSON.parse(JSON.stringify(buildSnapshot(client)));
        const saved = snap.rooms[0].state
            .filter((e: { type: string }) => e.type === "m.room.member")
            .map((e: { state_key: string }) => e.state_key);
        expect(saved).toContain(BOB);
        expect(saved).not.toContain("@idle:example.org");

        const fresh = makeClient().client;
        const cached = materializeSnapshot(fresh, snap).rooms.get("!chan")!;
        expect(cached.getMember(BOB)?.name).toBe("Bob");
        expect(
            cached.getUnfilteredTimelineSet().findEventById("$parent"),
        ).toBeTruthy();
    });

    it("never caches a redacted message's plaintext", () => {
        const { client, add } = makeClient();
        const room = add("!chan", [
            stateEvent("!chan", "m.room.create", "", {}),
            stateEvent("!chan", "m.room.member", ME, { membership: "join" }),
        ]);
        const secret = new MatrixEvent({
            type: EventType.RoomMessage,
            room_id: "!chan",
            sender: BOB,
            event_id: "$secret",
            origin_server_ts: 1001,
            content: { msgtype: "m.text", body: "hunter2" },
        });
        room.getLiveTimeline().addEvent(secret, {
            toStartOfTimeline: false,
            addToState: false,
        });
        secret.makeRedacted(
            new MatrixEvent({
                type: "m.room.redaction",
                room_id: "!chan",
                sender: ME,
                event_id: "$redaction",
                origin_server_ts: 1002,
                redacts: "$secret",
                content: {},
            }),
            room,
        );

        const json = JSON.stringify(buildSnapshot(client));
        expect(json).not.toContain("hunter2");
        expect(json).not.toContain('"$secret"');
    });

    it("replays nothing that is known redacted", () => {
        const { client, add } = makeClient();
        const room = add("!chan", [
            stateEvent("!chan", "m.room.create", "", {}),
            stateEvent("!chan", "m.room.member", ME, { membership: "join" }),
        ]);
        const message = (id: string, body: string) =>
            new MatrixEvent({
                type: EventType.RoomMessage,
                room_id: "!chan",
                sender: BOB,
                event_id: id,
                origin_server_ts: 1001,
                content: { msgtype: "m.text", body },
            });
        for (const [id, body] of [
            ["$known", "known gone"],
            ["$target", "redacted by tail"],
            ["$kept", "kept"],
            ["$stub", "stub gone"],
        ] as const)
            room.getLiveTimeline().addEvent(message(id, body), {
                toStartOfTimeline: false,
                addToState: false,
            });

        const snap = JSON.parse(JSON.stringify(buildSnapshot(client)));
        // A redaction the tail holds removes its target, and a stub carrying
        // redacted_because is dropped whatever the record says.
        snap.rooms[0].timeline.push({
            type: "m.room.redaction",
            event_id: "$r",
            redacts: "$target",
            content: {},
        });
        snap.rooms[0].timeline.find(
            (e: { event_id: string }) => e.event_id === "$stub",
        ).unsigned = { redacted_because: { event_id: "$r" } };
        snap.redacted = ["$known"];

        const fresh = makeClient().client;
        const { rooms } = materializeSnapshot(fresh, snap);
        const bodies = rooms
            .get("!chan")!
            .getLiveTimeline()
            .getEvents()
            .map((e) => e.getContent().body)
            .filter(Boolean);
        expect(bodies).toEqual(["kept"]);
    });
});

describe("dropRedactedFromSnapshot", () => {
    const snap = (): RoomListSnapshot => ({
        v: 1,
        savedAt: 0,
        accountData: [],
        rooms: [
            {
                roomId: "!a",
                state: [],
                accountData: [],
                timeline: [
                    { event_id: "$1", type: "m.room.message" },
                    { event_id: "$2", type: "m.room.message" },
                ],
            },
            { roomId: "!b", state: [], accountData: [] },
        ],
    });

    it("removes the named events and leaves the rest", () => {
        const next = dropRedactedFromSnapshot(snap(), new Set(["$1"]));
        expect(next.rooms[0].timeline?.map((e) => e.event_id)).toEqual(["$2"]);
    });

    it("drops an emptied timeline entirely", () => {
        const next = dropRedactedFromSnapshot(snap(), new Set(["$1", "$2"]));
        expect(next.rooms[0].timeline).toBeUndefined();
    });

    it("returns the same snapshot when nothing it names is cached", () => {
        const before = snap();
        expect(dropRedactedFromSnapshot(before, new Set(["$9"]))).toBe(before);
    });
});
