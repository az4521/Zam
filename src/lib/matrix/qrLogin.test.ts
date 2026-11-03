import { describe, expect, it, vi } from "vitest";
import type { ValidatedAuthMetadata } from "matrix-js-sdk";

vi.mock("$lib/matrix/client", () => ({ finishOAuthTokens: vi.fn() }));
vi.mock("$lib/matrix/crypto", () => ({ startDeviceVerification: vi.fn() }));
vi.mock("$lib/matrix/qrLoginRendezvous", () => ({
    linkDeviceByRendezvousScan: vi.fn(),
    serverAdvertisesQrLogin: vi.fn(),
    signInWithRendezvous: vi.fn(),
}));

import {
    encodeQrPayload,
    isQrLoginAvailable,
    isQrLoginPayload,
    looksLikeQrPayload,
    parseQrPayload,
} from "./qrLogin";

const issuer = "https://account.example.org/";
const meta = (over: Record<string, unknown> = {}) =>
    ({
        issuer,
        device_authorization_endpoint: "https://account.example.org/device",
        grant_types_supported: [
            "authorization_code",
            "urn:ietf:params:oauth:grant-type:device_code",
        ],
        ...over,
    }) as unknown as ValidatedAuthMetadata;

describe("isQrLoginAvailable", () => {
    it("needs the device endpoint and the device-code grant", () => {
        expect(isQrLoginAvailable(meta())).toBe(true);
        expect(isQrLoginAvailable(null)).toBe(false);
        expect(
            isQrLoginAvailable(
                meta({ device_authorization_endpoint: undefined }),
            ),
        ).toBe(false);
        expect(
            isQrLoginAvailable(
                meta({ grant_types_supported: ["authorization_code"] }),
            ),
        ).toBe(false);
    });
});

describe("QR payload", () => {
    const url = "https://account.example.org/link?code=ABCD1234";

    it("round-trips the approval link and device id", () => {
        const text = encodeQrPayload(url, "NEWDEVICE1");
        expect(parseQrPayload(text, issuer)).toEqual({
            approvalUrl: url,
            deviceId: "NEWDEVICE1",
        });
    });

    it("refuses a link that is not on the account's provider", () => {
        const evil = encodeQrPayload("https://evil.example/link", "NEWDEVICE1");
        expect(parseQrPayload(evil, issuer)).toBeNull();
        const http = encodeQrPayload(
            "http://account.example.org/link",
            "NEWDEVICE1",
        );
        expect(parseQrPayload(http, issuer)).toBeNull();
    });

    it("refuses a missing or malformed device id and junk", () => {
        expect(parseQrPayload(url, issuer)).toBeNull();
        expect(parseQrPayload(`${url}#zam-device=bad id!`, issuer)).toBeNull();
        expect(parseQrPayload("not a url", issuer)).toBeNull();
    });

    it("is recognised by the scanner filter", () => {
        const bytes = new TextEncoder().encode(
            encodeQrPayload(url, "ABCDEFGHIJ"),
        );
        expect(looksLikeQrPayload(bytes)).toBe(true);
        expect(looksLikeQrPayload(new TextEncoder().encode(url))).toBe(false);
        expect(
            looksLikeQrPayload(new TextEncoder().encode("WIFI:S:home;;")),
        ).toBe(false);
    });
});

describe("isQrLoginPayload", () => {
    it("takes Matrix QR bytes and device-code links, nothing else", () => {
        const matrix = Uint8Array.from([
            ...new TextEncoder().encode("MATRIX"),
            2,
            0,
        ]);
        expect(isQrLoginPayload(matrix)).toBe(true);
        const link = new TextEncoder().encode(
            encodeQrPayload("https://account.example.org/link", "ABCDEFGHIJ"),
        );
        expect(isQrLoginPayload(link)).toBe(true);
        expect(isQrLoginPayload(new TextEncoder().encode("hello"))).toBe(false);
    });
});

describe("device codes typed on an existing device", () => {
    it("tidies a typed code", async () => {
        const { normalizeUserCode } = await import("./qrLogin");
        expect(normalizeUserCode(" abcd-efgh ")).toBe("ABCDEFGH");
        expect(normalizeUserCode("ab")).toBeNull();
        expect(normalizeUserCode("https://evil.example")).toBeNull();
    });

    it("approves on the account's own provider", async () => {
        const { buildCodeApprovalUrl } = await import("./qrLogin");
        expect(buildCodeApprovalUrl(issuer, "ABCDEFGH")).toBe(
            "https://account.example.org/link?code=ABCDEFGH",
        );
    });
});
