import {
    getActiveAccount,
    upsertAndActivate,
    removeAccountById,
    clearActiveAccount,
} from "$lib/stores/accounts.svelte";
import type { StoredAccount } from "$lib/utils/accounts";

const LAST_HOMESERVER_KEY = "matrix_last_homeserver";

interface StoredSession {
    userId: string;
    accessToken: string;
    deviceId: string;
    homeserverUrl: string;
}

export const auth = $state({
    isAuthenticated: false,
    userId: null as string | null,
    accessToken: null as string | null,
    deviceId: null as string | null,
    homeserverUrl: "",
    syncState: "STOPPED" as string,
    error: null as string | null,
});

function resetAuthState(): void {
    auth.isAuthenticated = false;
    auth.userId = null;
    auth.accessToken = null;
    auth.deviceId = null;
    auth.homeserverUrl = "";
    auth.syncState = "STOPPED";
    auth.error = null;
}

/** Upserts into the account registry, activates, and marks us signed in. */
export function saveSession(data: StoredSession): void {
    auth.isAuthenticated = true;
    auth.userId = data.userId;
    auth.accessToken = data.accessToken;
    auth.deviceId = data.deviceId;
    auth.homeserverUrl = data.homeserverUrl;
    auth.error = null;

    upsertAndActivate(data);
    try {
        localStorage.setItem(LAST_HOMESERVER_KEY, data.homeserverUrl);
    } catch {
        // ignore storage errors
    }
}

/** The active account from the registry (what session-restore boots). */
export function loadStoredSession(): StoredSession | null {
    return getActiveAccount();
}

/**
 * Voluntary sign-out of the active account. The registry activates the
 * successor account (if any) so the next visit to "/" restores it.
 */
export function clearSession(): void {
    const active: StoredAccount | null = getActiveAccount();
    if (active) removeAccountById(active.userId);
    resetAuthState();
}

/**
 * Session-expiry teardown: drop the dead account but activate NOTHING —
 * expiry must never silently switch accounts. The login page offers the
 * survivors via its "continue as" list.
 */
export function expireActiveSession(): void {
    const active: StoredAccount | null = getActiveAccount();
    if (active) removeAccountById(active.userId);
    clearActiveAccount();
    resetAuthState();
}

/** Last homeserver a login/registration succeeded against on this device. */
export function loadLastHomeserver(): string | null {
    try {
        return localStorage.getItem(LAST_HOMESERVER_KEY);
    } catch {
        return null;
    }
}
