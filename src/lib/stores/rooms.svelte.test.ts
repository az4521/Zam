import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the SDK boundary so we can hand the store rooms that are loaded,
// missing, or present-but-state-less (the federated stub continuwuity leaves
// behind). The deferred-surface state machine itself stays real — that is what
// these tests exercise.
const h = vi.hoisted(() => {
    interface FakeRoom {
        roomId: string;
        /** What `isVideoRoom` answers — i.e. what `getType()` reads as. */
        videoRoom: boolean;
        /** Whether `m.room.create` has arrived, so the type can be trusted. */
        typeKnown: boolean;
    }
    const rooms = new Map<string, FakeRoom>();
    return {
        rooms,
        findSpaceForRoom: vi.fn<(roomId: string) => string | null>(() => null),
        getRoom: vi.fn<(roomId: string) => FakeRoom | null>(
            (id) => rooms.get(id) ?? null,
        ),
        isVideoRoom: vi.fn<(room: FakeRoom) => boolean>((r) => r.videoRoom),
        roomTypeIsKnown: vi.fn<(room: FakeRoom) => boolean>((r) => r.typeKnown),
        markRoomPendingArrival: vi.fn<(roomId: string) => void>(),
    };
});

vi.mock("$lib/matrix/client", () => ({
    findSpaceForRoom: h.findSpaceForRoom,
    getRoom: h.getRoom,
    isVideoRoom: h.isVideoRoom,
    roomTypeIsKnown: h.roomTypeIsKnown,
    markRoomPendingArrival: h.markRoomPendingArrival,
}));

vi.mock("$lib/stores/settings.svelte", () => ({
    settingsState: { keepSidebarOpen: false },
}));

vi.mock("$lib/stores/auth.svelte", () => ({
    auth: { userId: "@me:server" },
}));

import { interfaceState } from "./interface.svelte";
import {
    roomsState,
    setActiveRoom,
    resolvePendingSurface,
    reloadLastLocationFromStorage,
} from "./rooms.svelte";

const VIDEO = "!video:remote";
const CHAT = "!chat:server";
const SCRATCH = "!scratch:server";

/** A room whose `m.room.create` is present, so its type is trustworthy. */
function loadRoom(roomId: string, videoRoom = false): void {
    h.rooms.set(roomId, { roomId, videoRoom, typeKnown: true });
}

/**
 * The federated stub: `getRoom` returns it, but with no `m.room.create` its
 * type reads as "not a video room" — a lie that only `roomTypeIsKnown` exposes.
 */
function loadStub(roomId: string): void {
    h.rooms.set(roomId, { roomId, videoRoom: false, typeKnown: false });
}

/** What `seedRoomStateIfMissing` does later: the real type shows up. */
function healStub(roomId: string, videoRoom = true): void {
    loadRoom(roomId, videoRoom);
}

beforeEach(() => {
    localStorage.clear();
    h.rooms.clear();
    h.findSpaceForRoom.mockImplementation(() => null);
    h.getRoom.mockImplementation((id) => h.rooms.get(id) ?? null);
    h.isVideoRoom.mockImplementation((r) => r.videoRoom);
    h.roomTypeIsKnown.mockImplementation((r) => r.typeKnown);
    // The store is a module singleton, and the deferred slot is private: park
    // on a loaded ordinary room to clear any deferral the last test armed.
    loadRoom(SCRATCH);
    setActiveRoom(SCRATCH);
    h.rooms.clear();
    localStorage.clear();
    interfaceState.callViewRoomId = null;
    h.markRoomPendingArrival.mockClear();
});

describe("rooms store: surface choice on navigation", () => {
    it("lands a loaded video room on the call surface", () => {
        loadRoom(VIDEO, true);

        setActiveRoom(VIDEO);

        expect(interfaceState.callViewRoomId).toBe(VIDEO);
    });

    it("lands a loaded ordinary room on its timeline", () => {
        loadRoom(CHAT);

        setActiveRoom(CHAT);

        expect(interfaceState.callViewRoomId).toBeNull();
    });

    it("drops the call surface when leaving a video room for an ordinary one", () => {
        loadRoom(VIDEO, true);
        loadRoom(CHAT);
        setActiveRoom(VIDEO);

        setActiveRoom(CHAT);

        expect(interfaceState.callViewRoomId).toBeNull();
    });
});

