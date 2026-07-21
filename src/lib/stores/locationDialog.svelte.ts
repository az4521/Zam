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
    locationDialogState.roomId = roomId;
    openModal("share-location", () => (locationDialogState.roomId = null));
}

export function closeShareLocationDialog(): void {
    if (interfaceState.modal === "share-location") closeModal();
}
