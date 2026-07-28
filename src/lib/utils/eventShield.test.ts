import { describe, it, expect } from "vitest";
import {
    EventShieldColourValue,
    EventShieldReasonValue,
    sameShield,
    shieldView,
    shieldViewForEvent,
} from "./eventShield";

describe("shieldView", () => {
    it("returns null for NONE — a healthy message shows no shield", () => {
        // NONE is 0 and therefore falsy: this asserts the explicit comparison.
        expect(shieldView(EventShieldColourValue.NONE, null)).toBeNull();
        expect(
            shieldView(
                EventShieldColourValue.NONE,
                EventShieldReasonValue.UNSIGNED_DEVICE,
            ),
        ).toBeNull();
    });

    it("maps GREY to a muted warning shield", () => {
        const view = shieldView(
            EventShieldColourValue.GREY,
            EventShieldReasonValue.UNSIGNED_DEVICE,
        );
        expect(view).toEqual({
            icon: "shield-alert",
            tone: "warning",
            label: "Encrypted by a device not verified by its owner.",
        });
    });

    it("maps RED to a danger shield", () => {
        const view = shieldView(
            EventShieldColourValue.RED,
            EventShieldReasonValue.VERIFICATION_VIOLATION,
        );
        expect(view).toEqual({
            icon: "shield-x",
            tone: "danger",
            label: "The sender was previously verified but changed their identity.",
        });
    });

    it("gives every live reason code its own label", () => {
        const live = [
            EventShieldReasonValue.UNKNOWN,
            EventShieldReasonValue.UNVERIFIED_IDENTITY,
            EventShieldReasonValue.UNSIGNED_DEVICE,
            EventShieldReasonValue.UNKNOWN_DEVICE,
            EventShieldReasonValue.AUTHENTICITY_NOT_GUARANTEED,
            EventShieldReasonValue.VERIFICATION_VIOLATION,
            EventShieldReasonValue.MISMATCHED_SENDER,
        ];
        const labels = live.map(
            (r) => shieldView(EventShieldColourValue.GREY, r)!.label,
        );
        expect(new Set(labels).size).toBe(live.length);
        expect(labels.every((l) => l.length > 0)).toBe(true);
    });

    it("falls back to a generic label for an unknown or absent reason", () => {
        const noReason = shieldView(EventShieldColourValue.GREY, null);
        expect(noReason?.label).toBe(
            "This message's encryption could not be fully verified.",
        );
        // 5 and 6 are the SDK's deprecated, dead reason codes; 99 is out of range.
        expect(shieldView(EventShieldColourValue.GREY, 5)?.label).toBe(
            noReason?.label,
        );
        expect(shieldView(EventShieldColourValue.GREY, 6)?.label).toBe(
            noReason?.label,
        );
        expect(shieldView(EventShieldColourValue.GREY, 99)?.label).toBe(
            noReason?.label,
        );
    });

    it("returns null for an unrecognised colour rather than guessing", () => {
        expect(shieldView(7, EventShieldReasonValue.UNKNOWN_DEVICE)).toBeNull();
    });
});

describe("shieldViewForEvent", () => {
    const grey = {
        colour: EventShieldColourValue.GREY,
        reason: EventShieldReasonValue.UNKNOWN_DEVICE,
    };

    it("shows nothing in an unencrypted room even if info somehow arrives", () => {
        expect(
            shieldViewForEvent({ roomEncrypted: false, info: grey }),
        ).toBeNull();
    });

    it("shows nothing when there is no encryption info yet", () => {
        expect(
            shieldViewForEvent({ roomEncrypted: true, info: null }),
        ).toBeNull();
    });

    it("shows the shield in an encrypted room with a warning colour", () => {
        expect(shieldViewForEvent({ roomEncrypted: true, info: grey })).toEqual(
            {
                icon: "shield-alert",
                tone: "warning",
                label: "Encrypted by an unknown or deleted device.",
            },
        );
    });
});

describe("sameShield", () => {
    const grey = {
        colour: EventShieldColourValue.GREY,
        reason: EventShieldReasonValue.UNKNOWN_DEVICE,
    };
    const red = {
        colour: EventShieldColourValue.RED,
        reason: EventShieldReasonValue.VERIFICATION_VIOLATION,
    };

    it("treats two independently built views of the same shield as equal", () => {
        const a = shieldViewForEvent({ roomEncrypted: true, info: grey });
        const b = shieldViewForEvent({ roomEncrypted: true, info: grey });
        // The point of the helper: distinct objects, same value.
        expect(a).not.toBe(b);
        expect(sameShield(a, b)).toBe(true);
    });

    it("treats two nulls as equal so an unshielded row never re-renders", () => {
        expect(sameShield(null, null)).toBe(true);
    });

    it("reports a change when a shield appears or disappears", () => {
        const a = shieldViewForEvent({ roomEncrypted: true, info: grey });
        expect(sameShield(a, null)).toBe(false);
        expect(sameShield(null, a)).toBe(false);
    });

    it("reports a change when the severity changes", () => {
        const a = shieldViewForEvent({ roomEncrypted: true, info: grey });
        const b = shieldViewForEvent({ roomEncrypted: true, info: red });
        expect(sameShield(a, b)).toBe(false);
    });

    it("reports a change when only the label differs", () => {
        const a = shieldView(
            EventShieldColourValue.GREY,
            EventShieldReasonValue.UNKNOWN_DEVICE,
        );
        const b = shieldView(
            EventShieldColourValue.GREY,
            EventShieldReasonValue.UNSIGNED_DEVICE,
        );
        // Same icon and tone — only the explanation moved.
        expect(a!.icon).toBe(b!.icon);
        expect(a!.tone).toBe(b!.tone);
        expect(sameShield(a, b)).toBe(false);
    });
});
