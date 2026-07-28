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
    // Measure before claiming: the outgoing owner's close can unmount the
    // element we are anchoring to, which would zero the rect.
    const rect = anchorEl.getBoundingClientRect();
    openModal("profile-card", () => {
        profileCardState.userId = null;
        profileCardState.anchor = null;
    });
    profileCardState.userId = userId;
    profileCardState.anchor = {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
    };
}

export function closeProfileCard(): void {
    if (interfaceState.modal === "profile-card") closeModal();
}
