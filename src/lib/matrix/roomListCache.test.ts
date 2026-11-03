import { describe, it, expect } from "vitest";
import { createClient, EventType, MatrixEvent, Room } from "matrix-js-sdk";
import { buildSnapshot, materializeSnapshot } from "./roomListCache";

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
});
