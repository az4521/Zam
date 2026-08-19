import { describe, it, expect } from "vitest";
import { reconcileVerification } from "./verificationStatus";

describe("reconcileVerification", () => {
    it("ready + cross-signed device is the only bare 'verified'", () => {
        const v = reconcileVerification({
            deviceTrust: { isVerified: true },
            setupState: "ready",
        });
        expect(v.kind).toBe("verified");
        expect(v.tone).toBe("verified");
        expect(v.actionable).toBe(false);
    });

    it("ready is verified regardless of the device-trust shape", () => {
        expect(
            reconcileVerification({ deviceTrust: null, setupState: "ready" })
                .kind,
        ).toBe("verified");
    });

    it("az case: locally-verified device with partial setup reads needs-setup, NOT verified", () => {
        const v = reconcileVerification({
            deviceTrust: { isVerified: true, signedByOwner: false },
            setupState: "partial",
        });
        expect(v.kind).toBe("needs-setup");
        expect(v.actionable).toBe(true);
        expect(v.actionLabel).toBe("Finish setup");
    });

    it("partial + unverified device reads unverified (verify this session)", () => {
        const v = reconcileVerification({
            deviceTrust: { isVerified: false },
            setupState: "partial",
        });
        expect(v.kind).toBe("unverified");
        expect(v.actionLabel).toBe("Verify");
    });

    it("partial + null device trust reads unverified", () => {
        expect(
            reconcileVerification({ deviceTrust: null, setupState: "partial" })
                .kind,
        ).toBe("unverified");
    });

    it("fresh account reads needs-setup", () => {
        const v = reconcileVerification({
            deviceTrust: null,
            setupState: "fresh",
        });
        expect(v.kind).toBe("needs-setup");
        expect(v.actionLabel).toBe("Set up");
    });

    it.each(["loading", "unavailable", "read-failed"] as const)(
        "%s reads unavailable and is never actionable",
        (setupState) => {
            const v = reconcileVerification({
                deviceTrust: { isVerified: true },
                setupState,
            });
            expect(v.kind).toBe("unavailable");
            expect(v.actionable).toBe(false);
            expect(v.actionLabel).toBeNull();
            expect(v.tone).toBe("neutral");
        },
    );

    it("every actionable view carries a non-null actionLabel; every non-actionable a null one", () => {
        const states = [
            "loading",
            "unavailable",
            "read-failed",
            "fresh",
            "partial",
            "ready",
        ] as const;
        for (const setupState of states) {
            for (const dt of [
                null,
                { isVerified: true },
                { isVerified: false },
            ]) {
                const v = reconcileVerification({
                    deviceTrust: dt,
                    setupState,
                });
                expect(
                    v.actionable
                        ? v.actionLabel !== null
                        : v.actionLabel === null,
                ).toBe(true);
            }
        }
    });
});
