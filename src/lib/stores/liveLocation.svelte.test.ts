import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the SDK boundary and the toast surface so we can drive the own-share
// engine and spy on the beacon wrappers. shouldSendUpdate (the pure throttle
// decision) stays real — this exercises the store's wiring around it.
const h = vi.hoisted(() => ({
    startLiveBeacon: vi.fn<
        (roomId: string, ms: number) => Promise<{ beaconInfoEventId: string }>
    >(() => Promise.resolve({ beaconInfoEventId: "$b1" })),
    stopLiveBeacon: vi.fn<(roomId: string) => Promise<void>>(() =>
        Promise.resolve(),
    ),
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
}));

vi.mock("$lib/stores/toasts.svelte", () => ({
    showErrorToast: h.showErrorToast,
}));

import {
    startShare,
    stopShare,
    stopAllShares,
    initLiveLocation,
    isSharingLive,
    liveLocationState,
} from "./liveLocation.svelte";

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

        expect(h.stopLiveBeacon).toHaveBeenCalledWith(ROOM);
        expect(clearWatch).toHaveBeenCalled();
        expect(isSharingLive(ROOM)).toBe(false);
    });

    it("auto-stops the share when its duration elapses", async () => {
        await startShare(ROOM, 900000);

        vi.advanceTimersByTime(900000);
        await Promise.resolve(); // flush the timer's stopShare microtasks

        expect(isSharingLive(ROOM)).toBe(false);
        expect(h.stopLiveBeacon).toHaveBeenCalledWith(ROOM);
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

        expect(h.stopLiveBeacon).toHaveBeenCalledWith("!a:s");
        expect(h.stopLiveBeacon).toHaveBeenCalledWith("!b:s");
        expect(liveLocationState.shares.size).toBe(0);
    });
});
