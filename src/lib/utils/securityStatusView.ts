/**
 * Pure model for the Security settings panel.
 *
 * The point is honesty (audit CRYPTO-02): a failed crypto/backup read used to
 * come back as "available, and nothing is set up", which is exactly what a
 * brand-new account looks like — so Settings invited the user to set up (or
 * reset!) recovery over working keys. Read outcome is therefore a first-class
 * discriminant here, and destructive actions are gated on it.
 */

/** Outcome of one status read. */
export type SecurityRead = "ok" | "unavailable" | "error";

export interface SecurityPosture {
    /** Outcome of the last `getSecurityStatus()`; null before the first read. */
    read: SecurityRead | null;
    /** Outcome of the last `getBackupStatus()`; null before the first read. */
    backupRead: SecurityRead | null;
    secretStorageReady: boolean;
    defaultKeyId: string | null;
    thisDeviceVerified: boolean;
    backupExists: boolean;
    backupActive: boolean;
    /** True when an earlier SUCCESSFUL read is still what's on screen. */
    hasLastGood: boolean;
}

export type SecuritySetupState =
    /** No read has come back yet. */
    | "loading"
    /** rust-crypto isn't initialised on this session. */
    | "unavailable"
    /** A read threw — the posture below it is not trustworthy. */
    | "read-failed"
    /** Authoritative: this account has no recovery at all. */
    | "fresh"
    /** Authoritative: recovery exists but something is incomplete here. */
    | "partial"
    /** Authoritative: recovery, this session and the backup all line up. */
    | "ready";

export function securitySetupState(p: SecurityPosture): SecuritySetupState {
    if (p.read === null || p.backupRead === null) return "loading";
    if (p.read === "unavailable" || p.backupRead === "unavailable") {
        return "unavailable";
    }
    if (p.read === "error" || p.backupRead === "error") return "read-failed";
    const recoveryExists = p.secretStorageReady || p.defaultKeyId !== null;
    if (!recoveryExists) return "fresh";
    const complete =
        p.secretStorageReady &&
        p.thisDeviceVerified &&
        (!p.backupExists || p.backupActive);
    return complete ? "ready" : "partial";
}

const READ_FAILED_NOTICE =
    "Couldn't read this account's encryption status. Nothing here is reliable until it loads — don't set up or reset recovery yet.";
const UNAVAILABLE_NOTICE =
    "Encryption isn't ready on this session yet. Reload if this persists.";

export interface SecurityPanelView {
    state: SecuritySetupState;
    /** The status rows reflect a successful read, not a guess. */
    authoritative: boolean;
    /** We're showing an older successful read because the latest one failed. */
    stale: boolean;
    /** Set-up / reset may be offered. False unless the read is authoritative. */
    allowDestructive: boolean;
    /** Banner copy, or null when there's nothing to say. */
    notice: string | null;
}

export function securityPanelView(p: SecurityPosture): SecurityPanelView {
    const state = securitySetupState(p);
    const authoritative =
        state === "fresh" || state === "partial" || state === "ready";
    return {
        state,
        authoritative,
        stale: state === "read-failed" && p.hasLastGood,
        allowDestructive: authoritative,
        notice:
            state === "read-failed"
                ? READ_FAILED_NOTICE
                : state === "unavailable"
                  ? UNAVAILABLE_NOTICE
                  : null,
    };
}
