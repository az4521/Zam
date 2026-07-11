// Pure operations on the multi-account registry persisted under the
// "matrix_accounts" localStorage key. All functions are immutable: they
// return new objects and never touch storage — the accounts store owns I/O.

export interface StoredAccount {
    userId: string;
    accessToken: string;
    deviceId: string;
    homeserverUrl: string;
    /** Cached profile bits so the switcher can render inactive accounts. */
    displayName?: string;
    avatarUrl?: string;
}

export interface AccountRegistry {
    version: 1;
    activeUserId: string | null;
    accounts: StoredAccount[];
}

export function emptyRegistry(): AccountRegistry {
    return { version: 1, activeUserId: null, accounts: [] };
}

function isValidAccount(a: unknown): a is StoredAccount {
    if (typeof a !== "object" || a === null) return false;
    const o = a as Record<string, unknown>;
    return (
        typeof o.userId === "string" &&
        typeof o.accessToken === "string" &&
        typeof o.deviceId === "string" &&
        typeof o.homeserverUrl === "string"
    );
}

/** Corrupt JSON, wrong shape or unknown version → empty registry. */
export function parseRegistry(raw: string | null): AccountRegistry {
    if (!raw) return emptyRegistry();
    try {
        const data = JSON.parse(raw) as Partial<AccountRegistry>;
        if (data?.version !== 1 || !Array.isArray(data.accounts)) {
            return emptyRegistry();
        }
        const accounts = data.accounts.filter(isValidAccount);
        const activeUserId =
            typeof data.activeUserId === "string" &&
            accounts.some((a) => a.userId === data.activeUserId)
                ? data.activeUserId
                : null;
        return { version: 1, activeUserId, accounts };
    } catch {
        return emptyRegistry();
    }
}

/**
 * Wrap a legacy single-session "matrix_session" value into a registry with
 * that account active. Null when the legacy value is absent or unusable.
 */
export function migrateLegacySession(
    raw: string | null,
): AccountRegistry | null {
    if (!raw) return null;
    try {
        const legacy = JSON.parse(raw);
        if (!isValidAccount(legacy)) return null;
        return {
            version: 1,
            activeUserId: legacy.userId,
            accounts: [legacy],
        };
    } catch {
        return null;
    }
}

/**
 * Insert or replace (by userId). Cached profile fields survive an upsert
 * that omits them (a fresh login knows tokens, not the profile).
 */
export function upsertAccount(
    reg: AccountRegistry,
    account: StoredAccount,
): AccountRegistry {
    const existing = reg.accounts.find((a) => a.userId === account.userId);
    const merged: StoredAccount = {
        ...account,
        displayName: account.displayName ?? existing?.displayName,
        avatarUrl: account.avatarUrl ?? existing?.avatarUrl,
    };
    const accounts = existing
        ? reg.accounts.map((a) => (a.userId === account.userId ? merged : a))
        : [...reg.accounts, merged];
    return { ...reg, accounts };
}

/** No-op when the userId is not in the registry. */
export function setActive(
    reg: AccountRegistry,
    userId: string,
): AccountRegistry {
    if (!reg.accounts.some((a) => a.userId === userId)) return reg;
    return { ...reg, activeUserId: userId };
}

/**
 * Remove an account. When the removed account was active, the first
 * remaining account becomes active (voluntary sign-out switches to the
 * successor); expiry callers null the active id themselves afterwards.
 */
export function removeAccount(
    reg: AccountRegistry,
    userId: string,
): AccountRegistry {
    const accounts = reg.accounts.filter((a) => a.userId !== userId);
    const activeUserId =
        reg.activeUserId === userId
            ? (accounts[0]?.userId ?? null)
            : reg.activeUserId;
    return { version: 1, activeUserId, accounts };
}

export function getActive(reg: AccountRegistry): StoredAccount | null {
    return reg.accounts.find((a) => a.userId === reg.activeUserId) ?? null;
}
