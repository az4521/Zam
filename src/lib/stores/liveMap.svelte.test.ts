import { describe, it, expect, beforeEach } from "vitest";
import { interfaceState, openModal, closeModal } from "./interface.svelte";
import {
    liveMapState,
    openLiveLocationMap,
    closeLiveLocationMap,
} from "./liveMap.svelte";

const ROOM = "!room:server";

// The interface store is module-level and shared across tests — reset both
// slots so each test starts from a closed app.
beforeEach(() => {
    interfaceState.modal = null;
    interfaceState.modalClose = null;
    liveMapState.roomId = null;
});

describe("liveMap store", () => {
    it("starts closed", () => {
        expect(liveMapState.roomId).toBeNull();
        expect(interfaceState.modal).toBeNull();
    });

    it("claims the shared modal slot and records the room", () => {
        openLiveLocationMap(ROOM);
        expect(interfaceState.modal).toBe("live-location-map");
        expect(liveMapState.roomId).toBe(ROOM);
    });

    // THE REGRESSION THIS ITEM EXISTS FOR: AppShell's Escape / mobile-back
    // handler calls closeModal() via dismissTopmost(). Before this change the
    // map owned a private window keydown handler, so the central stack could
    // not see or dismiss it.
    it("is dismissed by the central closeModal() that Escape and back use", () => {
        openLiveLocationMap(ROOM);
        closeModal();
        expect(interfaceState.modal).toBeNull();
        expect(liveMapState.roomId).toBeNull();
    });

    it("closeLiveLocationMap() releases the slot", () => {
        openLiveLocationMap(ROOM);
        closeLiveLocationMap();
        expect(interfaceState.modal).toBeNull();
        expect(liveMapState.roomId).toBeNull();
    });

    it("closeLiveLocationMap() is a no-op when another modal owns the slot", () => {
        let otherClosed = 0;
        openModal("profile-card", () => otherClosed++);
        closeLiveLocationMap();
        expect(interfaceState.modal).toBe("profile-card");
        expect(otherClosed).toBe(0);
    });

    it("clears its room when another modal supersedes it", () => {
        openLiveLocationMap(ROOM);
        openModal("profile-card", () => {});
        expect(interfaceState.modal).toBe("profile-card");
        expect(liveMapState.roomId).toBeNull();
    });

    it("re-opening for a different room retargets without stranding the slot", () => {
        openLiveLocationMap(ROOM);
        openLiveLocationMap("!other:server");
        expect(interfaceState.modal).toBe("live-location-map");
        expect(liveMapState.roomId).toBe("!other:server");
    });
});
