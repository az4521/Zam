import {
    interfaceState,
    openModal,
    closeModal,
} from "$lib/stores/interface.svelte";

/** Room whose fullscreen live-location map is open, or null. */
export const liveMapState = $state<{ roomId: string | null }>({
    roomId: null,
});

/**
 * Open the fullscreen live-location map for a room. It occupies the single
 * modal slot, so Escape and the mobile back button dismiss it through
 * AppShell's central `dismissTopmost()` instead of a private key handler.
 */
export function openLiveLocationMap(roomId: string): void {
    liveMapState.roomId = roomId;
    openModal("live-location-map", () => (liveMapState.roomId = null));
}

/**
 * Close the map if it still owns the slot. Safe to call unconditionally from a
 * teardown path — a no-op once another modal has superseded it (that handover
 * already ran our close via `openModal`).
 *
 * This is the ONLY correct way to dismiss the map: never use
 * `clearModal("live-location-map")`, which drops the slot without running the
 * close handler and strands `liveMapState.roomId` non-null against an empty slot.
 */
export function closeLiveLocationMap(): void {
    if (interfaceState.modal === "live-location-map") closeModal();
}
