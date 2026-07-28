import {
    interfaceState,
    openModal,
    closeModal,
} from "$lib/stores/interface.svelte";

export const locationDialogState = $state<{ roomId: string | null }>({
    roomId: null,
});

/** Open the share-location dialog for a room (occupies the single modal slot). */
export function openShareLocationDialog(roomId: string): void {
    // Claim first — a same-id handover runs the outgoing close, which nulls roomId.
    openModal("share-location", () => (locationDialogState.roomId = null));
    locationDialogState.roomId = roomId;
}

export function closeShareLocationDialog(): void {
    if (interfaceState.modal === "share-location") closeModal();
}
