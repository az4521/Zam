// Refreshing an OAuth access token with NO app page running.
//
// OAuth providers (matrix.org's MAS among them) hand out access tokens that
// stop working after a few minutes. The running app refreshes them (the SDK,
// see createAuthenticatedClient in client.ts) and re-mirrors each new one to
// the native push service. Once the app is closed nobody does, so every push
// after that met a dead token: every request the push service made failed
// with 401, and every notification fell back to the generic text.
//
// The refresh token ROTATES: the old one dies on use. So exactly one party
// may refresh at a time, and the result must land in the registry the app
// reads, or the app's next refresh uses a dead token and signs the user out.
// This runs in the hidden push WebView (pushDecryptHeadless.ts) only while it
// holds APP_PAGE_LOCK exclusively. Every app page holds that lock shared for
// its whole life (appPageLock.ts) and re-reads the registry once it has it,
// so a page booting meanwhile waits for the refresh and then sees its result.
//
// Pure apart from the injected fetch: storage I/O stays with the caller.

import {
    parseRegistry,
    updateAccountTokens,
    type StoredAccount,
} from "./accounts";

/**
 * Held shared by every app page (appPageLock.ts), exclusively by the
 * headless refresh. The two never overlap.
 */
export const APP_PAGE_LOCK = "zam-app-page";

/** The registry's localStorage key; mirrors REGISTRY_KEY in accounts.svelte.ts. */
export const REGISTRY_STORAGE_KEY = "matrix_accounts";

/**
 * A stored token with at least this long left is used as is: the app
 * refreshed since the native mirror was last written.
 */
export const STILL_VALID_MARGIN_MS = 60_000;

export type HeadlessRefreshOutcome =
    | {
          ok: true;
          accessToken: string;
          /** Epoch ms the access token stops working, when known. */
          expiresAt?: number;
          /** The registry to store; null when nothing changed. */
          registryRaw: string | null;
      }
    | { ok: false; reason: string };

interface AuthMetadata {
    issuer?: unknown;
    token_endpoint?: unknown;
}

function sameIssuer(a: string, b: string): boolean {
    return a.replace(/\/+$/, "") === b.replace(/\/+$/, "");
}

/**
 * The provider's token endpoint, only when the homeserver's metadata names
 * the same issuer the account signed in with: the refresh token must never
 * go to anyone else.
 */
export function tokenEndpointFor(
    metadata: unknown,
    issuer: string,
): string | null {
    if (!metadata || typeof metadata !== "object") return null;
    const m = metadata as AuthMetadata;
    if (typeof m.issuer !== "string" || !sameIssuer(m.issuer, issuer))
        return null;
    if (typeof m.token_endpoint !== "string") return null;
    try {
        const url = new URL(m.token_endpoint);
        // https only, except a plain-http issuer (a LAN test server).
        const httpIssuer = issuer.toLowerCase().startsWith("http://");
        if (
            url.protocol !== "https:" &&
            !(httpIssuer && url.protocol === "http:")
        )
            return null;
        return url.href;
    } catch {
        return null;
    }
}

/** The new token pair from a token-endpoint answer, or null when unusable. */
export function parseTokenResponse(
    body: unknown,
    now: number,
): { accessToken: string; refreshToken?: string; expiresAt?: number } | null {
    if (!body || typeof body !== "object") return null;
    const b = body as Record<string, unknown>;
    if (typeof b.access_token !== "string" || !b.access_token) return null;
    if (
        typeof b.token_type === "string" &&
        b.token_type.toLowerCase() !== "bearer"
    )
        return null;
    const out: {
        accessToken: string;
        refreshToken?: string;
        expiresAt?: number;
    } = { accessToken: b.access_token };
    if (typeof b.refresh_token === "string" && b.refresh_token)
        out.refreshToken = b.refresh_token;
    if (
        typeof b.expires_in === "number" &&
        Number.isFinite(b.expires_in) &&
        b.expires_in > 0
    )
        out.expiresAt = now + b.expires_in * 1000;
    return out;
}

function stillValid(account: StoredAccount, now: number): boolean {
    return (
        typeof account.accessTokenExpiresAt === "number" &&
        account.accessTokenExpiresAt - now > STILL_VALID_MARGIN_MS
    );
}

/**
 * Refresh one account's access token from the stored registry. Never throws.
 *
 * `staleAccessToken` is the token the caller found not working. When the
 * registry already holds a different one with time left, that is returned
 * without a refresh (the app refreshed, the native mirror missed it).
 */
export async function refreshStoredAccount(opts: {
    registryRaw: string | null;
    userId: string;
    staleAccessToken: string;
    now: number;
    fetchFn: typeof fetch;
    timeoutMs: number;
}): Promise<HeadlessRefreshOutcome> {
    const registry = parseRegistry(opts.registryRaw);
    const account = registry.accounts.find((a) => a.userId === opts.userId);
    if (!account) return { ok: false, reason: "account not stored" };
    if (
        account.accessToken !== opts.staleAccessToken &&
        stillValid(account, opts.now)
    ) {
        return {
            ok: true,
            accessToken: account.accessToken,
            expiresAt: account.accessTokenExpiresAt,
            registryRaw: null,
        };
    }
    if (!account.oauth) return { ok: false, reason: "not an OAuth session" };
    if (!account.refreshToken) return { ok: false, reason: "no refresh token" };

    const call = async (
        url: string,
        init?: RequestInit,
    ): Promise<Response | null> => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
        try {
            return await opts.fetchFn(url, {
                ...init,
                signal: controller.signal,
            });
        } catch {
            return null;
        } finally {
            clearTimeout(timer);
        }
    };

    const base = account.homeserverUrl.replace(/\/+$/, "");
    const metaRes = await call(`${base}/_matrix/client/v1/auth_metadata`);
    if (!metaRes) return { ok: false, reason: "metadata unreachable" };
    if (!metaRes.ok)
        return { ok: false, reason: `metadata HTTP ${metaRes.status}` };
    let metadata: unknown;
    try {
        metadata = await metaRes.json();
    } catch {
        return { ok: false, reason: "metadata not JSON" };
    }
    const endpoint = tokenEndpointFor(metadata, account.oauth.issuer);
    if (!endpoint) return { ok: false, reason: "no matching token endpoint" };

    const params = new URLSearchParams();
    params.append("grant_type", "refresh_token");
    params.append("client_id", account.oauth.clientId);
    params.append("refresh_token", account.refreshToken);
    const res = await call(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
        },
        body: params.toString(),
    });
    if (!res) return { ok: false, reason: "token endpoint unreachable" };
    if (!res.ok) return { ok: false, reason: `token HTTP ${res.status}` };
    let body: unknown;
    try {
        body = await res.json();
    } catch {
        return { ok: false, reason: "token answer not JSON" };
    }
    const tokens = parseTokenResponse(body, opts.now);
    if (!tokens) return { ok: false, reason: "token answer unusable" };
    const next = updateAccountTokens(registry, opts.userId, tokens);
    return {
        ok: true,
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresAt,
        registryRaw: JSON.stringify(next),
    };
}
