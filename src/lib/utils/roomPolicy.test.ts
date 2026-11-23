import { describe, it, expect } from "vitest";
import {
    parseRoomPolicy,
    isPolicyRefusal,
    summarizeServerAcl,
} from "./roomPolicy";

const valid = {
    via: "policy.example.org",
    public_keys: { ed25519: "AAAA" },
};

describe("parseRoomPolicy", () => {
    it("returns the stable policy when it is valid", () => {
        expect(
            parseRoomPolicy(valid, {
                via: "other.org",
                public_keys: { ed25519: "BBBB" },
            }),
        ).toEqual({
            via: "policy.example.org",
            ed25519: "AAAA",
        });
    });

    it("falls back to the unstable policy when stable is invalid", () => {
        expect(
            parseRoomPolicy(
                { via: "" },
                { via: "unstable.org", public_keys: { ed25519: "BBBB" } },
            ),
        ).toEqual({ via: "unstable.org", ed25519: "BBBB" });
    });

    it("falls back to unstable when stable is missing", () => {
        expect(
            parseRoomPolicy(undefined, {
                via: "unstable.org",
                public_keys: { ed25519: "BBBB" },
            }),
        ).toEqual({ via: "unstable.org", ed25519: "BBBB" });
    });

    it("returns null when neither is valid", () => {
        expect(parseRoomPolicy(null, undefined)).toBeNull();
        expect(
            parseRoomPolicy(
                { via: "x.org" },
                { via: "y.org", public_keys: {} },
            ),
        ).toBeNull();
        expect(
            parseRoomPolicy({ public_keys: { ed25519: "A" } }, null),
        ).toBeNull();
    });

    it("rejects empty or non-string via and key values", () => {
        expect(
            parseRoomPolicy({ via: "  ", public_keys: { ed25519: "A" } }, null),
        ).toBeNull();
        expect(
            parseRoomPolicy({ via: 5, public_keys: { ed25519: "A" } }, null),
        ).toBeNull();
        expect(
            parseRoomPolicy(
                { via: "x.org", public_keys: { ed25519: "" } },
                null,
            ),
        ).toBeNull();
        expect(
            parseRoomPolicy(
                { via: "x.org", public_keys: { ed25519: 1 } },
                null,
            ),
        ).toBeNull();
        expect(
            parseRoomPolicy({ via: "x.org", public_keys: "nope" }, null),
        ).toBeNull();
        expect(parseRoomPolicy({ via: "x.org" }, null)).toBeNull();
    });
});

describe("isPolicyRefusal", () => {
    const base = { roomHasPolicyServer: true, userCanSend: false };

    it("is false for a non-M_FORBIDDEN errcode", () => {
        expect(
            isPolicyRefusal({
                ...base,
                errcode: "M_LIMIT_EXCEEDED",
                message: "policy",
            }),
        ).toBe(false);
        expect(isPolicyRefusal({ ...base, message: "spam" })).toBe(false);
    });

    it("is false when the room has no policy server", () => {
        expect(
            isPolicyRefusal({
                errcode: "M_FORBIDDEN",
                message: "Event was rejected by the room's policy server.",
                roomHasPolicyServer: false,
                userCanSend: true,
            }),
        ).toBe(false);
    });

    it("is true when the message mentions policy or spam", () => {
        expect(
            isPolicyRefusal({
                ...base,
                errcode: "M_FORBIDDEN",
                message: "Event was rejected by the room's policy server.",
            }),
        ).toBe(true);
        expect(
            isPolicyRefusal({
                ...base,
                errcode: "M_FORBIDDEN",
                message: "Detected as SPAM",
            }),
        ).toBe(true);
    });

    it("is true without a matching message when the user can send", () => {
        expect(
            isPolicyRefusal({
                errcode: "M_FORBIDDEN",
                message: "Forbidden",
                roomHasPolicyServer: true,
                userCanSend: true,
            }),
        ).toBe(true);
    });

    it("is false for a plain forbidden error when the user cannot send and no policy wording", () => {
        expect(
            isPolicyRefusal({
                errcode: "M_FORBIDDEN",
                message: "You are not allowed to send",
                roomHasPolicyServer: true,
                userCanSend: false,
            }),
        ).toBe(false);
    });

    it("is false when errcode and message are both missing", () => {
        expect(isPolicyRefusal({ ...base, userCanSend: true })).toBe(false);
    });
});

describe("summarizeServerAcl", () => {
    it("returns null for no ACL", () => {
        expect(summarizeServerAcl(null)).toBeNull();
        expect(summarizeServerAcl(undefined)).toBeNull();
    });

    it("returns null for the trivial allow-everything ACL", () => {
        expect(
            summarizeServerAcl({
                allow: ["*"],
                deny: [],
                allow_ip_literals: true,
            }),
        ).toBeNull();
        expect(summarizeServerAcl({ allow: ["*"] })).toBeNull();
    });

    it("summarises deny lists", () => {
        expect(
            summarizeServerAcl({
                allow: ["*"],
                deny: ["evil.com"],
                allow_ip_literals: true,
            }),
        ).toEqual({ allow: ["*"], deny: ["evil.com"], allowIpLiterals: true });
    });

    it("summarises an allow list and blocked IP literals", () => {
        expect(
            summarizeServerAcl({
                allow: ["matrix.org"],
                deny: [],
                allow_ip_literals: false,
            }),
        ).toEqual({ allow: ["matrix.org"], deny: [], allowIpLiterals: false });
    });

    it("treats an empty allow list as restrictive", () => {
        expect(summarizeServerAcl({ allow: [], deny: [] })).toEqual({
            allow: [],
            deny: [],
            allowIpLiterals: true,
        });
    });
});
