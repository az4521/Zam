import { describe, expect, it, vi } from "vitest";

vi.mock("$lib/matrix/client", () => ({
    finishOAuthTokens: vi.fn(),
    resolveHomeserver: vi.fn(),
}));
vi.mock("$lib/matrix/runtime", () => ({ getClient: () => null }));

import {
    checkCodeMatches,
    isTrustedApprovalUrl,
    serverAdvertisesQrLogin,
} from "./qrLoginRendezvous";

const versions = (features: Record<string, boolean>) =>
    vi.fn(async (_input: RequestInfo | URL) =>
        Response.json({ unstable_features: features }),
    );

describe("checkCodeMatches", () => {
    it("accepts the exact code, ignoring surrounding space", () => {
        expect(checkCodeMatches("42", " 42 ")).toBe(true);
    });
    it("rejects a different or empty code", () => {
        expect(checkCodeMatches("42", "24")).toBe(false);
        expect(checkCodeMatches("", "")).toBe(false);
    });
});

describe("isTrustedApprovalUrl", () => {
    const issuer = "https://account.example.org/";
    it("accepts the provider's own https origin", () => {
        expect(
            isTrustedApprovalUrl(
                "https://account.example.org/device?user_code=ABCD",
                issuer,
            ),
        ).toBe(true);
    });
    it("rejects another host, plain http and junk", () => {
        expect(isTrustedApprovalUrl("https://evil.example/", issuer)).toBe(
            false,
        );
        expect(
            isTrustedApprovalUrl("http://account.example.org/device", issuer),
        ).toBe(false);
        expect(isTrustedApprovalUrl("not a url", issuer)).toBe(false);
    });
});

describe("serverAdvertisesQrLogin", () => {
    it("reads the unstable feature flag", async () => {
        const yes = versions({ "org.matrix.msc4108": true });
        expect(await serverAdvertisesQrLogin("https://hs.test/", yes)).toBe(
            true,
        );
        expect(yes.mock.calls[0][0]).toBe(
            "https://hs.test/_matrix/client/versions",
        );
        expect(
            await serverAdvertisesQrLogin(
                "https://hs.test",
                versions({ "org.matrix.msc4108": false }),
            ),
        ).toBe(false);
    });
    it("is false when the server is unreachable", async () => {
        const down = vi.fn(async (_input: RequestInfo | URL) => {
            throw new Error("offline");
        });
        expect(await serverAdvertisesQrLogin("https://hs.test", down)).toBe(
            false,
        );
    });
});
