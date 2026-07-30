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
import { STOP_FAILED_MESSAGE } from "$lib/utils/liveShareStop";

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
});
