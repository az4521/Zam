import {
    interfaceState,
    openModal,
    closeModal,
} from "$lib/stores/interface.svelte";
import type { AnchorRect } from "$lib/utils/profileCard";

// Which user the profile card is showing and where it should anchor. The card
// itself lives in MessageArea (it needs the room for power levels / mutual
// rooms); this store lets MemberList and MessageItem open it from anywhere.
class ProfileCardState {
    userId = $state<string | null>(null);
    anchor = $state<AnchorRect | null>(null);
}

export const profileCardState = new ProfileCardState();

/** Open the profile card for `userId`, anchored beside `anchorEl`. */
export function openProfileCard(userId: string, anchorEl: HTMLElement): void {
    const rect = anchorEl.getBoundingClientRect();
    profileCardState.userId = userId;
    profileCardState.anchor = {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
    };
    openModal("profile-card", () => {
        profileCardState.userId = null;
        profileCardState.anchor = null;
    });
}

export function closeProfileCard(): void {
    if (interfaceState.modal === "profile-card") closeModal();
}
