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

/**
 * The extra key-backup facts the SDK already computes but the UI discarded:
 * the server's session count, this session's upload queue, and whether the
 * loaded backup key actually matches the server's backup.
 */
export interface BackupDetail {
    /** The server holds a backup for this account. */
    exists: boolean;
    /** This session is actively backing up to it. */
    active: boolean;
    /** The loaded backup decryption key matches the server backup. */
    matchesDecryptionKey: boolean;
    /** Sessions stored server-side (`KeyBackupInfo.count`), null if unreported. */
    count: number | null;
    /** Sessions this client still has to upload, null until the SDK reports. */
    sessionsRemaining: number | null;
}

/**
 * Detail lines for the backup panel, in display order. Empty when there is no
 * backup (the summary line already says so) — every line here is additive
 * detail, never the only thing shown.
 */
export function backupDetailLines(detail: BackupDetail): string[] {
    if (!detail.exists) return [];
    const lines: string[] = [];
    const { count, sessionsRemaining } = detail;
    if (count != null) {
        if (count <= 0) lines.push("No keys backed up yet");
        else lines.push(`${count} ${count === 1 ? "key" : "keys"} backed up`);
    }
    if (sessionsRemaining != null) {
        if (sessionsRemaining > 0) {
            lines.push(
                `${sessionsRemaining} ${
                    sessionsRemaining === 1 ? "key" : "keys"
                } still to upload`,
            );
        } else {
            lines.push("Everything on this session is backed up");
        }
    }
    // Only meaningful while this session is connected to the backup: an
    // unconnected session has no loaded key to compare in the first place.
    if (detail.active && !detail.matchesDecryptionKey) {
        lines.push(
            "This session's backup key doesn't match the backup on the server",
        );
    }
    return lines;
}

/** How many characters of a 4S key id to show before eliding. */
const KEY_ID_VISIBLE = 8;

/** Short, human-safe rendering of the account's default secret-storage key id. */
export function secretStorageKeyLabel(defaultKeyId: string | null): string {
    if (!defaultKeyId) return "Not set";
    return defaultKeyId.length > KEY_ID_VISIBLE
        ? `${defaultKeyId.slice(0, KEY_ID_VISIBLE)}…`
        : defaultKeyId;
}
