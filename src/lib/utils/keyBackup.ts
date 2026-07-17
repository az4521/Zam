/**
 * Pure helpers for the key-backup restore UI (Layer 3): turning the SDK's
 * restore-progress reports and backup-trust status into plain, testable
 * view-models. SDK-free (structural mirrors of the SDK shapes) so it unit-tests
 * without the rust-crypto WASM. The recovery-key string shape check lives in
 * `recoveryKey.ts` (`isLikelyRecoveryKey`); the authoritative decode/validate is
 * the SDK's `decodeRecoveryKey` + `secretStorage.checkKey`, driven from crypto.ts.
 */

/**
 * SDK-free mirror of matrix-js-sdk's `ImportRoomKeyProgressData` (the discriminated
 * union reported by `restoreKeyBackup`'s progressCallback).
 */
export type RestoreProgress =
    | { stage: "fetch" }
    | {
          stage: "load_keys";
          successes: number;
          failures: number;
          total: number;
      };

export interface RestoreProgressView {
    /** Human label for the current restore stage. */
    label: string;
    /** 0–100 integer, or null when the stage has no meaningful percentage. */
    percent: number | null;
}

/**
 * Map a restore-progress report to a label + percentage for the modal.
 * The percentage tracks *processed* keys (successes + failures) so the bar fills
 * even when some keys fail to decrypt; the label surfaces the successful count.
 */
export function restoreProgressView(
    progress: RestoreProgress | null,
): RestoreProgressView {
    if (!progress) return { label: "Preparing…", percent: null };
    if (progress.stage === "fetch") {
        return { label: "Fetching your encrypted history…", percent: null };
    }
    const { successes, total } = progress;
    if (total <= 0) {
        return { label: "Restoring your encrypted history…", percent: null };
    }
    const processed = progress.successes + progress.failures;
    const percent = Math.min(
        100,
        Math.max(0, Math.round((processed / total) * 100)),
    );
    return {
        label: `Restoring ${successes} of ${total} keys…`,
        percent,
    };
}

/** SDK-free mirror of `KeyBackupRestoreResult`. */
export interface RestoreResult {
    total: number;
    imported: number;
}

/** Final, human-readable summary of a completed restore. */
export function restoreResultLabel(result: RestoreResult): string {
    const { total, imported } = result;
    if (total <= 0) return "No encrypted history to restore";
    if (imported >= total) {
        return `${total} ${total === 1 ? "key" : "keys"} restored`;
    }
    return `${imported} of ${total} keys restored`;
}

/** Plain, SDK-free model of the account's key-backup posture. */
export interface BackupStatusModel {
    /** The server holds a backup for this account. */
    exists: boolean;
    /** This session is actively backing up to it (its key is loaded). */
    active: boolean;
    /** The backup carries a valid signature from a trusted device. */
    trusted: boolean;
    /** The active/known backup version, if any. */
    version: string | null;
}

export type BackupTone = "active" | "inactive" | "warning";

export interface BackupBadge {
    label: string;
    tone: BackupTone;
}

/** Short status badge for the backup row. */
export function backupBadge(model: BackupStatusModel): BackupBadge {
    if (!model.exists) return { label: "Not set up", tone: "inactive" };
    if (!model.trusted) return { label: "Not trusted", tone: "warning" };
    if (!model.active) return { label: "Not connected", tone: "warning" };
    return { label: "On", tone: "active" };
}

/** One-line descriptive summary for the backup row. */
export function backupSummaryLabel(model: BackupStatusModel): string {
    if (!model.exists) {
        return "Encrypted message history isn't being backed up. Set up recovery to protect it.";
    }
    if (!model.trusted) {
        return "A backup exists on the server but isn't trusted by this session yet.";
    }
    if (!model.active) {
        return "A backup exists but this session isn't connected to it. Enter your recovery key to restore your history.";
    }
    return model.version
        ? `Message history is being backed up (v${model.version}).`
        : "Message history is being backed up.";
}
