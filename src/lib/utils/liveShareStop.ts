/**
 * Pure decision logic for stopping a live-location share (MSC3672 beacons).
 *
 * The rule this file exists to enforce: a live share is only forgotten locally
 * once the server has ACKNOWLEDGED the `live:false` beacon_info write (or the
 * beacon has expired on its own). Clearing optimistically told the user they
 * had stopped broadcasting while the homeserver kept publishing their position
 * until the beacon timed out (audit finding LOC-01).
 *
 * No DOM, no SDK, no Svelte state — every input is plain data.
 */

/** `"stopping"` = a live:false write is in flight; `"failed"` = it was rejected
 *  and the server beacon is still live. A share with `stop === null` is
 *  broadcasting normally. */
export type StopPhase = "stopping" | "failed";

export interface StopState {
    phase: StopPhase;
    /** User-facing copy for the failed phase; null while stopping. */
    error: string | null;
}

export interface StopTarget {
    beaconInfoEventId: string | null;
    /** True when a write is already in flight for this room. */
    stopPending: boolean;
}

export type StopDecision =
    | { action: "absent" }
    | { action: "in-flight" }
    | { action: "send"; beaconInfoEventId: string | null };

/**
 * What a stop request should do.
 *
 * A `"failed"` share is NOT `in-flight`, so pressing Stop again (or an
 * automatic retry) re-sends — that is the retry path. Only a genuinely
 * in-flight write is suppressed, so a double-click cannot publish two
 * live:false events.
 */
export function decideStop(target: StopTarget | null): StopDecision {
    if (!target) return { action: "absent" };
    if (target.stopPending) return { action: "in-flight" };
    return { action: "send", beaconInfoEventId: target.beaconInfoEventId };
}

/** Shown when a stop write is rejected. Deliberately fixed copy: a raw
 *  MatrixError string tells the user nothing and leaks server detail. */
export const STOP_FAILED_MESSAGE =
    "Couldn't stop sharing your live location — it's still visible to this room. Tap Stop again to retry.";

export type StopOutcome =
    | { action: "drop" }
    | { action: "retain"; error: string };

/**
 * What to do after a stop write rejects.
 *
 * Past the beacon's own expiry the server has stopped broadcasting regardless
 * of whether live:false ever landed, so there is nothing left to warn about and
 * keeping the record would strand a permanent false "still sharing" banner.
 * Before expiry the beacon really is live: keep the record and tell the user.
 */
export function resolveStopFailure(
    expiresAt: number,
    now: number,
): StopOutcome {
    if (now >= expiresAt) return { action: "drop" };
    return { action: "retain", error: STOP_FAILED_MESSAGE };
}

/**
 * Split pending stops into the ones worth retrying and the ones whose beacon
 * expired while we were failing. Active shares (`stop === null`) are never
 * touched, and an in-flight write is left to settle on its own.
 */
export function pendingStopSweep(
    entries: Iterable<[string, { expiresAt: number; stop: StopState | null }]>,
    now: number,
): { retry: string[]; drop: string[] } {
    const retry: string[] = [];
    const drop: string[] = [];
    for (const [roomId, share] of entries) {
        if (!share.stop) continue;
        if (now >= share.expiresAt) drop.push(roomId);
        else if (share.stop.phase === "failed") retry.push(roomId);
    }
    return { retry, drop };
}

/** Banner copy for a share whose stop is pending or failed; null when healthy. */
export function stopStatusLabel(stop: StopState | null): string | null {
    if (!stop) return null;
    return stop.phase === "stopping"
        ? "Stopping…"
        : "Still sharing — couldn't stop";
}

/** Label for the stop/retry button in the banner and the map footer. */
export function stopButtonLabel(stop: StopState | null): string {
    if (!stop) return "Stop";
    return stop.phase === "stopping" ? "Stopping…" : "Retry stop";
}

const DOWN_STATES = new Set(["ERROR", "RECONNECTING"]);
const HEALTHY_STATES = new Set(["SYNCING", "CATCHUP", "PREPARED"]);

/**
 * True when a matrix-js-sdk sync-state transition means "we are talking to the
 * homeserver again". Values are `SyncState` from `matrix-js-sdk/lib/sync`
 * (ERROR / RECONNECTING / SYNCING / CATCHUP / PREPARED / STOPPED); they are
 * compared as strings so this file stays SDK-free.
 */
export function isSyncRecovery(
    state: string,
    prevState: string | null,
): boolean {
    if (prevState === null) return false;
    return DOWN_STATES.has(prevState) && HEALTHY_STATES.has(state);
}
