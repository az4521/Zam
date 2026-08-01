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

export interface ResumeRecord {
    beaconInfoEventId: string;
    expiresAt: number;
}

export interface ResumeBeacon {
    roomId: string;
    beaconInfoEventId: string;
    expiresAt: number;
}

export type ResumeAction =
    | {
          kind: "add";
          roomId: string;
          beaconInfoEventId: string;
          expiresAt: number;
      }
    | { kind: "refresh"; roomId: string; expiresAt: number };

/**
 * Reconcile the beacons the homeserver reports live against the records we
 * already hold.
 *
 * A room we hold nothing for is added. A room we hold the SAME beacon_info for
 * takes the deadline carried by the event: the beacon is judged live against
 * `m.beacon_info`'s own `org.matrix.msc3488.ts + timeout` (the SDK's liveness
 * check, and `getOwnLiveBeacons`, both evaluate exactly that sum). Our record's
 * `expiresAt` is a SECOND, independent `Date.now()` reading — `startShare`
 * takes it after the create round-trip returns, while the SDK stamped the
 * content before sending it — so it always sits slightly past the deadline the
 * beacon is actually measured by. Adopting the event's value makes our record
 * agree with the artefact everyone reads instead of with a private reading of
 * our own clock. It is NOT a cross-device skew correction: that stamp is
 * written by the sending client, and a beacon we hold a record for was sent by
 * this device, so both numbers come from the same clock.
 *
 * A room we hold a DIFFERENT beacon_info for is left completely alone: that is
 * a share this session started, or one whose stop we are still chasing, and the
 * server's view of it is simply older than ours. The stop state is never part
 * of the plan — `stop` records exist precisely because our live:false has not
 * landed, so the server reporting the beacon live is expected, not news.
 *
 * A record whose stop is pending or failed is re-timed too, on purpose: its
 * expiry timer is the only thing that ever retires that banner, so it has to
 * point at the deadline the beacon is judged by rather than at our own later
 * reading of it.
 */
export function planResume(
    existing: Iterable<[string, ResumeRecord]>,
    beacons: Iterable<ResumeBeacon>,
): ResumeAction[] {
    const have = new Map(existing);
    const actions: ResumeAction[] = [];
    for (const beacon of beacons) {
        const current = have.get(beacon.roomId);
        if (!current) {
            actions.push({
                kind: "add",
                roomId: beacon.roomId,
                beaconInfoEventId: beacon.beaconInfoEventId,
                expiresAt: beacon.expiresAt,
            });
            continue;
        }
        if (current.beaconInfoEventId !== beacon.beaconInfoEventId) continue;
        if (current.expiresAt !== beacon.expiresAt) {
            actions.push({
                kind: "refresh",
                roomId: beacon.roomId,
                expiresAt: beacon.expiresAt,
            });
        }
    }
    return actions;
}
