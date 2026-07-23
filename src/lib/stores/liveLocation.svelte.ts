import {
    startLiveBeacon,
    stopLiveBeacon,
    sendLiveBeaconLocation,
    canShareLiveBeacon,
    getRoom,
    getOwnLiveBeacons,
    onBeaconUpdate,
    onSyncPrepared,
} from "$lib/matrix/client";
import { shouldSendUpdate } from "$lib/utils/liveLocation";
import {
    geoErrorMessage,
    geolocationUnavailableMessage,
} from "$lib/utils/geoErrors";
import { showErrorToast } from "$lib/stores/toasts.svelte";

export interface ShareState {
    beaconInfoEventId: string;
    expiresAt: number;
    lastSentTs: number | null;
}

export const liveLocationState = $state<{
    beaconTick: number;
    shares: Map<string, ShareState>;
}>({ beaconTick: 0, shares: new Map() });

const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();
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

function clearWatchIfIdle() {
    if (watchId !== null && liveLocationState.shares.size === 0) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
}

function onPosition(pos: GeolocationPosition) {
    const now = Date.now();
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    for (const [roomId, share] of liveLocationState.shares) {
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
    liveLocationState.shares.set(roomId, {
        beaconInfoEventId,
        expiresAt: Date.now() + durationMs,
        lastSentTs: null,
    });
    expiryTimers.set(
        roomId,
        setTimeout(() => void stopShare(roomId), durationMs),
    );
    ensureWatch();
    // Send the fix we already have instead of waiting for the watch's
    // first callback (keeps the first-fix-immediate behavior).
    onPosition(firstFix);
    bump();
}

/** Stop our live share in `roomId` (rewrites beacon_info live:false). */
export async function stopShare(roomId: string): Promise<void> {
    const timer = expiryTimers.get(roomId);
    if (timer) {
        clearTimeout(timer);
        expiryTimers.delete(roomId);
    }
    const had = liveLocationState.shares.delete(roomId);
    bump();
    clearWatchIfIdle();
    if (had) {
        try {
            await stopLiveBeacon(roomId);
        } catch {
            // best effort — server-side beacon still expires by timeout
        }
    }
}

/** Best-effort stop of every active share (logout / account switch). */
export async function stopAllShares(): Promise<void> {
    await Promise.allSettled(
        Array.from(liveLocationState.shares.keys()).map((r) => stopShare(r)),
    );
}

let unsubs: (() => void)[] = [];

function resumeOwnShares() {
    for (const b of getOwnLiveBeacons()) {
        if (liveLocationState.shares.has(b.roomId)) continue;
        liveLocationState.shares.set(b.roomId, {
            beaconInfoEventId: b.beaconInfoEventId,
            expiresAt: b.expiresAt,
            lastSentTs: null,
        });
        const ms = Math.max(0, b.expiresAt - Date.now());
        expiryTimers.set(
            b.roomId,
            setTimeout(() => void stopShare(b.roomId), ms),
        );
    }
    if (liveLocationState.shares.size > 0) ensureWatch();
    bump();
}

/** Wire beacon reactivity + auto-resume. Call once after login; returns cleanup. */
export function initLiveLocation(): () => void {
    unsubs.push(onBeaconUpdate(() => bump()));
    unsubs.push(onSyncPrepared(() => resumeOwnShares()));
    resumeOwnShares();
    return () => {
        unsubs.forEach((u) => u());
        unsubs = [];
        void stopAllShares();
    };
}
