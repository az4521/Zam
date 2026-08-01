import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the SDK boundary and the toast surface so we can drive the own-share
// engine and spy on the beacon wrappers. shouldSendUpdate (the pure throttle
// decision) stays real — this exercises the store's wiring around it.
const h = vi.hoisted(() => ({
    startLiveBeacon: vi.fn<
        (roomId: string, ms: number) => Promise<{ beaconInfoEventId: string }>
    >(() => Promise.resolve({ beaconInfoEventId: "$b1" })),
    stopLiveBeacon: vi.fn<
        (roomId: string, knownBeaconInfoId?: string | null) => Promise<void>
    >(() => Promise.resolve()),
    sendLiveBeaconLocation: vi.fn<
        (
            roomId: string,
            beaconInfoEventId: string,
            lat: number,
            lon: number,
        ) => Promise<void>
    >(() => Promise.resolve()),
    canShareLiveBeacon: vi.fn<() => boolean>(() => true),
    getRoom: vi.fn<(id: string) => { roomId: string } | null>((id) => ({
        roomId: id,
    })),
    getOwnLiveBeacons: vi.fn<
        () => { roomId: string; beaconInfoEventId: string; expiresAt: number }[]
    >(() => []),
    onBeaconUpdate: vi.fn((_cb: () => void) => () => {}),
    onSyncPrepared: vi.fn((_cb: () => void) => () => {}),
    onSyncReconnected: vi.fn((_cb: () => void) => () => {}),
    showErrorToast: vi.fn(),
}));

vi.mock("$lib/matrix/client", () => ({
    startLiveBeacon: h.startLiveBeacon,
    stopLiveBeacon: h.stopLiveBeacon,
    sendLiveBeaconLocation: h.sendLiveBeaconLocation,
    canShareLiveBeacon: h.canShareLiveBeacon,
    getRoom: h.getRoom,
    getOwnLiveBeacons: h.getOwnLiveBeacons,
    onBeaconUpdate: h.onBeaconUpdate,
    onSyncPrepared: h.onSyncPrepared,
    onSyncReconnected: h.onSyncReconnected,
}));

vi.mock("$lib/stores/toasts.svelte", () => ({
    showErrorToast: h.showErrorToast,
}));

import {
    startShare,
    stopShare,
    stopAllShares,
    retryPendingStops,
    initLiveLocation,
    isSharingLive,
    liveLocationState,
} from "./liveLocation.svelte";
import {
    alreadySharingMessage,
    STOP_FAILED_MESSAGE,
    STOP_WATCHDOG_MS,
} from "$lib/utils/liveShareStop";

const ROOM = "!r:server";

// The geolocation watch callbacks the engine registers via watchPosition;
// calling geoSuccess drives a position fix the way a real GPS update would.
let geoSuccess: ((p: any) => void) | null = null;
let geoError: ((e: any) => void) | null = null;
const clearWatch = vi.fn();
const watchPosition = vi.fn((s: any, e: any) => {
    geoSuccess = s;
    geoError = e;
    return 7;
});
// startShare probes getCurrentPosition BEFORE publishing the beacon (this is
// what fires the permission prompt); succeed immediately by default.
const getCurrentPosition = vi.fn((s: any, _e?: any) => {
    s({ coords: { latitude: 1.5, longitude: -2.5 } });
});

const geolocation = { watchPosition, clearWatch, getCurrentPosition };
const stubNavigator: { geolocation: typeof geolocation | undefined } = {
    geolocation,
};
vi.stubGlobal("navigator", stubNavigator);

/** Drive one GPS fix through the engine's watch callback. */
function driveFix(lat = 1.5, lon = -2.5) {
    geoSuccess?.({ coords: { latitude: lat, longitude: lon } });
}

/** Flush pending microtasks while fake timers are installed. */
async function flush() {
    await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    h.startLiveBeacon.mockResolvedValue({ beaconInfoEventId: "$b1" });
    h.stopLiveBeacon.mockResolvedValue(undefined);
    h.sendLiveBeaconLocation.mockResolvedValue(undefined);
    h.canShareLiveBeacon.mockReturnValue(true);
    h.getRoom.mockImplementation((id: string) => ({ roomId: id }));
    h.getOwnLiveBeacons.mockReturnValue([]);
    // Tests that capture the reconnect callback install their own
    // implementation; restore the inert default so it can't leak forward.
    h.onSyncReconnected.mockImplementation((_cb: () => void) => () => {});
    geoSuccess = null;
    geoError = null;
    stubNavigator.geolocation = geolocation;
    liveLocationState.shares = new Map();
    liveLocationState.beaconTick = 0;
});

afterEach(async () => {
    // Stop any lingering share so module-level watchId resets to null between
    // tests (clearWatchIfIdle fires once the last share is gone).
    await stopAllShares();
    vi.useRealTimers();
});

