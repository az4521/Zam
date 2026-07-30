import {
    startLiveBeacon,
    stopLiveBeacon,
    sendLiveBeaconLocation,
    canShareLiveBeacon,
    getRoom,
    getOwnLiveBeacons,
    onBeaconUpdate,
    onSyncPrepared,
    onSyncReconnected,
} from "$lib/matrix/client";
import { shouldSendUpdate } from "$lib/utils/liveLocation";
import {
    geoErrorMessage,
    geolocationUnavailableMessage,
} from "$lib/utils/geoErrors";
import {
    decideStop,
    resolveStopFailure,
    pendingStopSweep,
    STOP_FAILED_MESSAGE,
    STOP_WATCHDOG_MS,
    type StopState,
} from "$lib/utils/liveShareStop";
import { showErrorToast } from "$lib/stores/toasts.svelte";

export interface ShareState {
    beaconInfoEventId: string;
    expiresAt: number;
    lastSentTs: number | null;
    /** null = broadcasting; set once Stop has been requested. The record lives
     *  on until the server acknowledges live:false or the beacon expires. */
    stop: StopState | null;
}

export const liveLocationState = $state<{
    beaconTick: number;
    shares: Map<string, ShareState>;
}>({ beaconTick: 0, shares: new Map() });

const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();
/** Identity of the live:false write a room currently owns. Every retry mints a
 *  new token, so an attempt that settles late can tell that the state it is
 *  about to touch belongs to a newer attempt (or to no attempt at all) and keep
 *  its hands off. Kept out of ShareState: it is bookkeeping, not view data. */
const stopAttempts = new Map<string, object>();
let watchId: number | null = null;

function bump() {
    liveLocationState.beaconTick++;
}

export function isSharingLive(roomId: string): boolean {
    void liveLocationState.beaconTick;
    return liveLocationState.shares.has(roomId);
}

export function shareStateFor(roomId: string): ShareState | null {
    void liveLocationState.beaconTick;
    return liveLocationState.shares.get(roomId) ?? null;
}

function isSecureContext(): boolean {
    return typeof window !== "undefined" && window.isSecureContext;
}

function hasGeolocation(): boolean {
    return typeof navigator !== "undefined" && !!navigator.geolocation;
}

function ensureWatch() {
    if (watchId !== null) return;
    if (!hasGeolocation()) {
        // No geolocation at all (or resumed on a platform without it):
        // don't leave phantom "active" shares idling forever — stop them
        // and tell the user why, same as a watch error would.
        for (const roomId of Array.from(liveLocationState.shares.keys())) {
            void stopShare(roomId);
        }
        showErrorToast(geolocationUnavailableMessage(isSecureContext()));
        return;
    }
    // NO `timeout` here: a watch with a timeout fires TIMEOUT (code 3)
    // whenever the position simply hasn't changed (standing still, GPS
    // shadow) — a long-running share must wait indefinitely for the next
    // fix, not error out. The one-shot probe in acquirePosition keeps its
    // timeout; that one exists to give the share dialog fast feedback.
    watchId = navigator.geolocation.watchPosition(onPosition, onGeoError, {
        enableHighAccuracy: true,
        maximumAge: 10000,
    });
}

/** A share still publishing positions. A pending or failed stop is not one:
 *  the user asked to stop, so we stop sending regardless of the server's state. */
function hasActiveBroadcast(): boolean {
    for (const share of liveLocationState.shares.values()) {
        if (!share.stop) return true;
    }
    return false;
}

function clearWatchIfIdle() {
    if (watchId !== null && !hasActiveBroadcast()) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
}

/**
 * The beacon's own deadline. Past it the homeserver has stopped broadcasting
 * whether or not our live:false ever landed, so the record has nothing left to
 * warn about: send one best-effort write to tidy the room's state, then retire
 * the record unconditionally. Retiring here rather than on the write's outcome
 * is what stops a stop request that HANGS (rather than rejecting) from
 * stranding a "Stopping…" banner with no timer left to clear it.
 */
function onExpiry(roomId: string) {
    if (!liveLocationState.shares.has(roomId)) return;
    void attemptStop(roomId, false);
    dropShare(roomId);
}

/** (Re-)arm the expiry backstop. Also retires a failed stop's banner: exactly
 *  one timer per room, always pointing at the beacon's real death. */
function armExpiryTimer(roomId: string, expiresAt: number) {
    const existing = expiryTimers.get(roomId);
    if (existing) clearTimeout(existing);
    expiryTimers.set(
        roomId,
        setTimeout(() => onExpiry(roomId), Math.max(0, expiresAt - Date.now())),
    );
}

/** Forget a share entirely — only ever after the server acknowledged the stop
 *  or the beacon expired. */