describe("rooms store: pending-arrival marking", () => {
    it("marks a room navigated to, so a room not yet in the store stays landable", () => {
        // The create/join wrappers all resolve before the room reaches the
        // client store and then call setActiveRoom — the funnel must claim it.
        setActiveRoom(CHAT);

        expect(h.markRoomPendingArrival).toHaveBeenCalledWith(CHAT);
    });

    it("does NOT mark the boot-restored room", () => {
        // D2: a stale cached id must still be free to fall through the landing
        // chain, which marking it here would defeat.
        localStorage.setItem(
            "matrix_last_room_by_space:@me:server",
            JSON.stringify({ __home__: CHAT }),
        );

        reloadLastLocationFromStorage();

        expect(roomsState.activeRoomId).toBe(CHAT);
        expect(h.markRoomPendingArrival).not.toHaveBeenCalled();
    });
});

describe("rooms store: deferred surface choice", () => {
    it("defers an unloaded room, then settles it once the room exists", () => {
        // Boot order: the shell mounts before the first sync builds any Room.
        setActiveRoom(VIDEO);
        expect(interfaceState.callViewRoomId).toBeNull();

        loadRoom(VIDEO, true);
        resolvePendingSurface();

        expect(interfaceState.callViewRoomId).toBe(VIDEO);
    });

    it("defers a state-less stub whose type cannot be trusted yet", () => {
        // Federated room omitted from /sync: getRoom() is non-null but the
        // type reads as ordinary. Committing here is the bug this pins.
        loadStub(VIDEO);

        setActiveRoom(VIDEO);
        expect(interfaceState.callViewRoomId).toBeNull();

        healStub(VIDEO);
        resolvePendingSurface();

        expect(interfaceState.callViewRoomId).toBe(VIDEO);
    });

    it("keeps waiting while the room is still unresolvable, without consuming the deferral", () => {
        setActiveRoom(VIDEO);

        resolvePendingSurface(); // nothing loaded at all
        expect(interfaceState.callViewRoomId).toBeNull();

        loadStub(VIDEO);
        resolvePendingSurface(); // loaded, but the type is still a guess
        expect(interfaceState.callViewRoomId).toBeNull();

        // Still armed after two fruitless passes, so the heal still lands.
        healStub(VIDEO);
        resolvePendingSurface();
        expect(interfaceState.callViewRoomId).toBe(VIDEO);
    });

    it("never yanks a user who navigated away into the call view", () => {
        setActiveRoom(VIDEO); // unloaded → deferred
        loadRoom(CHAT);
        setActiveRoom(CHAT);

        healStub(VIDEO);
        resolvePendingSurface();

        expect(interfaceState.callViewRoomId).toBeNull();
    });

    it("drops a deferral abandoned by clearing the active room outright", () => {
        // RoomList clears activeRoomId directly for the inbox and for leaving
        // a room — no setActiveRoom, so only resolvePendingSurface's own guard
        // stands between a healed video room and a call view over the inbox.
        setActiveRoom(VIDEO); // unloaded → deferred
        roomsState.activeRoomId = null;

        healStub(VIDEO);
        resolvePendingSurface();
        expect(interfaceState.callViewRoomId).toBeNull();

        // Consumed, not merely blocked: landing back on that room without a
        // fresh navigation must still resolve nothing.
        roomsState.activeRoomId = VIDEO;
        resolvePendingSurface();
        expect(interfaceState.callViewRoomId).toBeNull();
    });

    it("defers the boot-restored room and settles it when sync heals it", () => {
        localStorage.setItem(
            "matrix_last_room_by_space:@me:server",
            JSON.stringify({ __home__: VIDEO }),
        );

        reloadLastLocationFromStorage(); // no Room objects exist yet
        expect(roomsState.activeRoomId).toBe(VIDEO);
        expect(interfaceState.callViewRoomId).toBeNull();

        loadStub(VIDEO); // sync produces the stub…
        resolvePendingSurface();
        expect(interfaceState.callViewRoomId).toBeNull();

        healStub(VIDEO); // …then seedRoomStateIfMissing fills the state in
        resolvePendingSurface();
        expect(interfaceState.callViewRoomId).toBe(VIDEO);
    });
});
