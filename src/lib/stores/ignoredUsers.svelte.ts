import {
    getIgnoredUsers,
    setIgnoredUsers,
    onAccountData,
    onSyncPrepared,
} from "$lib/matrix/client";
import { addIgnoredUser, removeIgnoredUser } from "$lib/utils/ignoredUsers";

class IgnoredUsersState {
    userIds = $state<string[]>([]);
}

export const ignoredUsersState = new IgnoredUsersState();

export function isUserBlocked(userId: string): boolean {
    return ignoredUsersState.userIds.includes(userId);
}

/**
 * Adds `userId` to the account ignore list. The store is updated optimistically
 * (the SDK's local copy only changes once the server echoes the account data
 * back over sync) and reverted if the server rejects the change.
 */
export async function blockUser(userId: string): Promise<void> {
    const previous = ignoredUsersState.userIds;
    ignoredUsersState.userIds = addIgnoredUser(previous, userId);
    try {
        await setIgnoredUsers(ignoredUsersState.userIds);
    } catch (e) {
        ignoredUsersState.userIds = previous;
        throw e;
    }
}

/** Removes `userId` from the account ignore list (optimistic, reverts on error). */
export async function unblockUser(userId: string): Promise<void> {
    const previous = ignoredUsersState.userIds;
    ignoredUsersState.userIds = removeIgnoredUser(previous, userId);
    try {
        await setIgnoredUsers(ignoredUsersState.userIds);
    } catch (e) {
        ignoredUsersState.userIds = previous;
        throw e;
    }
}

// Call once on app mount. Returns a cleanup function.
export function initIgnoredUsers(): () => void {
    // Load immediately in case sync already completed before this was called
    ignoredUsersState.userIds = getIgnoredUsers();

    // Also reload on sync PREPARED in case we registered before the first sync
    // finished, and on account-data changes (covers edits from other devices).
    const unsubSync = onSyncPrepared(() => {
        ignoredUsersState.userIds = getIgnoredUsers();
    });
    const unsubAccount = onAccountData((type) => {
        if (type === "m.ignored_user_list") {
            ignoredUsersState.userIds = getIgnoredUsers();
        }
    });
    return () => {
        unsubSync();
        unsubAccount();
    };
}
