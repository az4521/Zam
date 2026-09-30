// The app leans on matrix-js-sdk for token refresh and revocation once a client
// is built with `oauthClientId` + `refreshToken` + `onTokenRefresh` (see
// createAuthenticatedClient in client.ts). These tests run the REAL SDK
// against a fake homeserver and provider, so a change in how the SDK or our
// wiring behaves shows up here rather than as a silently dead session.

import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpApiEvent, createClient } from "matrix-js-sdk";
import {
    updateAccountTokens,
    upsertAccount,
    emptyRegistry,
} from "$lib/utils/accounts";

const HS = "https://hs.example";
const ISSUER = "https://auth.example/";

const AUTH_METADATA = {
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}authorize`,
    token_endpoint: `${ISSUER}oauth2/token`,
    revocation_endpoint: `${ISSUER}oauth2/revoke`,
    registration_endpoint: `${ISSUER}oauth2/registration`,
    response_modes_supported: ["query", "fragment"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
};

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

interface Provider {
    /** Access tokens the homeserver currently accepts. */
    validAccess: Set<string>;
    /** What the token endpoint answers to a refresh. */
    refresh: (refreshToken: string) => Response;
    requests: { url: string; method: string; body: string; auth: string }[];
}

function fakeServers(overrides: Partial<Provider> = {}) {
    const provider: Provider = {
        validAccess: new Set(["new-access"]),
        refresh: (rt) =>
            rt === "old-refresh"
                ? json({
                      token_type: "Bearer",
                      access_token: "new-access",
                      refresh_token: "new-refresh",
                      expires_in: 300,
                  })
                : json({ error: "invalid_grant" }, 400),
        requests: [],
        ...overrides,
    };
    const fetchFn = vi.fn(
        async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const headers = new Headers(init?.headers);
            const body = init?.body ? String(init.body) : "";
            provider.requests.push({
                url,
                method: init?.method ?? "GET",
                body,
                auth: headers.get("Authorization") ?? "",
            });
            if (url.endsWith("/auth_metadata")) return json(AUTH_METADATA);
            if (url === AUTH_METADATA.token_endpoint) {
                const params = new URLSearchParams(body);
                expect(params.get("grant_type")).toBe("refresh_token");
                expect(params.get("client_id")).toBe("client-1");
                return provider.refresh(params.get("refresh_token") ?? "");
            }
            if (url === AUTH_METADATA.revocation_endpoint) return json({});
            if (url.includes("/_matrix/client/")) {
                const token = headers.get("Authorization")?.slice(7) ?? "";
                if (!provider.validAccess.has(token)) {
                    return json(
                        {
                            errcode: "M_UNKNOWN_TOKEN",
                            error: "Access token has expired",
                            soft_logout: true,
                        },
                        401,
                    );
                }
                if (url.endsWith("/logout")) return json({});
                return json({ user_id: "@a:hs.example", device_id: "DEV" });
            }
            throw new Error(`unexpected fetch ${url}`);
        },
    );
    // The SDK talks to the provider (token, revocation) through the global
    // fetch, and to the homeserver through the client's fetchFn.
    vi.stubGlobal("fetch", fetchFn);
    return { provider, fetchFn: fetchFn as unknown as typeof fetch };
}

afterEach(() => vi.unstubAllGlobals());

function oauthClient(
    fetchFn: typeof fetch,
    onTokenRefresh: (t: unknown) => void,
) {
    return createClient({
        baseUrl: HS,
        userId: "@a:hs.example",
        deviceId: "DEV",
        accessToken: "old-access",
        refreshToken: "old-refresh",
        oauthClientId: "client-1",
        onTokenRefresh: onTokenRefresh as never,
        fetchFn,
    });
}

describe("OAuth token refresh through the SDK", () => {
    it("refreshes on an expired access token, retries, and reports the rotated pair", async () => {
        const { provider, fetchFn } = fakeServers();
        const onRefresh = vi.fn();
        const client = oauthClient(fetchFn, onRefresh);

        const who = await client.whoami();

        expect(who.user_id).toBe("@a:hs.example");
        expect(onRefresh).toHaveBeenCalledTimes(1);
        expect(onRefresh).toHaveBeenCalledWith({
            accessToken: "new-access",
            refreshToken: "new-refresh",
            expiry: expect.any(Date),
        });
        // The retried request carried the new token, and the provider was
        // asked with the OLD refresh token exactly once.
        const whoamis = provider.requests.filter((r) =>
            r.url.endsWith("/whoami"),
        );
        expect(whoamis.map((r) => r.auth)).toEqual([
            "Bearer old-access",
            "Bearer new-access",
        ]);
        expect(
            provider.requests.filter((r) => r.url.endsWith("/oauth2/token")),
        ).toHaveLength(1);
        expect(client.getAccessToken()).toBe("new-access");
    });

    it("is what the registry stores, so a restart resumes with the rotated refresh token", async () => {
        const { fetchFn } = fakeServers();
        let registry = upsertAccount(emptyRegistry(), {
            userId: "@a:hs.example",
            accessToken: "old-access",
            refreshToken: "old-refresh",
            oauth: { clientId: "client-1", issuer: ISSUER },
            deviceId: "DEV",
            homeserverUrl: HS,
        });
        const client = oauthClient(fetchFn, (t) => {
            const tokens = t as {
                accessToken: string;
                refreshToken?: string;
                expiry?: Date;
            };
            registry = updateAccountTokens(registry, "@a:hs.example", {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresAt: tokens.expiry?.getTime(),
            });
        });
        await client.whoami();

        const stored = registry.accounts[0];
        expect(stored.accessToken).toBe("new-access");
        expect(stored.refreshToken).toBe("new-refresh");
        expect(stored.oauth).toEqual({ clientId: "client-1", issuer: ISSUER });
        expect(stored.accessTokenExpiresAt).toBeGreaterThan(Date.now());

        // A fresh client built from what was stored keeps working: the new
        // access token is accepted without another round trip to the provider.
        const { provider, fetchFn: fetch2 } = fakeServers();
        const restored = createClient({
            baseUrl: HS,
            userId: "@a:hs.example",
            deviceId: "DEV",
            accessToken: stored.accessToken,
            refreshToken: stored.refreshToken,
            oauthClientId: stored.oauth!.clientId,
            onTokenRefresh: () => {},
            fetchFn: fetch2,
        });
        await restored.whoami();
        expect(
            provider.requests.filter((r) => r.url.endsWith("/oauth2/token")),
        ).toHaveLength(0);
    });

    it("drops to a logged-out session when the provider rejects the refresh token", async () => {
        const { fetchFn } = fakeServers({
            refresh: () => json({ error: "invalid_grant" }, 400),
        });
        const onRefresh = vi.fn();
        const client = oauthClient(fetchFn, onRefresh);
        const loggedOut = vi.fn();
        client.on(HttpApiEvent.SessionLoggedOut, loggedOut);

        await expect(client.whoami()).rejects.toMatchObject({
            errcode: "M_UNKNOWN_TOKEN",
        });

        // This is the event the app turns into "session expired, sign in again".
        expect(loggedOut).toHaveBeenCalledTimes(1);
        expect(onRefresh).not.toHaveBeenCalled();
    });

    it("does not log the user out over a transient provider failure", async () => {
        const { fetchFn } = fakeServers({
            refresh: () => new Response("upstream down", { status: 503 }),
        });
        const client = oauthClient(fetchFn, vi.fn());
        const loggedOut = vi.fn();
        client.on(HttpApiEvent.SessionLoggedOut, loggedOut);

        await expect(client.whoami()).rejects.toBeDefined();
        expect(loggedOut).not.toHaveBeenCalled();
    });

    it("revokes both tokens at the provider on logout instead of calling /logout", async () => {
        const { provider, fetchFn } = fakeServers({
            validAccess: new Set(["old-access"]),
        });
        const client = oauthClient(fetchFn, vi.fn());

        await client.logout(true);

        const revocations = provider.requests
            .filter((r) => r.url.endsWith("/oauth2/revoke"))
            .map((r) => Object.fromEntries(new URLSearchParams(r.body)));
        expect(revocations).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    token: "old-access",
                    token_type_hint: "access_token",
                    client_id: "client-1",
                }),
                expect.objectContaining({
                    token: "old-refresh",
                    token_type_hint: "refresh_token",
                    client_id: "client-1",
                }),
            ]),
        );
        expect(revocations).toHaveLength(2);
        expect(provider.requests.some((r) => r.url.endsWith("/logout"))).toBe(
            false,
        );
    });
});
