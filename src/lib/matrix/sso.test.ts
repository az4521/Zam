import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getSsoRedirectUrl: vi.fn(() => "https://hs.example/sso"),
}));

vi.mock("$lib/matrix/client", () => ({
    getSsoRedirectUrl: mocks.getSsoRedirectUrl,
}));
vi.mock("@capacitor/core", () => ({
    Capacitor: { isNativePlatform: () => false },
}));
vi.mock("@capacitor/app", () => ({ App: {} }));

import { beginSsoLogin, readSsoCallback } from "./sso";

/** Start an attempt the Electron way and return its callback URL. */
function startAttempt(): string {
    beginSsoLogin({
        baseUrl: "https://hs.example",
        loginType: "sso",
        slidingSync: true,
        addMode: false,
    });
    const calls = mocks.getSsoRedirectUrl.mock.calls as unknown as [
        string,
        string,
    ][];
    return calls[calls.length - 1][1];
}

function withToken(callback: string, token: string): string {
    const url = new URL(callback);
    url.searchParams.set("loginToken", token);
    return url.href;
}

describe("readSsoCallback", () => {
    beforeEach(() => {
        localStorage.clear();
        mocks.getSsoRedirectUrl.mockClear();
        window.desktop = { sso: { onCallback: () => () => {} } };
        vi.spyOn(window, "open").mockReturnValue(null);
    });
    afterEach(() => {
        delete window.desktop;
        vi.restoreAllMocks();
    });

    it("redeems a callback whose nonce matches, once", () => {
        const callback = startAttempt();
        expect(callback).toMatch(/\/sso-callback\?sso_state=[0-9a-f]{32}$/);

        const url = withToken(callback, "tok-1");
        const result = readSsoCallback(url);
        expect(result).toEqual({
            kind: "ok",
            loginToken: "tok-1",
            pending: expect.objectContaining({
                baseUrl: "https://hs.example",
                slidingSync: true,
            }),
        });
        // Consumed: the same URL is not redeemed twice.
        expect(readSsoCallback(url)).toBeNull();
    });

    it("rejects a forged callback without cancelling the real attempt", () => {
        const callback = startAttempt();
        const forged = `${window.location.origin}/sso-callback?sso_state=deadbeef&loginToken=evil`;

        expect(readSsoCallback(forged)).toEqual({ kind: "invalid" });
        const result = readSsoCallback(withToken(callback, "real"));
        expect(result?.kind).toBe("ok");
    });

    it("ignores a replayed callback (e.g. a stale Android launch URL)", () => {
        const first = startAttempt();
        const stale = withToken(first, "old");
        expect(readSsoCallback(stale)?.kind).toBe("ok");

        const second = startAttempt();
        // Re-delivering the old URL is ignored, not reported as invalid, and
        // leaves the new attempt pending.
        expect(readSsoCallback(stale)).toBeNull();
        expect(readSsoCallback(withToken(second, "new"))?.kind).toBe("ok");
    });

    it("ignores URLs without a loginToken or with nothing pending", () => {
        expect(readSsoCallback("/?sso_state=abc")).toBeNull();
        expect(
            readSsoCallback("/sso-callback?sso_state=abc&loginToken=x"),
        ).toBeNull();
    });
});
