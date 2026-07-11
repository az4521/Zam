// Multi-account registry store. Persists to localStorage["matrix_accounts"];
// pure semantics live in $lib/utils/accounts. On first load a legacy
// single-session "matrix_session" value is migrated in and deleted.

import {
    emptyRegistry,
    parseRegistry,
    migrateLegacySession,
    upsertAccount,
    setActive,
    removeAccount,
    getActive,
    type AccountRegistry,
    type StoredAccount,
} from "$lib/utils/accounts";

const REGISTRY_KEY = "matrix_accounts";
const LEGACY_KEY = "matrix_session";

function loadRegistry(): AccountRegistry {
    try {
        const raw = localStorage.getItem(REGISTRY_KEY);
        if (raw !== null) return parseRegistry(raw);
        const migrated = migrateLegacySession(localStorage.getItem(LEGACY_KEY));
        if (migrated) {
            localStorage.setItem(REGISTRY_KEY, JSON.stringify(migrated));
            localStorage.removeItem(LEGACY_KEY);
            return migrated;
        }
        return emptyRegistry();
    } catch {
        return emptyRegistry();
    }
}

export const accountsState = $state({ registry: loadRegistry() });

function persist(): void {
    try {
        localStorage.setItem(
            REGISTRY_KEY,
            JSON.stringify(accountsState.registry),
        );
    } catch {
        // ignore (private mode / storage full)
    }
}

export function upsertAndActivate(account: StoredAccount): void {
    accountsState.registry = setActive(
        upsertAccount(accountsState.registry, account),
        account.userId,
    );
    persist();
}

export function switchActive(userId: string): void {
    accountsState.registry = setActive(accountsState.registry, userId);
    persist();
}

/** Remove an account; when it was active, the successor becomes active. */
export function removeAccountById(userId: string): void {
    accountsState.registry = removeAccount(accountsState.registry, userId);
    persist();
}

/** Expiry path: keep the surviving accounts but activate none of them. */
export function clearActiveAccount(): void {
    accountsState.registry = {
        ...accountsState.registry,
        activeUserId: null,
    };
    persist();
}

export function getActiveAccount(): StoredAccount | null {
    return getActive(accountsState.registry);
}

/** Refresh the cached switcher-row profile of an account. */
export function updateAccountProfile(
    userId: string,
    profile: { displayName: string | null; avatarUrl: string | null },
): void {
    const existing = accountsState.registry.accounts.find(
        (a) => a.userId === userId,
    );
    if (!existing) return;
    accountsState.registry = upsertAccount(accountsState.registry, {
        ...existing,
        displayName: profile.displayName ?? undefined,
        avatarUrl: profile.avatarUrl ?? undefined,
    });
    persist();
}
