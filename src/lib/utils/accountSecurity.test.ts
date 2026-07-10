import { describe, it, expect } from "vitest";
import {
    validatePasswordChange,
    deactivationConfirmed,
    supportsPasswordUia,
} from "./accountSecurity";

describe("validatePasswordChange — can the change-password form be submitted?", () => {
    const fields = (current: string, next: string, confirm: string) => ({
        current,
        next,
        confirm,
    });

    it("accepts a well-formed change", () => {
        expect(
            validatePasswordChange(
                fields("old-pass", "new-pass-1", "new-pass-1"),
            ),
        ).toBeNull();
    });

    it("requires the current password", () => {
        expect(
            validatePasswordChange(fields("", "new-pass-1", "new-pass-1")),
        ).toBe("Enter your current password.");
    });

    it("requires a new password before complaining about the confirmation", () => {
        expect(validatePasswordChange(fields("old-pass", "", ""))).toBe(
            "Enter a new password.",
        );
    });

    it("rejects new passwords shorter than 8 characters", () => {
        expect(
            validatePasswordChange(fields("old-pass", "short", "short")),
        ).toBe("New password must be at least 8 characters.");
    });

    it("rejects reusing the current password", () => {
        expect(
            validatePasswordChange(
                fields("same-pass", "same-pass", "same-pass"),
            ),
        ).toBe("New password must be different from your current password.");
    });

    it("rejects a mismatched confirmation", () => {
        expect(
            validatePasswordChange(
                fields("old-pass", "new-pass-1", "new-pass-2"),
            ),
        ).toBe("Passwords do not match.");
    });

    it("does not trim passwords — whitespace is significant", () => {
        expect(
            validatePasswordChange(
                fields("old-pass", "new-pass-1", "new-pass-1 "),
            ),
        ).toBe("Passwords do not match.");
        expect(
            validatePasswordChange(
                fields("old-pass", " padded pw", " padded pw"),
            ),
        ).toBeNull();
    });
});

describe("deactivationConfirmed — typed confirmation must match the user id", () => {
    it("accepts the exact user id", () => {
        expect(
            deactivationConfirmed("@alice:example.org", "@alice:example.org"),
        ).toBe(true);
    });

    it("tolerates surrounding whitespace from copy-paste", () => {
        expect(
            deactivationConfirmed(
                "  @alice:example.org ",
                "@alice:example.org",
            ),
        ).toBe(true);
    });

    it("is case-sensitive — user ids are identifiers, not prose", () => {
        expect(
            deactivationConfirmed("@Alice:example.org", "@alice:example.org"),
        ).toBe(false);
    });

    it("rejects partial or empty input", () => {
        expect(deactivationConfirmed("@alice", "@alice:example.org")).toBe(
            false,
        );
        expect(deactivationConfirmed("", "@alice:example.org")).toBe(false);
    });

    it("never confirms when the user id is unknown", () => {
        expect(deactivationConfirmed("", null)).toBe(false);
        expect(deactivationConfirmed("", "")).toBe(false);
    });
});

describe("supportsPasswordUia — can we complete a UIA flow with just a password?", () => {
    it("accepts a single-stage password flow", () => {
        expect(supportsPasswordUia([{ stages: ["m.login.password"] }])).toBe(
            true,
        );
    });

    it("accepts it among other flows we cannot complete", () => {
        expect(
            supportsPasswordUia([
                { stages: ["m.login.sso", "m.login.recaptcha"] },
                { stages: ["m.login.password"] },
            ]),
        ).toBe(true);
    });

    it("rejects flows that require stages beyond a password", () => {
        expect(
            supportsPasswordUia([
                { stages: ["m.login.password", "m.login.recaptcha"] },
            ]),
        ).toBe(false);
    });

    it("rejects missing or empty flow lists", () => {
        expect(supportsPasswordUia(undefined)).toBe(false);
        expect(supportsPasswordUia([])).toBe(false);
    });
});
