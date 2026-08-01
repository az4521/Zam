/**
 * Pure session-boundary logic for the live-location store.
 *
 * The store's state (`shares`, expiry timers, the geolocation watch) is module
 * scope, so it outlives any one logged-in session: AppShell unmounts on logout
 * or account switch and remounts for the next session against the SAME state.
 * Teardown is asynchronous — a best-effort `live:false` write per room, fired
 * without being awaited — so its continuations can land AFTER the next session
 * has adopted that state. Left unguarded, the teardown's sweep deletes a record
 * the next session deliberately kept, and the beacon it named goes on
 * broadcasting with no banner anywhere: audit finding LOC-01, pointing the
 * other way.
 *
 * Sessions are therefore numbered. Work captures the number it started under
 * and checks it before every mutation that follows an await or a timer.
 *
 * No DOM, no SDK, no Svelte state — every input is plain data.
 */

import { STOP_FAILED_MESSAGE, type StopState } from "./liveShareStop";

/**
 * May work that started in `startedEpoch` still mutate session state?
 *
 * False as soon as a newer session has begun: that session owns the records
 * now, and an older teardown knows nothing about what they mean to it.
 */
export function ownsSession(
    startedEpoch: number,
    currentEpoch: number,
): boolean {
    return startedEpoch === currentEpoch;
}

/**
 * The stop state a record inherited from a previous session must be adopted
 * with.
 *
 * `"stopping"` cannot survive the boundary: the write it refers to belongs to a
 * client this session cannot watch settle, and `decideStop` reads the phase as
 * in-flight, so Stop and Retry are both dead — the row would sit on a
 * "Stopping…" button until the beacon expired, up to eight hours later.
 * Demoting it to `"failed"` is the honest reading (we asked, nothing confirmed
 * it, the beacon may well still be live) and is the phase that offers Retry
 * stop. Every other state is already stable and is kept, identity included, so
 * adoption cannot churn a record that did not change.
 */
export function adoptInheritedStop(stop: StopState | null): StopState | null {
    if (stop?.phase === "stopping") {
        return { phase: "failed", error: STOP_FAILED_MESSAGE };
    }
    return stop;
}
