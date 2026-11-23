import { t } from "$lib/i18n";
import {
    getInviteBlockingSupport,
    getInvitesBlocked,
    onAccountData,
    onSyncPrepared,
    setInvitesBlocked,
    setShowBlockedInvites,
} from "$lib/matrix/client";
import { isInviteBlockingAccountType } from "$lib/utils/inviteBlocking";
import type { InviteBlockingSupport } from "$lib/utils/inviteBlocking";
import { showErrorToast } from "$lib/stores/toasts.svelte";

class InviteBlockingState {
    /** What the server does with the setting (see getInviteBlockingSupport). */
    support = $state<InviteBlockingSupport>("none");
    /** The block as the UI shows it; an optimistic toggle moves it first. */
    blocked = $state(false);
    /** Pending invites shown anyway while blocked (this session only). */
    showAnyway = $state(false);
}

export const inviteBlockingState = new InviteBlockingState();

/** Rebuilds the invite lists after the block or "show anyway" changes. Set by
 *  initInviteBlocking; AppShell passes its refreshRooms. */
let onChangeHook: (() => void) | null = null;

function notifyChanged(): void {
    onChangeHook?.();
}

async function refreshSupport(): Promise<void> {
    try {
        inviteBlockingState.support = await getInviteBlockingSupport();
    } catch {
        inviteBlockingState.support = "none";
    }
}

/**
 * Turn the invite block on or off. Optimistic: the UI and the invite lists
 * move at once, then roll back with an error toast if the server refuses.
 */
export async function setInvitesBlockedOptimistic(
    blocked: boolean,
): Promise<void> {
    const previous = inviteBlockingState.blocked;
    inviteBlockingState.blocked = blocked;
    notifyChanged();
    try {
        await setInvitesBlocked(blocked);
    } catch (e) {
        console.error("Failed to change invite blocking", e);
        inviteBlockingState.blocked = previous;
        notifyChanged();
        showErrorToast(t("inviteBlocking.couldNotSave"));
    }
}

/** Show or hide the pending invites while blocked (inbox "Show anyway"). */
export function setShowAnyway(show: boolean): void {
    inviteBlockingState.showAnyway = show;
    setShowBlockedInvites(show);
    notifyChanged();
}

/**
 * Start tracking the block. `onChange` runs whenever the invite lists may have
 * changed. Returns a cleanup function.
 */
export function initInviteBlocking(onChange: () => void): () => void {
    onChangeHook = onChange;
    setShowBlockedInvites(false);
    inviteBlockingState.showAnyway = false;
    const load = () => {
        inviteBlockingState.blocked = getInvitesBlocked();
    };
    load();
    void refreshSupport();
    // Account data can arrive before the first sync finishes; reload then too.
    const unsubSync = onSyncPrepared(() => {
        load();
        void refreshSupport();
        notifyChanged();
    });
    // Covers both the echo of our own write and edits from other devices.
    const unsubAccount = onAccountData((type) => {
        if (!isInviteBlockingAccountType(type)) return;
        load();
        void refreshSupport();
        notifyChanged();
    });
    return () => {
        unsubSync();
        unsubAccount();
        onChangeHook = null;
    };
}
