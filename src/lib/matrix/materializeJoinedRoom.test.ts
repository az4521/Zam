import { describe, it, expect, vi } from "vitest";
import { ClientEvent, createClient, MatrixEvent, Room } from "matrix-js-sdk";
import { materializeJoinedRoom } from "./materializeJoinedRoom";

const ME = "@me:example.org";
const ROOM = "!room:example.org";

function makeClient() {
    const client = createClient({
        baseUrl: "https://example.org",
        userId: ME,
        deviceId: "DEV",
    });
    // What the SDK's joinRoom hands back for a room it doesn't hold: a fresh
    // Room from SyncApi.createRoom that is NOT in the store.
    const joinRoom = vi
        .spyOn(client, "joinRoom")
        .mockImplementation(async () => new Room(ROOM, client, ME));
    const emitted: string[] = [];
    client.on(ClientEvent.Room, () => emitted.push("room"));
    client.on(ClientEvent.DeleteRoom, () => emitted.push("delete"));
    return { client, joinRoom, emitted };
}

function seedInto(client: ReturnType<typeof createClient>) {
    return vi.fn(async (roomId: string) => {
        const room = client.getRoom(roomId);
        if (!room) return false;
        room.getLiveTimeline().initialiseState([
            new MatrixEvent({
                type: "m.room.create",
                state_key: "",
                content: {},
                room_id: roomId,
                sender: ME,
                event_id: "$create",
            }),
        ]);
        return true;
    });
}

describe("materializeJoinedRoom", () => {
    it("stores the Room joinRoom returns, so getRoom() finds it", async () => {
        const { client, joinRoom, emitted } = makeClient();
        const seedState = seedInto(client);

        const ok = await materializeJoinedRoom(client, ROOM, {
            isCurrent: () => true,
            seedState,
        });

        expect(ok).toBe(true);
        expect(joinRoom).toHaveBeenCalledOnce();
        expect(seedState).toHaveBeenCalledWith(ROOM);
        expect(client.getRoom(ROOM)?.getMyMembership()).toBe("join");
        expect(emitted).toEqual(["room"]);
    });

    it("takes the seed lock before announcing the room", async () => {
        const { client } = makeClient();
        const order: string[] = [];
        client.on(ClientEvent.Room, () => order.push("announced"));
        await materializeJoinedRoom(client, ROOM, {
            isCurrent: () => true,
            seedState: async () => {
                order.push("seed");
                return true;
            },
        });
        expect(order).toEqual(["seed", "announced"]);
    });

    it("removes the room again when its state can't be fetched", async () => {
        const { client, emitted } = makeClient();
        const ok = await materializeJoinedRoom(client, ROOM, {
            isCurrent: () => true,
            seedState: async () => false,
        });
        expect(ok).toBe(false);
        expect(client.getRoom(ROOM)).toBeNull();
        expect(emitted).toEqual(["room", "delete"]);
    });

    it("treats a rejected seed like a failed one", async () => {
        const { client } = makeClient();
        const ok = await materializeJoinedRoom(client, ROOM, {
            isCurrent: () => true,
            seedState: () => Promise.reject(new Error("boom")),
        });
        expect(ok).toBe(false);
        expect(client.getRoom(ROOM)).toBeNull();
    });

    it("gives up without storing anything when /join fails", async () => {
        const { client, joinRoom, emitted } = makeClient();
        joinRoom.mockRejectedValueOnce(new Error("M_FORBIDDEN"));
        const seedState = vi.fn(async () => true);
        const ok = await materializeJoinedRoom(client, ROOM, {
            isCurrent: () => true,
            seedState,
        });
        expect(ok).toBe(false);
        expect(seedState).not.toHaveBeenCalled();
        expect(client.getRoom(ROOM)).toBeNull();
        expect(emitted).toEqual([]);
    });

    it("abandons the heal when a successor client took over", async () => {
        const { client } = makeClient();
        const seedState = vi.fn(async () => true);
        const ok = await materializeJoinedRoom(client, ROOM, {
            isCurrent: () => false,
            seedState,
        });
        expect(ok).toBe(false);
        expect(seedState).not.toHaveBeenCalled();
        expect(client.getRoom(ROOM)).toBeNull();
    });

    it("uses the synced Room if sync delivered it during /join", async () => {
        const { client, joinRoom } = makeClient();
        const synced = new Room(ROOM, client, ME);
        joinRoom.mockImplementationOnce(async () => {
            synced.updateMyMembership("join");
            client.store.storeRoom(synced);
            return new Room(ROOM, client, ME);
        });
        const seedState = vi.fn(async () => true);
        const ok = await materializeJoinedRoom(client, ROOM, {
            isCurrent: () => true,
            seedState,
        });
        expect(ok).toBe(true);
        expect(client.getRoom(ROOM)).toBe(synced);
        expect(seedState).not.toHaveBeenCalled();
    });

    it("fixes a stale membership in place without re-joining", async () => {
        const { client, joinRoom, emitted } = makeClient();
        const room = new Room(ROOM, client, ME);
        room.updateMyMembership("leave");
        client.store.storeRoom(room);
        const seedState = vi.fn(async () => true);

        const ok = await materializeJoinedRoom(client, ROOM, {
            isCurrent: () => true,
            seedState,
        });

        expect(ok).toBe(true);
        expect(joinRoom).not.toHaveBeenCalled();
        expect(seedState).toHaveBeenCalledWith(ROOM);
        expect(client.getRoom(ROOM)).toBe(room);
        expect(room.getMyMembership()).toBe("join");
        expect(emitted).toEqual([]);
    });

    it("keeps an existing room even if refreshing its state fails", async () => {
        const { client } = makeClient();
        const room = new Room(ROOM, client, ME);
        room.updateMyMembership("invite");
        client.store.storeRoom(room);
        const ok = await materializeJoinedRoom(client, ROOM, {
            isCurrent: () => true,
            seedState: async () => false,
        });
        expect(ok).toBe(true);
        expect(client.getRoom(ROOM)).toBe(room);
    });

    it("is a no-op for a room already joined", async () => {
        const { client, joinRoom } = makeClient();
        const room = new Room(ROOM, client, ME);
        room.updateMyMembership("join");
        client.store.storeRoom(room);
        const seedState = vi.fn(async () => true);
        expect(
            await materializeJoinedRoom(client, ROOM, {
                isCurrent: () => true,
                seedState,
            }),
        ).toBe(true);
        expect(joinRoom).not.toHaveBeenCalled();
        expect(seedState).not.toHaveBeenCalled();
    });
});