function dropShare(roomId: string) {
    const timer = expiryTimers.get(roomId);
    if (timer) {
        clearTimeout(timer);
        expiryTimers.delete(roomId);
    }
    stopAttempts.delete(roomId);
    liveLocationState.shares.delete(roomId);
    bump();
    clearWatchIfIdle();
}

function onPosition(pos: GeolocationPosition) {
    const now = Date.now();
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    for (const [roomId, share] of liveLocationState.shares) {
        if (share.stop) continue; // Stop pressed: publish nothing more.
        if (!shouldSendUpdate(share.lastSentTs, now)) continue;
        share.lastSentTs = now;
        sendLiveBeaconLocation(roomId, share.beaconInfoEventId, lat, lon).catch(
            () => {
                // Offline blip: keep watching, retry on the next fix.
                share.lastSentTs = null;
            },
        );
    }
    bump();
}

function onGeoError(err: GeolocationPositionError) {
    // Only a real permission revocation ends the share. Transient errors
    // (no fix / timeout) are routine — Android Chrome emits sporadic
    // POSITION_UNAVAILABLE blips even with GPS on, and a stationary device
    // may not re-fire the watch for a long time. The banner's "last updated
    // at …" label makes staleness visible without a scary error state, so
    // transient errors are deliberately ignored here.
    if (err?.code !== 1) return;
    const msg = geoErrorMessage(err, isSecureContext());
    for (const roomId of Array.from(liveLocationState.shares.keys())) {
        void stopShare(roomId);
    }
    showErrorToast(msg);
}

/** One-shot position fix, promisified. Fires the permission prompt. */
function acquirePosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 30000,
        });
    });
}

/** Begin sharing our live location into `roomId` for `durationMs`. */
export async function startShare(
    roomId: string,
    durationMs: number,
): Promise<void> {
    if (liveLocationState.shares.has(roomId)) return;
    const room = getRoom(roomId);
    if (!room || !canShareLiveBeacon(room)) {
        showErrorToast("You can't share live location in this room.");
        return;
    }
    if (!hasGeolocation()) {
        showErrorToast(geolocationUnavailableMessage(isSecureContext()));
        return;
    }
    // Acquire a first fix BEFORE publishing m.beacon_info: the permission
    // prompt fires while the dialog is still open, and a denial leaves no
    // stray beacon start/stop pair behind.
    let firstFix: GeolocationPosition;
    try {
        firstFix = await acquirePosition();
    } catch (err) {
        showErrorToast(
            geoErrorMessage(
                err as GeolocationPositionError | null,
                isSecureContext(),
            ),
        );
        return;
    }
    let beaconInfoEventId: string;
    try {
        ({ beaconInfoEventId } = await startLiveBeacon(roomId, durationMs));
    } catch (err) {
        showErrorToast(
            err instanceof Error ? err.message : "Couldn't start live location",
        );
        return;
    }
    const expiresAt = Date.now() + durationMs;
    liveLocationState.shares.set(roomId, {
        beaconInfoEventId,
        expiresAt,
        lastSentTs: null,
        stop: null,
    });
    armExpiryTimer(roomId, expiresAt);
    ensureWatch();
    // Send the fix we already have instead of waiting for the watch's
    // first callback (keeps the first-fix-immediate behavior).
    onPosition(firstFix);
    bump();
}

/**
 * Stop our live share in `roomId` (rewrites beacon_info live:false).
 *
 * The local record is NOT cleared optimistically: until the homeserver
 * acknowledges the write, the beacon is still broadcasting our last position,
 * and telling the user otherwise is the exact failure LOC-01 describes. We do
 * stop publishing new positions immediately — that part is local and cannot
 * fail. Never rejects: callers are click handlers.
 */
export async function stopShare(roomId: string): Promise<void> {
    await attemptStop(roomId, true);
}

