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
    it("uses a usable key as it is", () => {
        expect(enableKeyStep({ keyReady: true, hasSecretStorage: true })).toBe(
            "ready",
        );
        expect(enableKeyStep({ keyReady: true, hasSecretStorage: false })).toBe(
            "ready",
        );
    });

    it("reads secret storage when the account has it, otherwise makes a device key", () => {
        expect(enableKeyStep({ keyReady: false, hasSecretStorage: true })).toBe(
            "load-key",
        );
        expect(
            enableKeyStep({ keyReady: false, hasSecretStorage: false }),
        ).toBe("create-key");
    });
});

describe("disableStep", () => {
    it("does nothing unless the mode is encrypted", () => {
        expect(disableStep({ mode: "plain", keyReady: true })).toBe("noop");
        expect(disableStep({ mode: "unknown", keyReady: true })).toBe("noop");
    });

    it("needs the key to decrypt before writing the plaintext back", () => {
        expect(disableStep({ mode: "encrypted", keyReady: true })).toBe(
            "write-plain",
        );
        expect(disableStep({ mode: "encrypted", keyReady: false })).toBe(
            "unlock",
        );
    });
});
