import { describe, it, expect } from "vitest";
import {
    VerificationPhaseValue,
    verificationPhaseKind,
    verificationPhaseLabel,
    deviceTrustBadge,
    userTrustBadge,
    formatSasEmojis,
    sasEmojiRows,
    type SasEmoji,
} from "./verification";

describe("verificationPhaseKind — coarse state for styling/logic", () => {
    it("treats Unsent/Requested/Ready as pending", () => {
        expect(verificationPhaseKind(VerificationPhaseValue.Unsent)).toBe(
            "pending",
        );
        expect(verificationPhaseKind(VerificationPhaseValue.Requested)).toBe(
            "pending",
        );
        expect(verificationPhaseKind(VerificationPhaseValue.Ready)).toBe(
            "pending",
        );
    });

    it("treats Started as active (SAS in flight)", () => {
        expect(verificationPhaseKind(VerificationPhaseValue.Started)).toBe(
            "active",
        );
    });

    it("maps Done to success and Cancelled to cancelled", () => {
        expect(verificationPhaseKind(VerificationPhaseValue.Done)).toBe(
            "success",
        );
        expect(verificationPhaseKind(VerificationPhaseValue.Cancelled)).toBe(
            "cancelled",
        );
    });

    it("falls back to pending for an unknown phase number", () => {
        expect(verificationPhaseKind(999)).toBe("pending");
    });
});

describe("verificationPhaseLabel — human wording, self vs other", () => {
    it("labels a completed self-verification as session verified", () => {
        expect(
            verificationPhaseLabel(VerificationPhaseValue.Done, {
                isSelf: true,
            }),
        ).toMatch(/session verified/i);
    });

    it("labels a completed user verification as user verified", () => {
        expect(
            verificationPhaseLabel(VerificationPhaseValue.Done, {
                isSelf: false,
            }),
        ).toMatch(/verified/i);
    });

    it("has distinct wording for cancelled and requested", () => {
        const cancelled = verificationPhaseLabel(
            VerificationPhaseValue.Cancelled,
        );
        const requested = verificationPhaseLabel(
            VerificationPhaseValue.Requested,
        );
        expect(cancelled).toMatch(/cancel/i);
        expect(requested).not.toBe(cancelled);
        expect(requested.length).toBeGreaterThan(0);
    });

    it("returns a non-empty string for every known phase", () => {
        for (const phase of Object.values(VerificationPhaseValue)) {
            expect(verificationPhaseLabel(phase).length).toBeGreaterThan(0);
        }
    });
});

describe("deviceTrustBadge — from a device verification status", () => {
    it("is Unverified when the status is null (never fetched)", () => {
        const badge = deviceTrustBadge(null);
        expect(badge.tone).toBe("unverified");
        expect(badge.label).toMatch(/unverified/i);
    });

    it("is Verified when the device is verified", () => {
        const badge = deviceTrustBadge({ isVerified: true });
        expect(badge.tone).toBe("verified");
        expect(badge.label).toMatch(/verified/i);
    });

    it("is Unverified when not verified even if signed by owner", () => {
        const badge = deviceTrustBadge({
            isVerified: false,
            signedByOwner: true,
        });
        expect(badge.tone).toBe("unverified");
    });
});

describe("userTrustBadge — from a user verification status", () => {
    it("is Unverified for an unknown/unverified user", () => {
        expect(userTrustBadge(null).tone).toBe("unverified");
        expect(userTrustBadge({ isVerified: false, known: false }).tone).toBe(
            "unverified",
        );
    });

    it("is Verified when cross-signing verified", () => {
        const badge = userTrustBadge({ isVerified: true });
        expect(badge.tone).toBe("verified");
        expect(badge.label).toMatch(/verified/i);
    });

    it("warns when the identity changed and needs approval, over verified", () => {
        const badge = userTrustBadge({
            isVerified: false,
            needsApproval: true,
            known: true,
        });
        expect(badge.tone).toBe("warning");
        expect(badge.label).toMatch(/identity/i);
    });
});

describe("formatSasEmojis — normalize the SDK emoji tuples", () => {
    it("maps [emoji, name] tuples to {symbol, name}", () => {
        const out = formatSasEmojis([
            ["🐶", "Dog"],
            ["🐱", "Cat"],
        ]);
        expect(out).toEqual([
            { symbol: "🐶", name: "Dog" },
            { symbol: "🐱", name: "Cat" },
        ]);
    });

    it("returns an empty array for undefined/empty input", () => {
        expect(formatSasEmojis(undefined)).toEqual([]);
        expect(formatSasEmojis([])).toEqual([]);
    });

    it("skips malformed tuples defensively", () => {
        const out = formatSasEmojis([
            ["🐶", "Dog"],
            // @ts-expect-error deliberately malformed
            ["🐱"],
            // @ts-expect-error deliberately malformed
            [undefined, "Nope"],
        ]);
        expect(out).toEqual([{ symbol: "🐶", name: "Dog" }]);
    });
});

describe("sasEmojiRows — grid layout for the 7 emojis", () => {
    const seven: SasEmoji[] = Array.from({ length: 7 }, (_, i) => ({
        symbol: String(i),
        name: `n${i}`,
    }));

    it("splits into rows of 4 by default (4 + 3)", () => {
        const rows = sasEmojiRows(seven);
        expect(rows.map((r) => r.length)).toEqual([4, 3]);
        expect(rows.flat()).toHaveLength(7);
    });

    it("respects a custom row size", () => {
        const rows = sasEmojiRows(seven, 3);
        expect(rows.map((r) => r.length)).toEqual([3, 3, 1]);
    });

    it("returns no rows for an empty list", () => {
        expect(sasEmojiRows([])).toEqual([]);
    });
});
