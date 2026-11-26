import { describe, expect, it, vi } from "vitest";
import {
    parseTokenResponse,
    refreshStoredAccount,
    tokenEndpointFor,
} from "./headlessTokenRefresh";
import { parseRegistry } from "./accounts";

const HS = "https://hs.example";
const ISSUER = "https://auth.example/";
const NOW = 1_700_000_000_000;

function registry(account: Record<string, unknown> = {}): string {
    return JSON.stringify({
        version: 1,
        activeUserId: "@a:hs.example",
        accounts: [
            {
                userId: "@a:hs.example",
                accessToken: "stale",
                deviceId: "DEV",
                homeserverUrl: HS,
                refreshToken: "r1",
                oauth: { clientId: "client", issuer: ISSUER },
                accessTokenExpiresAt: NOW - 1000,
                displayName: "A",
                ...account,
            },
            {
                userId: "@b:hs.example",
                accessToken: "b-token",
                deviceId: "DEVB",
                homeserverUrl: HS,
            },
        ],
    });
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

const METADATA = {
    issuer: ISSUER,
    token_endpoint: `${ISSUER}oauth2/token`,
};

function provider(tokenAnswer: Response | (() => Response)) {
    return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === `${HS}/_matrix/client/v1/auth_metadata`)
            return json(METADATA);
        if (url === METADATA.token_endpoint) {
            expect(init?.method).toBe("POST");
            const body = new URLSearchParams(String(init?.body));
            expect(body.get("grant_type")).toBe("refresh_token");
            expect(body.get("client_id")).toBe("client");
            expect(body.get("refresh_token")).toBe("r1");
            return typeof tokenAnswer === "function"
                ? tokenAnswer()
                : tokenAnswer;
        }
        throw new Error(`unexpected request ${url}`);
    });
}

function run(fetchFn: typeof fetch, registryRaw: string | null = registry()) {
    return refreshStoredAccount({
        registryRaw,
        userId: "@a:hs.example",
        staleAccessToken: "stale",
        now: NOW,
        fetchFn,
        timeoutMs: 1000,
    });
}

describe("refreshStoredAccount", () => {
    it("refreshes and returns the registry with the rotated pair", async () => {
        const fetchFn = provider(
            json({
                access_token: "fresh",
                refresh_token: "r2",
                token_type: "Bearer",
                expires_in: 300,
            }),
        );
        const out = await run(fetchFn);
        expect(out).toMatchObject({
            ok: true,
            accessToken: "fresh",
            expiresAt: NOW + 300_000,
        });
        if (!out.ok || !out.registryRaw) throw new Error("no registry");
        const reg = parseRegistry(out.registryRaw);
        const a = reg.accounts.find((x) => x.userId === "@a:hs.example");
        expect(a).toMatchObject({
            accessToken: "fresh",
            refreshToken: "r2",
            accessTokenExpiresAt: NOW + 300_000,
            displayName: "A",
        });
        // The other account and the active one are untouched.
        expect(reg.accounts[1].accessToken).toBe("b-token");
        expect(reg.activeUserId).toBe("@a:hs.example");
    });

    it("keeps the old refresh token when the provider sends none", async () => {
        const out = await run(provider(json({ access_token: "fresh" })));
        if (!out.ok || !out.registryRaw) throw new Error("no registry");
        const a = parseRegistry(out.registryRaw).accounts[0];
        expect(a.refreshToken).toBe("r1");
        expect(a.accessTokenExpiresAt).toBeUndefined();
    });

    it("uses a newer stored token without refreshing", async () => {
        const fetchFn = vi.fn();
        const out = await run(
            fetchFn,
            registry({
                accessToken: "already-fresh",
                accessTokenExpiresAt: NOW + 240_000,
            }),
        );
        expect(out).toEqual({
            ok: true,
            accessToken: "already-fresh",
            expiresAt: NOW + 240_000,
            registryRaw: null,
        });
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it("refreshes when the stored token is the stale one even with time left", async () => {
        // The record said it had time, yet the server refused it (revoked).
        const out = await run(
            provider(json({ access_token: "fresh" })),
            registry({ accessTokenExpiresAt: NOW + 240_000 }),
        );
        expect(out).toMatchObject({ ok: true, accessToken: "fresh" });
    });

    it("refuses accounts it cannot refresh", async () => {
        const fetchFn = vi.fn();
        expect(await run(fetchFn, null)).toEqual({
            ok: false,
            reason: "account not stored",
        });
        expect(
            await run(fetchFn, registry({ oauth: undefined })),
        ).toMatchObject({ ok: false, reason: "not an OAuth session" });
        expect(
            await run(fetchFn, registry({ refreshToken: undefined })),
        ).toMatchObject({ ok: false, reason: "no refresh token" });
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it("never sends the refresh token to another issuer's endpoint", async () => {
        const fetchFn = vi.fn(async () =>
            json({
                issuer: "https://evil.example/",
                token_endpoint: "https://evil.example/token",
            }),
        );
        const out = await run(fetchFn);
        expect(out).toEqual({
            ok: false,
            reason: "no matching token endpoint",
        });
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it("reports a refused refresh without a registry", async () => {
        const out = await run(provider(json({ error: "invalid_grant" }, 400)));
        expect(out).toEqual({ ok: false, reason: "token HTTP 400" });
    });

    it("reports an unreachable provider", async () => {
        const fetchFn = vi.fn(async () => {
            throw new TypeError("network");
        });
        expect(await run(fetchFn)).toEqual({
            ok: false,
            reason: "metadata unreachable",
        });
    });
});

describe("tokenEndpointFor", () => {
    it("accepts the same issuer, with or without a trailing slash", () => {
        expect(tokenEndpointFor(METADATA, "https://auth.example")).toBe(
            METADATA.token_endpoint,
        );
    });

    it("refuses plain http unless the issuer is http too", () => {
        const http = {
            issuer: ISSUER,
            token_endpoint: "http://auth.example/token",
        };
        expect(tokenEndpointFor(http, ISSUER)).toBeNull();
        expect(
            tokenEndpointFor(
                {
                    issuer: "http://lan.test/",
                    token_endpoint: "http://lan.test/token",
                },
                "http://lan.test/",
            ),
        ).toBe("http://lan.test/token");
    });

    it("refuses junk", () => {
        expect(tokenEndpointFor(null, ISSUER)).toBeNull();
        expect(tokenEndpointFor({ issuer: ISSUER }, ISSUER)).toBeNull();
        expect(
            tokenEndpointFor({ issuer: ISSUER, token_endpoint: "::" }, ISSUER),
        ).toBeNull();
    });
});

describe("parseTokenResponse", () => {
    it("reads the pair and turns expires_in into a time", () => {
        expect(
            parseTokenResponse(
                { access_token: "a", refresh_token: "r", expires_in: 60 },
                NOW,
            ),
        ).toEqual({
            accessToken: "a",
            refreshToken: "r",
            expiresAt: NOW + 60_000,
        });
    });

    it("refuses answers without a bearer access token", () => {
        expect(parseTokenResponse({}, NOW)).toBeNull();
        expect(parseTokenResponse({ access_token: "" }, NOW)).toBeNull();
        expect(
            parseTokenResponse({ access_token: "a", token_type: "mac" }, NOW),
        ).toBeNull();
        expect(parseTokenResponse("nope", NOW)).toBeNull();
    });
});
