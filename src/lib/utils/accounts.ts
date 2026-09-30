// Pure operations on the multi-account registry persisted under the
// "matrix_accounts" localStorage key. All functions are immutable: they
// return new objects and never touch storage — the accounts store owns I/O.

/**
 * What a native OAuth 2.0 / OIDC session needs beyond its access token: the
 * client id this app registered under and the issuer that registered it.
 * Absent on password and legacy-SSO sessions.
 */
export interface OAuthSessionInfo {
    clientId: string;
    issuer: string;
}

export interface StoredAccount {
    userId: string;
    accessToken: string;
    deviceId: string;
    homeserverUrl: string;
    /** OAuth sessions only: rotates on every refresh, so it is always written back. */
    refreshToken?: string;
    oauth?: OAuthSessionInfo;
    /** Epoch ms the access token stops working (OAuth sessions, when known). */
    accessTokenExpiresAt?: number;
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

export function isOAuthSessionInfo(o: unknown): o is OAuthSessionInfo {
    if (typeof o !== "object" || o === null) return false;
    const v = o as Record<string, unknown>;
    return (
        typeof v.clientId === "string" &&
        v.clientId.length > 0 &&
        typeof v.issuer === "string" &&
        v.issuer.length > 0
    );
}

/**
 * Drop malformed OAuth fields rather than the whole account: a bad `oauth`
 * block must not sign the user out of a session whose access token still
 * works, and a refresh token without its client id is unusable anyway.
 */
function sanitizeOAuthFields(a: StoredAccount): StoredAccount {
    const { refreshToken, oauth, accessTokenExpiresAt, ...rest } = a;
    if (!isOAuthSessionInfo(oauth)) return rest;
    const out: StoredAccount = { ...rest, oauth };
    if (typeof refreshToken === "string" && refreshToken)
        out.refreshToken = refreshToken;
    if (
        typeof accessTokenExpiresAt === "number" &&
        Number.isFinite(accessTokenExpiresAt)
    )
        out.accessTokenExpiresAt = accessTokenExpiresAt;
    return out;
}

/** Corrupt JSON, wrong shape or unknown version → empty registry. */
export function parseRegistry(raw: string | null): AccountRegistry {
    if (!raw) return emptyRegistry();
    try {
        const data = JSON.parse(raw) as Partial<AccountRegistry>;
        if (data?.version !== 1 || !Array.isArray(data.accounts)) {
            return emptyRegistry();
        }
        const accounts = data.accounts
            .filter(isValidAccount)
            .map(sanitizeOAuthFields);
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

/**
 * Write a refreshed token pair back onto an account. The refresh token
 * ROTATES, so a refresh whose result is not stored strands the session on
 * its next restart. No-op when the account is gone (signed out mid-refresh).
 */
export function updateAccountTokens(
    reg: AccountRegistry,
    userId: string,
    tokens: {
        accessToken: string;
        refreshToken?: string;
        expiresAt?: number;
    },
): AccountRegistry {
    const existing = reg.accounts.find((a) => a.userId === userId);
    if (!existing) return reg;
    const next: StoredAccount = {
        ...existing,
        accessToken: tokens.accessToken,
        // A response without a new refresh token means "keep using the old one".
        refreshToken: tokens.refreshToken ?? existing.refreshToken,
        accessTokenExpiresAt: tokens.expiresAt,
    };
    if (next.refreshToken === undefined) delete next.refreshToken;
    if (next.accessTokenExpiresAt === undefined)
        delete next.accessTokenExpiresAt;
    return {
        ...reg,
        accounts: reg.accounts.map((a) => (a.userId === userId ? next : a)),
    };
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
