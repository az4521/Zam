import {
    interfaceState,
    openModal,
    closeModal,
} from "$lib/stores/interface.svelte";

export const inviteDialogState = $state<{ roomId: string | null }>({
    roomId: null,
});

/** Open the invite dialog for a room/space (occupies the single modal slot). */
export function openInviteDialog(roomId: string): void {
    inviteDialogState.roomId = roomId;
    openModal("invite", () => (inviteDialogState.roomId = null));
}

export function closeInviteDialog(): void {
    if (interfaceState.modal === "invite") closeModal();
}
