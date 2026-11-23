/**
 * Progress of the background key-backup restore started after an unlock
 * (crypto.ts `completeUnlock`). The unlock itself returns as soon as this
 * session is verified and the backup key is cached: from then on the SDK
 * fetches any missing key from the backup on demand, so visible messages
 * decrypt without waiting. The full restore runs on behind it so search and
 * older history have every key; this store is what the UI shows meanwhile.
 */
import type { RestoreProgress } from "$lib/utils/keyBackup";

class KeyRestoreState {
    /** A restore is running for the current account. */
    running = $state(false);
    /** Latest SDK progress report, null before the first. */
    progress = $state<RestoreProgress | null>(null);
    /** Outcome of the last finished restore, null while none has finished. */
    result = $state<{ total: number; imported: number } | null>(null);
}

export const keyRestoreState = new KeyRestoreState();

export function beginKeyRestore(): void {
    keyRestoreState.running = true;
    keyRestoreState.progress = null;
    keyRestoreState.result = null;
}

export function setKeyRestoreProgress(progress: RestoreProgress): void {
    if (keyRestoreState.running) keyRestoreState.progress = progress;
}

/** Ends the run; `result` is null when it failed or was abandoned. */
export function endKeyRestore(
    result: { total: number; imported: number } | null,
): void {
    keyRestoreState.running = false;
    keyRestoreState.progress = null;
    keyRestoreState.result = result;
}
