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
    // Claim first — a same-id handover runs the outgoing close, which nulls roomId.
    openModal("invite", () => (inviteDialogState.roomId = null));
    inviteDialogState.roomId = roomId;
}

export function closeInviteDialog(): void {
    if (interfaceState.modal === "invite") closeModal();
}
