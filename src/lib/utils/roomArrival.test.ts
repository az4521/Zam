import { describe, it, expect } from "vitest";
import { waitForRoomArrival } from "./roomArrival";

const ROOM_ID = "!new:example.org";

/** Opaque stand-in for an SDK Room — the util never looks inside it. */
const room = { tag: "room" };
const otherRoom = { tag: "other" };

describe("waitForRoomArrival", () => {
    it("is already settled when the room is in the store", async () => {
        const handle = waitForRoomArrival(ROOM_ID, room);

        expect(handle.settled()).toBe(true);
        await expect(handle.result).resolves.toBe(room);
    });

    it("stays pending until the room arrives", async () => {
        const handle = waitForRoomArrival<typeof room>(ROOM_ID, null);
        expect(handle.settled()).toBe(false);

        handle.onRoomArrived(ROOM_ID, room);

        expect(handle.settled()).toBe(true);
        await expect(handle.result).resolves.toBe(room);
    });

    it("ignores a different room arriving", async () => {
        const handle = waitForRoomArrival<typeof room>(ROOM_ID, null);

        handle.onRoomArrived("!somewhere-else:example.org", otherRoom);

        expect(handle.settled()).toBe(false);
        handle.onRoomArrived(ROOM_ID, room);
        await expect(handle.result).resolves.toBe(room);
    });

    it("resolves null on timeout so the caller can carry on", async () => {
        const handle = waitForRoomArrival<typeof room>(ROOM_ID, null);

        handle.onTimeout();

        expect(handle.settled()).toBe(true);
        await expect(handle.result).resolves.toBeNull();
    });

    // The caller detaches its ClientEvent.Room listener in a finally block, so
    // the emitter can still deliver one event after the timeout won.
    it("keeps the timed-out result when the room arrives late", async () => {
        const handle = waitForRoomArrival<typeof room>(ROOM_ID, null);
        handle.onTimeout();

        handle.onRoomArrived(ROOM_ID, room);

        await expect(handle.result).resolves.toBeNull();
    });

    it("keeps the first room when a second arrival fires", async () => {
        const handle = waitForRoomArrival<typeof room>(ROOM_ID, null);
        handle.onRoomArrived(ROOM_ID, room);

        handle.onRoomArrived(ROOM_ID, otherRoom);

        await expect(handle.result).resolves.toBe(room);
    });

    it("ignores a timeout that fires after the room arrived", async () => {
        const handle = waitForRoomArrival<typeof room>(ROOM_ID, null);
        handle.onRoomArrived(ROOM_ID, room);

        handle.onTimeout();

        await expect(handle.result).resolves.toBe(room);
    });

    it("does not treat a null existing room as an arrival", () => {
        const handle = waitForRoomArrival<typeof room>(ROOM_ID, null);
        expect(handle.settled()).toBe(false);
    });
});