describe("live-location own-share engine", () => {
    it("sends the probe fix immediately without waiting for the watch", async () => {
        await startShare(ROOM, 900000);

        expect(h.sendLiveBeaconLocation).toHaveBeenCalledTimes(1);
        expect(h.sendLiveBeaconLocation).toHaveBeenCalledWith(
            ROOM,
            "$b1",
            1.5,
            -2.5,
        );
    });

    it("acquires a position before publishing the beacon", async () => {
        const order: string[] = [];
        getCurrentPosition.mockImplementationOnce((s: any) => {
            order.push("probe");
            s({ coords: { latitude: 1.5, longitude: -2.5 } });
        });
        h.startLiveBeacon.mockImplementationOnce((..._a) => {
            order.push("beacon");
            return Promise.resolve({ beaconInfoEventId: "$b1" });
        });

        await startShare(ROOM, 900000);

        expect(order).toEqual(["probe", "beacon"]);
    });

    it("does not publish a beacon when the position probe fails", async () => {
        getCurrentPosition.mockImplementationOnce((_s: any, e: any) => {
            e({ code: 1 }); // PERMISSION_DENIED
        });

        await startShare(ROOM, 900000);

        expect(h.startLiveBeacon).not.toHaveBeenCalled();
        expect(isSharingLive(ROOM)).toBe(false);
        expect(h.showErrorToast).toHaveBeenCalledTimes(1);
    });

    it("toasts and registers nothing when geolocation is unavailable", async () => {
        stubNavigator.geolocation = undefined;

        await startShare(ROOM, 900000);

        expect(h.startLiveBeacon).not.toHaveBeenCalled();
        expect(isSharingLive(ROOM)).toBe(false);
        expect(h.showErrorToast).toHaveBeenCalledTimes(1);
    });

    it("ignores transient watch errors — the share keeps running untouched", async () => {
        // Android Chrome emits sporadic POSITION_UNAVAILABLE/TIMEOUT blips
        // even with GPS on; staleness is visible via the banner's "last
        // updated at …" label, so errors other than a permission revocation
        // must neither stop the share nor toast.
        await startShare(ROOM, 900000);

        geoError?.({ code: 3, PERMISSION_DENIED: 1 }); // TIMEOUT
        geoError?.({ code: 2, PERMISSION_DENIED: 1 }); // POSITION_UNAVAILABLE

        expect(isSharingLive(ROOM)).toBe(true);
        expect(h.stopLiveBeacon).not.toHaveBeenCalled();
        expect(h.showErrorToast).not.toHaveBeenCalled();

        // Updates resume seamlessly on the next fix.
        vi.advanceTimersByTime(6000);
        driveFix(3, 4);
        expect(h.sendLiveBeaconLocation).toHaveBeenCalledTimes(2);
    });

    it("stops all shares only on PERMISSION_DENIED", async () => {
        await startShare(ROOM, 900000);

        geoError?.({ code: 1, PERMISSION_DENIED: 1 });
        await flush(); // the stop is ack-gated now — let the write resolve

        expect(isSharingLive(ROOM)).toBe(false);
        // The known beacon_info id is threaded through so a stop in the sync
        // race (beacon_info not yet in currentState) still writes live:false.
        expect(h.stopLiveBeacon).toHaveBeenCalledWith(ROOM, "$b1");
        expect(h.showErrorToast).toHaveBeenCalledTimes(1);
    });

    it("toasts once, not once per share, when permission is revoked", async () => {
        // Every share's stop write failing must not stack N identical
        // stop-failure toasts on top of the one geolocation toast — the
        // banner already carries that message per room.
        await startShare("!a:s", 900000);
        await startShare("!b:s", 900000);
        h.stopLiveBeacon.mockRejectedValue(new Error("offline"));
        h.showErrorToast.mockClear();

        geoError?.({ code: 1, PERMISSION_DENIED: 1 });
        await flush();

        expect(h.showErrorToast).toHaveBeenCalledTimes(1);
        h.stopLiveBeacon.mockResolvedValue(undefined);
    });

    it("toasts once when geolocation is gone and every stop then fails", async () => {
        h.stopLiveBeacon.mockRejectedValue(new Error("offline"));
        h.getOwnLiveBeacons.mockReturnValue([
            {
                roomId: "!a:s",
                beaconInfoEventId: "$b1",
                expiresAt: Date.now() + 900000,
            },
            {
                roomId: "!b:s",
                beaconInfoEventId: "$b2",
                expiresAt: Date.now() + 900000,
            },
        ]);
        stubNavigator.geolocation = undefined;

        initLiveLocation();
        await flush();

        expect(h.showErrorToast).toHaveBeenCalledTimes(1);
        h.stopLiveBeacon.mockResolvedValue(undefined);
    });

    it("says why a second share in the same room is refused", async () => {
        await startShare(ROOM, 900000);
        h.showErrorToast.mockClear();
        h.startLiveBeacon.mockClear();

        await startShare(ROOM, 900000);

        expect(h.startLiveBeacon).not.toHaveBeenCalled();
        expect(h.showErrorToast).toHaveBeenCalledTimes(1);
        expect(h.showErrorToast).toHaveBeenCalledWith(
            alreadySharingMessage(null),
        );
    });

    it("says a stuck stop is what is blocking a new share", async () => {
        // The retained failed record outlives the Stop click, so without this
        // the dialog just closes and nothing happens — a silent dead end.
        await startShare(ROOM, 900000);
        h.stopLiveBeacon.mockRejectedValueOnce(new Error("offline"));
        await stopShare(ROOM);
        h.showErrorToast.mockClear();
        h.startLiveBeacon.mockClear();

        await startShare(ROOM, 900000);

        expect(h.startLiveBeacon).not.toHaveBeenCalled();
        expect(h.showErrorToast).toHaveBeenCalledTimes(1);
        expect(h.showErrorToast).toHaveBeenCalledWith(
            alreadySharingMessage({
                phase: "failed",
                error: STOP_FAILED_MESSAGE,
            }),
        );
    });

    it("records lastSentTs so the UI can show 'last updated at …'", async () => {
        await startShare(ROOM, 900000);

        expect(liveLocationState.shares.get(ROOM)?.lastSentTs).toBe(Date.now());
    });

    it("registers the watch without a timeout option (a static position must not error out a share)", async () => {
        await startShare(ROOM, 900000);

        const opts = (watchPosition.mock.calls[0] as unknown[])?.[2] as
            | PositionOptions
            | undefined;
        expect(opts?.timeout).toBeUndefined();
    });

    it("throttles subsequent fixes to >=5s apart", async () => {
        await startShare(ROOM, 900000);

        // The probe fix already sent at t0; watch fixes at the same instant
        // are throttled out.
        driveFix();
        driveFix();
        expect(h.sendLiveBeaconLocation).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(5000);
        driveFix(); // now 5s later — sends again
        expect(h.sendLiveBeaconLocation).toHaveBeenCalledTimes(2);
    });

    it("rewrites live:false and clears the watch on stop", async () => {
        await startShare(ROOM, 900000);
        await stopShare(ROOM);

        expect(h.stopLiveBeacon).toHaveBeenCalledWith(ROOM, "$b1");
        expect(clearWatch).toHaveBeenCalled();
        expect(isSharingLive(ROOM)).toBe(false);
    });

    it("threads the active share's own beacon_info id to stopLiveBeacon (sync-race stop)", async () => {
        // A share resumed from state carries its own beacon_info id; stop must
        // forward THAT id (not a constant) so client.ts can still write
        // live:false in the race where the beacon_info isn't in currentState.
        h.getOwnLiveBeacons.mockReturnValue([
            {
                roomId: "!resumed:s",
                beaconInfoEventId: "$resumed",
                expiresAt: Date.now() + 600000,
            },
        ]);
        initLiveLocation();
        expect(isSharingLive("!resumed:s")).toBe(true);

        await stopShare("!resumed:s");

        expect(h.stopLiveBeacon).toHaveBeenCalledWith("!resumed:s", "$resumed");
    });

    it("auto-stops the share when its duration elapses", async () => {
        await startShare(ROOM, 900000);

        await vi.advanceTimersByTimeAsync(900000);

        expect(isSharingLive(ROOM)).toBe(false);
        expect(h.stopLiveBeacon).toHaveBeenCalledWith(ROOM, "$b1");
    });

    it("resumes our own live beacons on init", () => {
        h.getOwnLiveBeacons.mockReturnValue([
            {
                roomId: "!r:s",
                beaconInfoEventId: "$x",
                expiresAt: Date.now() + 600000,
            },
        ]);

        initLiveLocation();

        expect(isSharingLive("!r:s")).toBe(true);
        expect(watchPosition).toHaveBeenCalled();
    });

    it("stops every share on stopAllShares (logout)", async () => {
        await startShare("!a:s", 900000);
        await startShare("!b:s", 900000);

        await stopAllShares();

        expect(h.stopLiveBeacon).toHaveBeenCalledWith("!a:s", "$b1");
        expect(h.stopLiveBeacon).toHaveBeenCalledWith("!b:s", "$b1");
        expect(liveLocationState.shares.size).toBe(0);
    });

    it("keeps the share until the server acknowledges the stop", async () => {
        await startShare(ROOM, 900000);
        let ack: () => void = () => {};
        h.stopLiveBeacon.mockImplementationOnce(
            () => new Promise<void>((r) => (ack = r)),
        );

        const pending = stopShare(ROOM);
        await flush();

        // Still on the books — the homeserver has not confirmed anything yet.
        expect(isSharingLive(ROOM)).toBe(true);
        expect(liveLocationState.shares.get(ROOM)?.stop?.phase).toBe(
            "stopping",
        );

        ack();
        await pending;

        expect(isSharingLive(ROOM)).toBe(false);
    });

    it("stops publishing position updates the moment Stop is pressed", async () => {
        await startShare(ROOM, 900000);
        h.stopLiveBeacon.mockImplementationOnce(
            () => new Promise<void>(() => {}),
        );

        void stopShare(ROOM);
        await flush();
        const sentBefore = h.sendLiveBeaconLocation.mock.calls.length;
        vi.advanceTimersByTime(60000);
        driveFix(9, 9);

        expect(h.sendLiveBeaconLocation).toHaveBeenCalledTimes(sentBefore);
    });

    it("releases the geolocation watch while a stop is pending", async () => {
        await startShare(ROOM, 900000);
        h.stopLiveBeacon.mockImplementationOnce(
            () => new Promise<void>(() => {}),
        );

        void stopShare(ROOM);
        await flush();

        expect(clearWatch).toHaveBeenCalledWith(7);
    });

    it("keeps the share and surfaces the failure when the stop write rejects", async () => {
        await startShare(ROOM, 900000);
        h.stopLiveBeacon.mockRejectedValueOnce(new Error("offline"));

        await stopShare(ROOM);

        expect(isSharingLive(ROOM)).toBe(true);
        expect(liveLocationState.shares.get(ROOM)?.stop?.phase).toBe("failed");
        expect(h.showErrorToast).toHaveBeenCalledTimes(1);
        expect(h.showErrorToast).toHaveBeenCalledWith(STOP_FAILED_MESSAGE);
    });

    it("never lets a rejected stop escape to the caller", async () => {
        await startShare(ROOM, 900000);
        h.stopLiveBeacon.mockRejectedValueOnce(new Error("offline"));

        await expect(stopShare(ROOM)).resolves.toBeUndefined();
    });

    it("clears the share when a retry finally succeeds, without a second toast", async () => {
        await startShare(ROOM, 900000);
        h.stopLiveBeacon.mockRejectedValueOnce(new Error("offline"));
        await stopShare(ROOM);
        h.showErrorToast.mockClear();
        h.stopLiveBeacon.mockResolvedValueOnce(undefined);

        await retryPendingStops();

        expect(isSharingLive(ROOM)).toBe(false);
        expect(h.showErrorToast).not.toHaveBeenCalled();
    });

    it("does not re-toast when an automatic retry fails again", async () => {
        await startShare(ROOM, 900000);
        h.stopLiveBeacon.mockRejectedValueOnce(new Error("offline"));
        await stopShare(ROOM);
        h.showErrorToast.mockClear();
        h.stopLiveBeacon.mockRejectedValueOnce(new Error("still offline"));

        await retryPendingStops();

        expect(isSharingLive(ROOM)).toBe(true);
        expect(h.showErrorToast).not.toHaveBeenCalled();
    });

    it("retries a failed stop when the user presses Stop again", async () => {
        await startShare(ROOM, 900000);
        h.stopLiveBeacon.mockRejectedValueOnce(new Error("offline"));
        await stopShare(ROOM);
        h.stopLiveBeacon.mockResolvedValueOnce(undefined);

        await stopShare(ROOM);

        expect(h.stopLiveBeacon).toHaveBeenCalledTimes(2);
        expect(isSharingLive(ROOM)).toBe(false);
    });

    it("ignores a second Stop while the first write is in flight", async () => {
        await startShare(ROOM, 900000);
        h.stopLiveBeacon.mockImplementationOnce(
            () => new Promise<void>(() => {}),
        );

        void stopShare(ROOM);
        await flush();
        void stopShare(ROOM);
        await flush();

        expect(h.stopLiveBeacon).toHaveBeenCalledTimes(1);
    });

    it("drops a failed share once its beacon expires on its own", async () => {
        await startShare(ROOM, 900000);
        h.stopLiveBeacon.mockRejectedValueOnce(new Error("offline"));
        await stopShare(ROOM);
        expect(isSharingLive(ROOM)).toBe(true);

        // Every later attempt keeps failing; the beacon still dies on time.
        h.stopLiveBeacon.mockRejectedValue(new Error("offline"));
        await vi.advanceTimersByTimeAsync(900000);

        expect(isSharingLive(ROOM)).toBe(false);
    });

    it("retires a share whose stop write never settles once the beacon expires", async () => {
        // A hung write (no ack, no rejection) must not strand the banner: past
        // expiry the server has stopped broadcasting either way.
        await startShare(ROOM, 900000);
        h.stopLiveBeacon.mockImplementation(() => new Promise<void>(() => {}));

        void stopShare(ROOM);
        await flush();
        await vi.advanceTimersByTimeAsync(900000);

        expect(isSharingLive(ROOM)).toBe(false);
        h.stopLiveBeacon.mockResolvedValue(undefined);
    });

    it("demotes a stop whose write hangs, reopening the retry path", async () => {
        // A stalled TCP connection never rejects, so without a watchdog the
        // record sits in "stopping" (Stop disabled, retry sweep skips it) for
        // the beacon's whole duration — up to 8 hours of dead "Stopping…".
        await startShare(ROOM, 900000);
        h.stopLiveBeacon.mockImplementationOnce(
            () => new Promise<void>(() => {}),
        );

        void stopShare(ROOM);
        await flush();
        expect(liveLocationState.shares.get(ROOM)?.stop?.phase).toBe(
            "stopping",
        );

        await vi.advanceTimersByTimeAsync(STOP_WATCHDOG_MS);

        expect(liveLocationState.shares.get(ROOM)?.stop?.phase).toBe("failed");

        // …and the reopened path really does send a second write.
        h.stopLiveBeacon.mockResolvedValueOnce(undefined);
        await stopShare(ROOM);

        expect(h.stopLiveBeacon).toHaveBeenCalledTimes(2);
        expect(isSharingLive(ROOM)).toBe(false);
    });

    it("drops the record when a hung stop write finally resolves", async () => {
        // The demotion means "we don't know yet", not "it failed": the write
        // is still running, and if it lands the beacon really did stop.
        await startShare(ROOM, 900000);
        let ack: () => void = () => {};
        h.stopLiveBeacon.mockImplementationOnce(
            () => new Promise<void>((r) => (ack = r)),
        );

        const pending = stopShare(ROOM);
        await flush();
        await vi.advanceTimersByTimeAsync(STOP_WATCHDOG_MS);
        expect(liveLocationState.shares.get(ROOM)?.stop?.phase).toBe("failed");

        ack();
        await pending;

        expect(isSharingLive(ROOM)).toBe(false);
    });

    it("does not let an abandoned attempt's rejection disturb the retry", async () => {
        // After the watchdog demotes, the user presses Retry — a SECOND write.
        // The first one settling afterwards belongs to nothing on screen.
        await startShare(ROOM, 900000);
        let fail: (e: Error) => void = () => {};
        h.stopLiveBeacon.mockImplementationOnce(
            () => new Promise<void>((_r, j) => (fail = j)),
        );
        const first = stopShare(ROOM);
        await flush();
        await vi.advanceTimersByTimeAsync(STOP_WATCHDOG_MS);

        h.stopLiveBeacon.mockImplementationOnce(
            () => new Promise<void>(() => {}),
        );
        void stopShare(ROOM);
        await flush();
        expect(liveLocationState.shares.get(ROOM)?.stop?.phase).toBe(
            "stopping",
        );
        h.showErrorToast.mockClear();

        fail(new Error("offline"));
        await first;

        expect(liveLocationState.shares.get(ROOM)?.stop?.phase).toBe(
            "stopping",
        );
        expect(h.showErrorToast).not.toHaveBeenCalled();
    });

    it("does not let an abandoned attempt's ack drop the retry's record", async () => {
        await startShare(ROOM, 900000);
        let ack: () => void = () => {};
        h.stopLiveBeacon.mockImplementationOnce(
            () => new Promise<void>((r) => (ack = r)),
        );
        const first = stopShare(ROOM);
        await flush();
        await vi.advanceTimersByTimeAsync(STOP_WATCHDOG_MS);

        h.stopLiveBeacon.mockImplementationOnce(
            () => new Promise<void>(() => {}),
        );
        void stopShare(ROOM);
        await flush();

        ack();
        await first;

        expect(isSharingLive(ROOM)).toBe(true);
        expect(liveLocationState.shares.get(ROOM)?.stop?.phase).toBe(
            "stopping",
        );
    });

    it("leaves no timer behind when a stop is acknowledged", async () => {
        await startShare(ROOM, 900000);

        await stopShare(ROOM);

        // Record dropped: neither the expiry backstop nor the watchdog may
        // outlive it.
        expect(vi.getTimerCount()).toBe(0);
    });

    it("keeps exactly one timer — the expiry backstop — after a stop fails", async () => {
        await startShare(ROOM, 900000);
        h.stopLiveBeacon.mockRejectedValueOnce(new Error("offline"));

        await stopShare(ROOM);

        // The watchdog is cleared on the rejection path and the expiry timer
        // is re-armed, not duplicated — a second one would fire onExpiry twice.
        expect(vi.getTimerCount()).toBe(1);
    });

    it("does not resurrect a room whose stop is still pending", async () => {
        await startShare(ROOM, 900000);
        h.stopLiveBeacon.mockRejectedValueOnce(new Error("offline"));
        await stopShare(ROOM);
        h.getOwnLiveBeacons.mockReturnValue([
            {
                roomId: ROOM,
                beaconInfoEventId: "$b1",
                expiresAt: Date.now() + 900000,
            },
        ]);

        initLiveLocation();

        expect(liveLocationState.shares.get(ROOM)?.stop?.phase).toBe("failed");
    });

    it("does not carry a failed stop into the next session", async () => {
        await startShare(ROOM, 900000);
        h.stopLiveBeacon.mockRejectedValue(new Error("offline"));

        await stopAllShares();

        expect(liveLocationState.shares.size).toBe(0);
        h.stopLiveBeacon.mockResolvedValue(undefined);
    });

    it("does not let a late ack delete a share started afterwards", async () => {
        // Logout sweeps the map while the write is in flight, the next session
        // starts a fresh share in the same room — then the stale ack lands.
        await startShare(ROOM, 900000);
        let ack: () => void = () => {};
        h.stopLiveBeacon.mockImplementationOnce(
            () => new Promise<void>((r) => (ack = r)),
        );
        const pending = stopShare(ROOM);
        await flush();
        await stopAllShares();
        expect(liveLocationState.shares.size).toBe(0);

        h.startLiveBeacon.mockResolvedValueOnce({ beaconInfoEventId: "$b2" });
        await startShare(ROOM, 900000);

        ack();
        await pending;

        expect(isSharingLive(ROOM)).toBe(true);
        expect(liveLocationState.shares.get(ROOM)?.beaconInfoEventId).toBe(
            "$b2",
        );
        expect(liveLocationState.shares.get(ROOM)?.stop).toBeNull();
    });

    it("does not sweep away a share that appeared while it was stopping", async () => {
        // Logout fires stopAllShares without awaiting it. If an old write is
        // slow, the next account's sync can resume a genuinely live beacon
        // before the teardown finishes — the sweep must only forget the rooms
        // it actually attempted, or it hides a share that IS broadcasting.
        await startShare("!a:s", 900000);
        let ack: () => void = () => {};
        h.stopLiveBeacon.mockImplementationOnce(
            () => new Promise<void>((r) => (ack = r)),
        );

        const pending = stopAllShares();
        await flush();

        h.getOwnLiveBeacons.mockReturnValue([
            {
                roomId: "!b:s",
                beaconInfoEventId: "$b9",
                expiresAt: Date.now() + 900000,
            },
        ]);
        initLiveLocation();
        expect(isSharingLive("!b:s")).toBe(true);

        ack();
        await pending;

        expect(isSharingLive("!b:s")).toBe(true);
        expect(liveLocationState.shares.get("!b:s")?.stop).toBeNull();
    });

    it("sweeps only the rooms it attempted, not the map as it stands afterwards", async () => {
        // Same invariant as the test above, but with NO session boundary, so
        // the epoch guard cannot short-circuit and the `rooms` snapshot is the
        // only thing standing between the sweep and a share it never attempted.
        // A's write REJECTS, so its record is retained by attemptStop and can
        // only be cleared by the drop loop — that is what proves the loop ran
        // at all rather than being skipped.
        await startShare("!a:s", 900000);
        let fail: (e: Error) => void = () => {};
        h.stopLiveBeacon.mockImplementationOnce(
            () => new Promise<void>((_r, j) => (fail = j)),
        );

        const pending = stopAllShares();
        await flush();

        h.startLiveBeacon.mockResolvedValueOnce({ beaconInfoEventId: "$b2" });
        await startShare("!b:s", 900000);
        expect(isSharingLive("!b:s")).toBe(true);

        fail(new Error("offline"));
        await pending;

        // A was attempted and retained as failed, so the loop is what removed it.
        expect(isSharingLive("!a:s")).toBe(false);
        // B was never attempted: it must survive a sweep that only owns `rooms`.
        expect(isSharingLive("!b:s")).toBe(true);
        expect(liveLocationState.shares.get("!b:s")?.stop).toBeNull();
    });

    it("does not let a late ack delete a share resumed from the server", async () => {
        // Logout sweeps the record while the write is in flight; the next
        // session's sync still sees the beacon live and resumes it as an
        // active share. The old write's outcome says nothing about THAT
        // record — dropping it would claim we stopped a live beacon.
        await startShare(ROOM, 900000);
        let ack: () => void = () => {};
        h.stopLiveBeacon.mockImplementationOnce(
            () => new Promise<void>((r) => (ack = r)),
        );
        const pending = stopShare(ROOM);
        await flush();
        await stopAllShares();

        h.getOwnLiveBeacons.mockReturnValue([
            {
                roomId: ROOM,
                beaconInfoEventId: "$b1",
                expiresAt: Date.now() + 900000,
            },
        ]);
        initLiveLocation();
        expect(liveLocationState.shares.get(ROOM)?.stop).toBeNull();

        ack();
        await pending;

        expect(isSharingLive(ROOM)).toBe(true);
    });

    it("does not let a late rejection disturb a different share's pending stop", async () => {
        // Same room, different beacon: the first write's failure must not
        // rewrite the phase (or re-toast) for the share that replaced it.
        await startShare(ROOM, 900000);
        let fail: (e: Error) => void = () => {};
        h.stopLiveBeacon.mockImplementationOnce(
            () => new Promise<void>((_r, j) => (fail = j)),
        );
        const pending = stopShare(ROOM);
        await flush();
        await stopAllShares();

        h.startLiveBeacon.mockResolvedValueOnce({ beaconInfoEventId: "$b2" });
        await startShare(ROOM, 900000);
        h.stopLiveBeacon.mockImplementationOnce(
            () => new Promise<void>(() => {}),
        );
        void stopShare(ROOM);
        await flush();
        h.showErrorToast.mockClear();

        fail(new Error("offline"));
        await pending;

        expect(liveLocationState.shares.get(ROOM)?.stop?.phase).toBe(
            "stopping",
        );
        expect(h.showErrorToast).not.toHaveBeenCalled();
    });

    it("retries a failed stop when sync recovers", async () => {
        // Deliberately a no-op rather than null: if initLiveLocation never
        // subscribes, this fires nothing and the share stays live — which is
        // exactly the failure the assertion below catches.
        let onReconnect: () => void = () => {};
        h.onSyncReconnected.mockImplementation((cb: () => void) => {
            onReconnect = cb;
            return () => {};
        });
        await startShare(ROOM, 900000);
        h.stopLiveBeacon.mockRejectedValueOnce(new Error("offline"));
        await stopShare(ROOM);
        initLiveLocation();
        h.stopLiveBeacon.mockResolvedValueOnce(undefined);

        onReconnect();
        await flush();

        expect(isSharingLive(ROOM)).toBe(false);
    });

    it("does not re-drive a stop that is already in flight when sync recovers", async () => {
        // The retry sweep and a manual Stop can overlap; only one live:false
        // write per room may ever be outstanding.
        let onReconnect: () => void = () => {};
        h.onSyncReconnected.mockImplementation((cb: () => void) => {
            onReconnect = cb;
            return () => {};
        });
        await startShare(ROOM, 900000);
        initLiveLocation();
        h.stopLiveBeacon.mockImplementationOnce(
            () => new Promise<void>(() => {}),
        );

        void stopShare(ROOM);
        await flush();
        onReconnect();
        await flush();

        expect(h.stopLiveBeacon).toHaveBeenCalledTimes(1);
    });

    it("stops listening for sync recovery once live location is torn down", async () => {
        // The subscription must be owned by the same cleanup as the others:
        // a leaked listener would keep retrying stops for a logged-out account.
        const unsubscribe = vi.fn();
        h.onSyncReconnected.mockImplementation(() => unsubscribe);

        const teardown = initLiveLocation();
        expect(h.onSyncReconnected).toHaveBeenCalledTimes(1);
        teardown();
        await flush();

        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it("does not let a teardown delete the next session's live beacon", async () => {
        // The headline failure. Teardown's live:false write is still in flight
        // when the next session mounts; the next session's resume deliberately
        // skips the room BECAUSE the record is still there. If the teardown then
        // sweeps it, a genuinely broadcasting beacon has no record and no banner.
        const teardown = initLiveLocation();
        await startShare(ROOM, 900000);
        let ack: () => void = () => {};
        h.stopLiveBeacon.mockImplementationOnce(
            () => new Promise<void>((r) => (ack = r)),
        );

        teardown();
        await flush();

        h.getOwnLiveBeacons.mockReturnValue([
            {
                roomId: ROOM,
                beaconInfoEventId: "$b1",
                expiresAt: Date.now() + 900000,
            },
        ]);
        initLiveLocation();
        expect(isSharingLive(ROOM)).toBe(true);

        ack();
        await flush();

        expect(isSharingLive(ROOM)).toBe(true);
    });

    it("hands an inherited in-flight stop over as retryable, not frozen", async () => {
        // "stopping" disables Stop, and the write that phase refers to belongs to
        // a client this session cannot watch settle: left alone the row would sit
        // on a dead button until the beacon expired.
        const teardown = initLiveLocation();
        await startShare(ROOM, 900000);
        h.stopLiveBeacon.mockImplementationOnce(
            () => new Promise<void>(() => {}),
        );

        teardown();
        await flush();
        expect(liveLocationState.shares.get(ROOM)?.stop?.phase).toBe(
            "stopping",
        );

        initLiveLocation();

        expect(liveLocationState.shares.get(ROOM)?.stop?.phase).toBe("failed");
        expect(liveLocationState.shares.get(ROOM)?.stop?.error).toBe(
            STOP_FAILED_MESSAGE,
        );
    });

    it("lets the next session re-drive a stop the previous one left in flight", async () => {
        // The adopted record must be a real retry candidate, not just cosmetics:
        // the reconnect sweep picks up "failed", never "stopping".
        let onReconnect: () => void = () => {};
        h.onSyncReconnected.mockImplementation((cb: () => void) => {
            onReconnect = cb;
            return () => {};
        });
        const teardown = initLiveLocation();
        await startShare(ROOM, 900000);
        h.stopLiveBeacon.mockImplementationOnce(
            () => new Promise<void>(() => {}),
        );
        teardown();
        await flush();

        initLiveLocation();
        h.stopLiveBeacon.mockResolvedValueOnce(undefined);
        onReconnect();
        await flush();

        expect(isSharingLive(ROOM)).toBe(false);
    });

    it("still clears everything it attempted when no new session follows", async () => {
        // The guard must not turn teardown into a no-op: with nobody taking over,
        // a retained record would surface in whatever mounts next.
        const teardown = initLiveLocation();
        await startShare(ROOM, 900000);
        h.stopLiveBeacon.mockRejectedValueOnce(new Error("offline"));

        teardown();
        await flush();

        expect(liveLocationState.shares.size).toBe(0);
    });

    it("keeps the live session's listeners when a superseded teardown fires", async () => {
        // A cleanup can run after the next mount (destroy/mount ordering is not
        // guaranteed across a route flip). Running it against the live session
        // would be a logout nobody asked for.
        const unsubscribe = vi.fn();
        h.onSyncReconnected.mockImplementation(() => unsubscribe);

        const stale = initLiveLocation();
        initLiveLocation();
        unsubscribe.mockClear();
        await startShare(ROOM, 900000);

        stale();
        await flush();

        expect(unsubscribe).not.toHaveBeenCalled();
        expect(isSharingLive(ROOM)).toBe(true);
        expect(h.stopLiveBeacon).not.toHaveBeenCalled();
        // The watch belongs to the session that is still broadcasting: a
        // superseded cleanup releasing it would silently stop the position
        // updates while the banner still claimed the share was live.
        expect(clearWatch).not.toHaveBeenCalled();
    });

    it("takes the server's expiry for a share it already holds", async () => {
        await startShare(ROOM, 900000);
        const serverExpiry = Date.now() + 600000;
        h.getOwnLiveBeacons.mockReturnValue([
            { roomId: ROOM, beaconInfoEventId: "$b1", expiresAt: serverExpiry },
        ]);

        initLiveLocation();

        expect(liveLocationState.shares.get(ROOM)?.expiresAt).toBe(
            serverExpiry,
        );
        // Re-armed, not duplicated: two timers would fire onExpiry twice.
        expect(vi.getTimerCount()).toBe(1);
        // …and the one timer points at the SERVER's deadline. A record left on
        // the old client-clock timer would outlive the beacon by 5 minutes,
        // which is the same lie the expiry itself was fixed for.
        await vi.advanceTimersByTimeAsync(600000);
        expect(isSharingLive(ROOM)).toBe(false);
    });

    it("re-renders when a position send fails", async () => {
        // lastSentTs drives the banner's "last updated" label; mutating it
        // without a tick leaves the label lying about how fresh the share is.
        await startShare(ROOM, 900000);
        h.sendLiveBeaconLocation.mockRejectedValueOnce(new Error("offline"));
        vi.advanceTimersByTime(60000);

        driveFix(2, 3);
        // AFTER the synchronous loop, so this measures only the rejection's own
        // tick: onPosition already bumps once per fix, which would make the
        // assertion below pass with or without the fix.
        const before = liveLocationState.beaconTick;
        await flush();

        expect(liveLocationState.shares.get(ROOM)?.lastSentTs).toBeNull();
        expect(liveLocationState.beaconTick).toBeGreaterThan(before);
    });

    it("detaches the previous session's listeners when a new one begins", async () => {
        // Without a cleanup in between, the old session's subscriptions would
        // keep firing resume/retry work for an account that is gone.
        const unsubscribe = vi.fn();
        h.onSyncReconnected.mockImplementation(() => unsubscribe);

        initLiveLocation();
        initLiveLocation();

        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
});
