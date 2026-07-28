import {
    interfaceState,
    openModal,
    closeModal,
} from "$lib/stores/interface.svelte";

export const pollDialogState = $state<{ roomId: string | null }>({
    roomId: null,
});

/** Open the create-poll dialog for a room (occupies the single modal slot). */
export function openCreatePollDialog(roomId: string): void {
    // Claim first — a same-id handover runs the outgoing close, which nulls roomId.
    openModal("create-poll", () => (pollDialogState.roomId = null));
    pollDialogState.roomId = roomId;
}

export function closeCreatePollDialog(): void {
    if (interfaceState.modal === "create-poll") closeModal();
}
