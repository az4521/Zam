import { describe, expect, it, vi } from "vitest";
import type { ValidatedAuthMetadata } from "matrix-js-sdk";

vi.mock("$lib/matrix/client", () => ({
    finishOAuthTokens: vi.fn(),
    resolveHomeserver: vi.fn(),
}));
vi.mock("$lib/matrix/runtime", () => ({ getClient: () => null }));

import {
    checkCodeMatches,
    isQrLoginAvailable,
    isTrustedApprovalUrl,
    serverAdvertisesQrLogin,
} from "./qrLogin";

const versions = (features: Record<string, boolean>) =>
    vi.fn(async () => Response.json({ unstable_features: features }));

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
            await serverAdvertisesQrLogin("https://hs.test", versions({})),
        ).toBe(false);
    });
    it("is false when the server is unreachable", async () => {
        const down = vi.fn(async () => {
            throw new Error("offline");
        });
        expect(await serverAdvertisesQrLogin("https://hs.test", down)).toBe(
            false,
        );
    });
});

describe("isQrLoginAvailable", () => {
    it("needs OAuth metadata with the device-code grant", async () => {
        expect(await isQrLoginAvailable("https://hs.test", null)).toBe(false);
        const noDevice = {
            device_authorization_endpoint: "https://a/device",
            grant_types_supported: ["authorization_code"],
        } as unknown as ValidatedAuthMetadata;
        expect(await isQrLoginAvailable("https://hs.test", noDevice)).toBe(
            false,
        );
    });
});