async function attemptStop(roomId: string, toast: boolean): Promise<void> {
    const share = liveLocationState.shares.get(roomId) ?? null;
    const decision = decideStop(
        share
            ? {
                  // Capture the beacon_info id BEFORE the write: if the user
                  // stopped in the sync race right after starting, the
                  // beacon_info isn't in currentState yet, so stopLiveBeacon
                  // can't find it there — pass the known id so it still writes
                  // live:false instead of no-op'ing.
                  beaconInfoEventId: share.beaconInfoEventId,
                  stopPending: share.stop?.phase === "stopping",
              }
            : null,
    );
    if (!share || decision.action !== "send") return;

    // Identity + deadline of the record we are stopping, taken before the
    // await: by the time the write settles this room may hold a DIFFERENT
    // share (teardown swept it and the user started a new one) and `share` is
    // a stale reference into the old map.
    const stoppingId = share.beaconInfoEventId;
    const expiresAt = share.expiresAt;
    const attempt = {};
    stopAttempts.set(roomId, attempt);
    share.stop = { phase: "stopping", error: null };
    bump();
    clearWatchIfIdle();

    /** The record this attempt is allowed to touch, or null once it isn't. */
    const ourShare = (): ShareState | null => {
        // A newer attempt (the user pressed Retry after the watchdog gave up)
        // owns the room now; this one must not write over its state.
        if (stopAttempts.get(roomId) !== attempt) return null;
        const cur = liveLocationState.shares.get(roomId);
        if (!cur || !cur.stop || cur.beaconInfoEventId !== stoppingId) {
            return null;
        }
        return cur;
    };

    // A write that HANGS never reaches the code below, so bound the wait. Past
    // the watchdog the stop is shown as unconfirmed — that re-enables Stop and
    // lets retryPendingStops pick the room up again — which is a statement
    // about what WE know, not about what the server did: the request is still
    // running and still gets to drop the record if it lands. Deliberately no
    // toast; nothing new has been learned and the banner already says the
    // share is live.
    const watchdog = setTimeout(() => {
        const cur = ourShare();
        if (!cur || cur.stop?.phase !== "stopping") return;
        cur.stop = { phase: "failed", error: STOP_FAILED_MESSAGE };
        bump();
    }, STOP_WATCHDOG_MS);

    let rejected = false;
    try {
        await stopLiveBeacon(roomId, decision.beaconInfoEventId);
    } catch {
        rejected = true;
    } finally {
        clearTimeout(watchdog);
    }

    const current = ourShare();
    if (!current) {
        // The record we were stopping is gone (logout, expiry), has been
        // replaced by a newer share, or a retry has taken over: a late ack
        // says nothing about any of those.
        return;
    }
    if (!rejected) {
        dropShare(roomId);
        return;
    }

    const outcome = resolveStopFailure(expiresAt, Date.now());
    if (outcome.action === "drop") {
        dropShare(roomId);
        return;
    }
    current.stop = { phase: "failed", error: outcome.error };
    // Belt and braces: a retained record must always own exactly one timer
    // aimed at the beacon's real death, or its banner would never retire.
    armExpiryTimer(roomId, expiresAt);
    bump();
    if (toast) showErrorToast(outcome.error);
}

/**
 * Re-drive stops that failed while offline, and retire any whose beacon has
 * since expired. Silent by design — the banner is already telling the user the
 * share is still live, and a toast per reconnect would be noise.
 */
export async function retryPendingStops(): Promise<void> {
    const sweep = pendingStopSweep(
        liveLocationState.shares.entries(),
        Date.now(),
    );
    for (const roomId of sweep.drop) dropShare(roomId);
    await Promise.allSettled(
        sweep.retry.map((roomId) => attemptStop(roomId, false)),
    );
}

/** Best-effort stop of every active share (logout / account switch). */
export async function stopAllShares(): Promise<void> {
    // Snapshot the rooms we are responsible for BEFORE the await. Logout fires
    // this without awaiting it, so the next account's sync can resume a
    // genuinely live beacon while our writes are still settling — re-reading
    // the map afterwards would sweep that share away and hide a beacon that is
    // really broadcasting, which is LOC-01 pointing the other way.
    const rooms = Array.from(liveLocationState.shares.keys());
    await Promise.allSettled(rooms.map((r) => attemptStop(r, false)));
    // Teardown: this module's state outlives the session, so a retained
    // stop-failure record would surface in the NEXT account's UI referring to a
    // beacon it cannot touch. Drop whatever survived the attempts.
    for (const roomId of rooms) {
        dropShare(roomId);
    }
}

let unsubs: (() => void)[] = [];

function resumeOwnShares() {
    for (const b of getOwnLiveBeacons()) {
        // A room with a pending/failed stop is already in the map and must NOT
        // be reset to an active share — its beacon is live precisely because
        // our stop has not landed yet.
        if (liveLocationState.shares.has(b.roomId)) continue;
        liveLocationState.shares.set(b.roomId, {
            beaconInfoEventId: b.beaconInfoEventId,
            expiresAt: b.expiresAt,
            lastSentTs: null,
            stop: null,
        });
        armExpiryTimer(b.roomId, b.expiresAt);
    }
    if (hasActiveBroadcast()) ensureWatch();
    bump();
}

/** Wire beacon reactivity + auto-resume. Call once after login; returns cleanup. */
export function initLiveLocation(): () => void {
    unsubs.push(onBeaconUpdate(() => bump()));
    unsubs.push(onSyncPrepared(() => resumeOwnShares()));
    // A stop that failed while offline is retried the moment sync is healthy
    // again — otherwise the beacon stays live until it times out, and the
    // realistic cause of a failed stop is exactly that lost connection.
    unsubs.push(onSyncReconnected(() => void retryPendingStops()));
    resumeOwnShares();
    return () => {
        unsubs.forEach((u) => u());
        unsubs = [];
        void stopAllShares();
    };
}
