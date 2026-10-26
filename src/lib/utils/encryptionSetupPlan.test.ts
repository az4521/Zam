import { describe, expect, it } from "vitest";
import {
    planEncryptionSetup,
    type EncryptionPosture,
} from "./encryptionSetupPlan";

const base: EncryptionPosture = {
    read: "ok",
    backupRead: "ok",
    recoveryExists: false,
    thisDeviceVerified: false,
    backupExists: false,
    backupActive: false,
    crossSigningOnServer: false,
    crossSigningUnpublished: false,
};

describe("planEncryptionSetup", () => {
    it("waits for every read, including the server check", () => {
        expect(planEncryptionSetup({ ...base, read: null }).kind).toBe(
            "checking",
        );
        expect(
            planEncryptionSetup({ ...base, crossSigningOnServer: undefined })
                .kind,
        ).toBe("checking");
    });

    it("reports a failed read or server check as an error, never as fresh", () => {
        expect(planEncryptionSetup({ ...base, read: "error" }).kind).toBe(
            "error",
        );
        expect(
            planEncryptionSetup({ ...base, crossSigningOnServer: null }).kind,
        ).toBe("error");
    });

    it("sets up a brand-new account", () => {
        expect(planEncryptionSetup(base).kind).toBe("setup");
    });

    it("never sets up over another session's identity: verifies instead", () => {
        expect(
            planEncryptionSetup({ ...base, crossSigningOnServer: true }),
        ).toEqual({
            kind: "confirm",
            withRecoveryKey: false,
            withDevice: true,
        });
    });

    it("lets a verified session add recovery to an account without it", () => {
        expect(
            planEncryptionSetup({
                ...base,
                crossSigningOnServer: true,
                thisDeviceVerified: true,
            }).kind,
        ).toBe("setup");
    });

    it("offers the recovery key and another device to an unverified session", () => {
        expect(
            planEncryptionSetup({
                ...base,
                recoveryExists: true,
                crossSigningOnServer: true,
            }),
        ).toEqual({ kind: "confirm", withRecoveryKey: true, withDevice: true });
    });

    it("connects a verified session to a backup it isn't using", () => {
        expect(
            planEncryptionSetup({
                ...base,
                recoveryExists: true,
                crossSigningOnServer: true,
                thisDeviceVerified: true,
                backupExists: true,
            }).kind,
        ).toBe("connect-backup");
    });

    it("is done when everything lines up", () => {
        expect(
            planEncryptionSetup({
                ...base,
                recoveryExists: true,
                crossSigningOnServer: true,
                thisDeviceVerified: true,
                backupExists: true,
                backupActive: true,
            }).kind,
        ).toBe("done");
    });

    it("hands unpublished keys to settings", () => {
        expect(
            planEncryptionSetup({ ...base, crossSigningUnpublished: true })
                .kind,
        ).toBe("advanced");
    });
});
