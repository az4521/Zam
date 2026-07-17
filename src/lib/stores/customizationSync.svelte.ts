// Mirrors the Customization panel's settings to the homeserver as account
// data under `moe.crafty.matrix.customization`, so they follow the account
// across devices the way favourite GIFs already do.
//
// Model: the server is the source of truth once a sync lands; localStorage
// remains the synchronous boot cache, so a cold start paints the right theme
// with no flash and an offline boot keeps working. On conflict the last
// device to write a setting wins — there is no per-field merge.

import {
    getClient,
    isInitialSyncComplete,
    loadCustomization,
    persistCustomization,
    onAccountData,
    onSyncPrepared,
} from "$lib/matrix/client";
import {
    applyCustomization,
    customizationSnapshot,
    setCustomizationListener,
} from "$lib/stores/settings.svelte";

/** Coalesce bursts of changes (dragging a slider, typing a date pattern)
 *  into one PUT rather than one per keystroke. */
const UPLOAD_DEBOUNCE_MS = 500;

/** Serialized form of the last payload we sent or received. Guards the echo:
 *  our own upload comes back as an account-data event, which would otherwise
 *  apply → notify → upload → … forever. */
let lastSynced: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function upload(): void {
    // Before login there is nowhere to write. Don't record the payload as
    // synced either, or the seeding pull once sync lands would no-op.
    if (!getClient()) return;
    const snapshot = customizationSnapshot();
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastSynced) return;
    lastSynced = serialized;
    persistCustomization(snapshot).catch((err) => {
        // Forget the payload so the next change retries rather than being
        // skipped as already-synced. Uploads are full snapshots, not deltas,
        // so a later upload subsumes this failed one.
        lastSynced = null;
        console.error("Failed to sync customization settings", err);
    });
}

function scheduleUpload(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
        timer = null;
        upload();
    }, UPLOAD_DEBOUNCE_MS);
}

function pull(): void {
    const remote = loadCustomization();
    if (!remote) {
        // Absent, or simply not synced yet? Before the initial sync completes
        // the account-data store is empty, and seeding from this device's
        // cache here would upload stale local values over whatever another
        // device saved — silently losing that change on every cold boot. Only
        // seed once we know the event is genuinely absent; the sync-PREPARED
        // pull comes back through here to do it.
        if (!isInitialSyncComplete()) return;
        // First run on this account: nothing on the server. Seed from local so
        // existing settings are adopted rather than dropped. Clearing
        // lastSynced first matters after an account switch, where it still
        // holds the previous account's payload and would suppress the seed.
        lastSynced = null;
        upload();
        return;
    }
    lastSynced = JSON.stringify(remote);
    applyCustomization(remote);
    // The server may hold a subset (older build, partial write). Our snapshot
    // is then a superset, and the next local change uploads it in full.
}

/** Call once on app mount. Returns a cleanup function. */
export function initCustomizationSync(): () => void {
    // Pull immediately in case sync already completed before this ran.
    pull();

    const unsubSync = onSyncPrepared(pull);
    const unsubAccount = onAccountData((type) => {
        if (type === "moe.crafty.matrix.customization") pull();
    });
    setCustomizationListener(scheduleUpload);

    return () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        setCustomizationListener(null);
        lastSynced = null;
        unsubSync();
        unsubAccount();
    };
}
