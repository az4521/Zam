import {
    interfaceState,
    openModal,
    closeModal,
} from "$lib/stores/interface.svelte";

export const gameInviteDialogState = $state<{ roomId: string | null }>({
    roomId: null,
});

/** Open the game-invite dialog for a room (occupies the single modal slot). */
export function openGameInviteDialog(roomId: string): void {
    // Claim first — a same-id handover runs the outgoing close, which nulls roomId.
    openModal("game-invite", () => (gameInviteDialogState.roomId = null));
    gameInviteDialogState.roomId = roomId;
}

export function closeGameInviteDialog(): void {
    if (interfaceState.modal === "game-invite") closeModal();
}
