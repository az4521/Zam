import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ native: false }));
vi.mock("@capacitor/core", () => ({
    Capacitor: { isNativePlatform: () => platform.native },
}));
vi.mock("@capacitor/app", () => ({ App: {} }));

import type { ValidatedAuthMetadata } from "matrix-js-sdk";
import {
    OAuthRegistrationRefusedError,
    beginOAuthLogin,
    discoverOAuthMetadata,
    ensureClientId,
    hasOAuthParams,
    isPendingOAuthCallback,
    readOAuthCallback,
    redirectTarget,
    withoutOAuthParams,
} from "./oauth";
import { pickSignInMethod } from "$lib/utils/loginFlows";

const ISSUER = "https://auth.example/";

function metadata(over: Partial<ValidatedAuthMetadata> = {}) {
    return {
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}authorize`,
        token_endpoint: `${ISSUER}oauth2/token`,
        revocation_endpoint: `${ISSUER}oauth2/revoke`,
        registration_endpoint: `${ISSUER}oauth2/registration`,
        account_management_uri: `${ISSUER}account/`,
        response_modes_supported: ["query", "fragment"],
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256"],
        prompt_values_supported: ["create"],
        ...over,
    } as ValidatedAuthMetadata;
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

/** Route fetches by URL suffix. */
function stubFetch(routes: Record<string, () => Response>) {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, init });
        for (const [suffix, make] of Object.entries(routes)) {
            if (url.endsWith(suffix)) return make();
        }
        throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fn);
    return { fn, calls };
}

beforeEach(() => {
    localStorage.clear();
    platform.native = false;
    // The Electron path opens the provider via window.open, which jsdom lets
    // us spy on (unlike location.assign).
    window.desktop = { sso: { onCallback: () => () => {} } };
    vi.spyOn(window, "open").mockReturnValue(null);
});
afterEach(() => {
    delete window.desktop;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("discoverOAuthMetadata", () => {
    const fetchOf = (res: () => Response | Promise<Response>) =>
        vi.fn(async () => res()) as unknown as typeof fetch;

    it("returns valid metadata from /_matrix/client/v1/auth_metadata", async () => {
        const fn = fetchOf(() => json(metadata()));
        const meta = await discoverOAuthMetadata("https://hs.example/", fn);
        expect(meta?.issuer).toBe(ISSUER);
        expect(fn).toHaveBeenCalledWith(
            "https://hs.example/_matrix/client/v1/auth_metadata",
            expect.any(Object),
        );
    });

    it("is null when the server has no OAuth API (404)", async () => {
        const fn = fetchOf(() => json({ errcode: "M_UNRECOGNIZED" }, 404));
        expect(
            await discoverOAuthMetadata("https://hs.example", fn),
        ).toBeNull();
    });

    it("is null for metadata missing what the flow needs", async () => {
        for (const bad of [
            metadata({ code_challenge_methods_supported: ["plain"] }),
            metadata({ grant_types_supported: ["authorization_code"] }),
            { ...metadata(), registration_endpoint: undefined },
            { issuer: ISSUER },
            "nope",
        ]) {
            const fn = fetchOf(() => json(bad));
            expect(
                await discoverOAuthMetadata("https://hs.example", fn),
            ).toBeNull();
        }
    });

    it("is null when the server is unreachable or answers with junk", async () => {
        const down = vi.fn(async () => {
            throw new TypeError("network");
        }) as unknown as typeof fetch;
        expect(
            await discoverOAuthMetadata("https://hs.example", down),
        ).toBeNull();
        const junk = fetchOf(() => new Response("<html>", { status: 200 }));
        expect(
            await discoverOAuthMetadata("https://hs.example", junk),
        ).toBeNull();
    });
});

describe("falling back to legacy sign-in", () => {
    it("leads with OAuth only when metadata was found", () => {
        expect(pickSignInMethod(metadata())).toBe("oauth");
        expect(pickSignInMethod(null)).toBe("legacy");
    });
});

describe("redirectTarget", () => {
    it("is a web client on an https origin", () => {
        delete window.desktop;
        expect(
            redirectTarget({
                origin: "https://zam.example",
                protocol: "https:",
            }),
        ).toEqual({
            redirectUri: "https://zam.example/",
            applicationType: "web",
            clientUri: "https://zam.example",
        });
    });

    it("is a native loopback client in Electron", () => {
        expect(
            redirectTarget({
                origin: "http://127.0.0.1:51234",
                protocol: "http:",
            }),
        ).toEqual({
            redirectUri: "http://127.0.0.1:51234/sso-callback",
            applicationType: "native",
            clientUri: "https://matrix.crafty.moe",
        });
    });

    it("is a native custom-scheme client on Android", () => {
        platform.native = true;
        expect(
            redirectTarget({ origin: "https://localhost", protocol: "https:" }),
        ).toEqual({
            redirectUri: "moe.crafty.matrix:/oauth",
            applicationType: "native",
            clientUri: "https://matrix.crafty.moe",
        });
    });

    it("treats an http dev origin as native (the spec only allows http for native)", () => {
        delete window.desktop;
        expect(
            redirectTarget({
                origin: "http://localhost:5173",
                protocol: "http:",
            }).applicationType,
        ).toBe("native");
    });
});

describe("ensureClientId", () => {
    const target = {
        redirectUri: "https://zam.example/",
        applicationType: "web" as const,
        clientUri: "https://zam.example",
    };

    it("registers once and reuses the client id per homeserver and redirect", async () => {
        const { fn } = stubFetch({
            "/oauth2/registration": () => json({ client_id: "client-1" }),
        });
        const meta = metadata();
        expect(await ensureClientId("https://hs.example", meta, target)).toBe(
            "client-1",
        );
        expect(await ensureClientId("https://hs.example/", meta, target)).toBe(
            "client-1",
        );
        expect(fn).toHaveBeenCalledTimes(1);

        const body = JSON.parse(String(fn.mock.calls[0][1]?.body));
        expect(body).toMatchObject({
            client_name: "Zam",
            client_uri: "https://zam.example",
            application_type: "web",
            redirect_uris: ["https://zam.example/"],
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            token_endpoint_auth_method: "none",
        });

        // A different redirect URI (e.g. another origin) is a new registration.
        await ensureClientId("https://hs.example", meta, {
            ...target,
            redirectUri: "https://other.example/",
        });
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it("re-registers when the homeserver moved to a different issuer", async () => {
        let n = 0;
        const { fn } = stubFetch({
            "/oauth2/registration": () => json({ client_id: `client-${++n}` }),
        });
        await ensureClientId("https://hs.example", metadata(), target);
        const moved = metadata({ issuer: "https://new-auth.example/" });
        expect(await ensureClientId("https://hs.example", moved, target)).toBe(
            "client-2",
        );
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it("reports a refused registration as OAuthRegistrationRefusedError", async () => {
        stubFetch({
            "/oauth2/registration": () =>
                json({ error: "invalid_client_metadata" }, 400),
        });
        await expect(
            ensureClientId("https://hs.example", metadata(), target),
        ).rejects.toBeInstanceOf(OAuthRegistrationRefusedError);
        // Nothing was cached for the failed attempt.
        expect(localStorage.getItem("zam_oauth_clients")).toBeNull();
    });

    it("refuses when the server does not offer the grants we need", async () => {
        stubFetch({});
        const meta = metadata({
            grant_types_supported: ["authorization_code"],
        });
        await expect(
            ensureClientId("https://hs.example", meta, target),
        ).rejects.toBeInstanceOf(OAuthRegistrationRefusedError);
    });
});

/** Start an attempt (registering first) and return the provider URL it opened. */
async function startAttempt(
    opts: { register?: boolean; meta?: ValidatedAuthMetadata } = {},
): Promise<URL> {
    stubFetch({
        "/oauth2/registration": () => json({ client_id: "client-1" }),
    });
    await beginOAuthLogin({
        baseUrl: "https://hs.example",
        metadata: opts.meta ?? metadata(),
        register: opts.register,
        slidingSync: true,
    });
    const calls = (window.open as unknown as ReturnType<typeof vi.fn>).mock
        .calls;
    return new URL(String(calls[calls.length - 1][0]));
}

function returnUrl(auth: URL, extra: Record<string, string>): string {
    const back = new URL(auth.searchParams.get("redirect_uri")!);
    back.searchParams.set("state", auth.searchParams.get("state")!);
    for (const [k, v] of Object.entries(extra)) back.searchParams.set(k, v);
    return back.href;
}

describe("beginOAuthLogin", () => {
    it("sends an authorization-code request with PKCE S256, a fresh state and the device scope", async () => {
        const url = await startAttempt();
        expect(url.origin + url.pathname).toBe(`${ISSUER}authorize`);
        const q = url.searchParams;
        expect(q.get("response_type")).toBe("code");
        expect(q.get("response_mode")).toBe("query");
        expect(q.get("client_id")).toBe("client-1");
        expect(q.get("code_challenge_method")).toBe("S256");
        expect(q.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(q.get("state")).toMatch(/^[0-9a-f]{32}$/);
        expect(q.get("scope")).toMatch(
            /^urn:matrix:client:api:\* urn:matrix:client:device:[A-Za-z0-9]{10}$/,
        );
        expect(q.get("prompt")).toBeNull();

        // A second attempt never reuses the state.
        const again = await startAttempt();
        expect(again.searchParams.get("state")).not.toBe(q.get("state"));
    });

    it("asks the provider to create an account when registering, if it supports that", async () => {
        const url = await startAttempt({ register: true });
        expect(url.searchParams.get("prompt")).toBe("create");
        const plain = await startAttempt({
            register: true,
            meta: metadata({ prompt_values_supported: undefined }),
        });
        expect(plain.searchParams.get("prompt")).toBeNull();
    });

    it("saves the verifier and device id the code exchange will need", async () => {
        const url = await startAttempt();
        const pending = JSON.parse(localStorage.getItem("zam_oauth_pending")!);
        expect(pending).toMatchObject({
            state: url.searchParams.get("state"),
            clientId: "client-1",
            issuer: ISSUER,
            baseUrl: "https://hs.example",
            redirectUri: url.searchParams.get("redirect_uri"),
            slidingSync: true,
        });
        expect(pending.codeVerifier).toHaveLength(96);
        expect(url.searchParams.get("scope")).toContain(pending.deviceId);
    });

    it("does not leave the page or save an attempt when registration is refused", async () => {
        stubFetch({
            "/oauth2/registration": () => json({ error: "nope" }, 403),
        });
        await expect(
            beginOAuthLogin({
                baseUrl: "https://hs.example",
                metadata: metadata(),
                slidingSync: false,
            }),
        ).rejects.toBeInstanceOf(OAuthRegistrationRefusedError);
        expect(window.open).not.toHaveBeenCalled();
        expect(localStorage.getItem("zam_oauth_pending")).toBeNull();
    });
});

describe("readOAuthCallback (state validation)", () => {
    it("accepts a matching state once and hands back the attempt", async () => {
        const auth = await startAttempt();
        const url = returnUrl(auth, { code: "abc" });
        expect(readOAuthCallback(url)).toEqual({
            kind: "ok",
            code: "abc",
            pending: expect.objectContaining({ clientId: "client-1" }),
        });
        // Consumed and remembered: a replay is ignored, not redeemed twice.
        expect(readOAuthCallback(url)).toBeNull();
        expect(localStorage.getItem("zam_oauth_pending")).toBeNull();
    });

    it("rejects a forged state without cancelling the real attempt", async () => {
        const auth = await startAttempt();
        const forged = `${window.location.origin}/?state=deadbeef&code=evil`;
        expect(readOAuthCallback(forged)).toEqual({ kind: "invalid" });
        expect(readOAuthCallback(returnUrl(auth, { code: "real" }))?.kind).toBe(
            "ok",
        );
    });

    it("ignores a stale URL re-delivered against a newer attempt", async () => {
        const first = await startAttempt();
        const stale = returnUrl(first, { code: "old" });
        expect(readOAuthCallback(stale)?.kind).toBe("ok");
        const second = await startAttempt();
        expect(readOAuthCallback(stale)).toBeNull();
        expect(
            readOAuthCallback(returnUrl(second, { code: "new" }))?.kind,
        ).toBe("ok");
    });

    it("ignores callbacks when nothing is pending or the URL is not one", async () => {
        expect(readOAuthCallback("/?state=abc&code=x")).toBeNull();
        expect(readOAuthCallback("/?add")).toBeNull();
        expect(readOAuthCallback("/?code=x")).toBeNull();
        await startAttempt();
        expect(readOAuthCallback("/?state=abc")).toBeNull();
    });

    it("expires an abandoned attempt", async () => {
        const auth = await startAttempt();
        const url = returnUrl(auth, { code: "late" });
        vi.useFakeTimers();
        vi.setSystemTime(Date.now() + 31 * 60 * 1000);
        try {
            expect(readOAuthCallback(url)).toBeNull();
            expect(localStorage.getItem("zam_oauth_pending")).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it("reports the user cancelling at the provider", async () => {
        const auth = await startAttempt();
        const result = readOAuthCallback(
            returnUrl(auth, {
                error: "access_denied",
                error_description: "The user denied the request",
            }),
        );
        expect(result).toEqual({
            kind: "denied",
            error: "access_denied",
            description: "The user denied the request",
            pending: expect.any(Object),
        });
        expect(localStorage.getItem("zam_oauth_pending")).toBeNull();
    });

    it("burns the attempt when the response names a different issuer", async () => {
        const auth = await startAttempt();
        const url = returnUrl(auth, {
            code: "c",
            iss: "https://evil.example/",
        });
        expect(readOAuthCallback(url)).toEqual({ kind: "invalid" });
        expect(localStorage.getItem("zam_oauth_pending")).toBeNull();
    });

    it("accepts a matching iss parameter", async () => {
        const auth = await startAttempt();
        expect(
            readOAuthCallback(returnUrl(auth, { code: "c", iss: ISSUER }))
                ?.kind,
        ).toBe("ok");
    });
});

describe("callback URL helpers", () => {
    it("recognises the return of the pending attempt without consuming it", async () => {
        const auth = await startAttempt();
        const url = returnUrl(auth, { code: "abc" });
        expect(isPendingOAuthCallback(url)).toBe(true);
        expect(isPendingOAuthCallback(url)).toBe(true);
        expect(isPendingOAuthCallback("/?state=nope&code=abc")).toBe(false);
        expect(isPendingOAuthCallback("/?add")).toBe(false);
        expect(readOAuthCallback(url)?.kind).toBe("ok");
        expect(isPendingOAuthCallback(url)).toBe(false);
    });

    it("hasOAuthParams needs a state plus a code or an error", () => {
        const u = (s: string) => new URL(`https://x.example/${s}`);
        expect(hasOAuthParams(u("?state=a&code=b"))).toBe(true);
        expect(hasOAuthParams(u("?state=a&error=access_denied"))).toBe(true);
        expect(hasOAuthParams(u("?state=a"))).toBe(false);
        expect(hasOAuthParams(u("?code=b"))).toBe(false);
    });

    it("strips callback params but keeps the rest (a bare ?add stays bare)", () => {
        const clean = withoutOAuthParams(
            new URL("https://x.example/?add&state=a&code=b&iss=i"),
        );
        expect(clean.search).toBe("?add");
    });
});
