/**
 * Which screen the guided encryption setup opens on, from the account's
 * posture. Pure, so the rules are testable without the SDK.
 *
 * The one rule that matters most: never offer "set up recovery" to an
 * unverified session on an account that already has a cross-signing
 * identity. Setup there would mint a new identity over the old one, and
 * every device the user verified before would turn untrusted. That account
 * verifies (another device, or the recovery key) first.
 */

import type { SecurityRead } from "./securityStatusView";

export interface EncryptionPosture {
    /** Outcome of getSecurityStatus / getBackupStatus; null before a read. */
    read: SecurityRead | null;
    backupRead: SecurityRead | null;
    /** A default secret-storage key exists ("recovery is set up"). */
    recoveryExists: boolean;
    thisDeviceVerified: boolean;
    backupExists: boolean;
    backupActive: boolean;
    /** Server answer to "does this account have cross-signing"; undefined = not asked yet. */
    crossSigningOnServer: boolean | null | undefined;
    /** This session holds keys the server never got (settings repairs that). */
    crossSigningUnpublished: boolean;
}

export type EncryptionSetupPlan =
    /** Still reading. */
    | { kind: "checking" }
    /** Encryption isn't running on this session at all. */
    | { kind: "unavailable" }
    /** A read failed; nothing below would be trustworthy. */
    | { kind: "error" }
    /** Everything lines up. */
    | { kind: "done" }
    /** No recovery yet, and nothing to verify against: create it. */
    | { kind: "setup" }
    /** Prove this session belongs to the account. */
    | { kind: "confirm"; withRecoveryKey: boolean; withDevice: boolean }
    /** Verified, but this session isn't connected to the message backup. */
    | { kind: "connect-backup" }
    /** An unusual state the Security settings page handles. */
    | { kind: "advanced" };

export function planEncryptionSetup(p: EncryptionPosture): EncryptionSetupPlan {
    if (
        p.read === null ||
        p.backupRead === null ||
        p.crossSigningOnServer === undefined
    )
        return { kind: "checking" };
    if (p.read === "unavailable" || p.backupRead === "unavailable")
        return { kind: "unavailable" };
    if (
        p.read === "error" ||
        p.backupRead === "error" ||
        p.crossSigningOnServer === null
    )
        return { kind: "error" };
    if (p.crossSigningUnpublished) return { kind: "advanced" };

    if (p.recoveryExists) {
        if (!p.thisDeviceVerified)
            return {
                kind: "confirm",
                withRecoveryKey: true,
                withDevice: p.crossSigningOnServer,
            };
        if (p.backupExists && !p.backupActive)
            return { kind: "connect-backup" };
        return { kind: "done" };
    }
    if (p.crossSigningOnServer && !p.thisDeviceVerified)
        return { kind: "confirm", withRecoveryKey: false, withDevice: true };
    return { kind: "setup" };
}
