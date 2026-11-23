import { describe, it, expect } from "vitest";
import {
    disableStep,
    enableKeyStep,
    enableStep,
    modeFromServer,
} from "./favouritesMode";

describe("modeFromServer", () => {
    it("is encrypted exactly when the server holds an encrypted event", () => {
        expect(modeFromServer(true)).toBe("encrypted");
        expect(modeFromServer(false)).toBe("plain");
    });
});

describe("enableStep", () => {
    it("proceeds from plain, does nothing when already encrypted, refuses while unknown", () => {
        expect(enableStep("plain")).toBe("proceed");
        expect(enableStep("encrypted")).toBe("noop");
        expect(enableStep("unknown")).toBe("refuse");
    });
});

describe("enableKeyStep", () => {
    const base = {
        keyReady: false,
        hasSecretStorage: true,
        secretStorageUnlocked: false,
        deviceVerified: false,
    };

    it("uses a usable key as it is", () => {
        expect(enableKeyStep({ ...base, keyReady: true })).toBe("ready");
        expect(
            enableKeyStep({ ...base, keyReady: true, hasSecretStorage: false }),
        ).toBe("ready");
    });

    it("makes a device key when the account has no secret storage", () => {
        expect(enableKeyStep({ ...base, hasSecretStorage: false })).toBe(
            "create-key",
        );
    });

    it("reads secret storage when it is unlocked here", () => {
        expect(
            enableKeyStep({
                ...base,
                secretStorageUnlocked: true,
                deviceVerified: true,
            }),
        ).toBe("load-key");
    });

    it("needs no recovery key on a verified session", () => {
        expect(enableKeyStep({ ...base, deviceVerified: true })).toBe(
            "create-key",
        );
    });

    it("asks an unverified session with locked secret storage to unlock", () => {
        expect(enableKeyStep(base)).toBe("load-key");
    });
});
