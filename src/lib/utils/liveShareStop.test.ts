import { describe, it, expect } from "vitest";
import {
    decideStop,
    resolveStopFailure,
    pendingStopSweep,
    stopStatusLabel,
    stopButtonLabel,
    isSyncRecovery,
    STOP_FAILED_MESSAGE,
    type StopState,
} from "./liveShareStop";

describe("decideStop", () => {
    it("reports absent when there is no share to stop", () => {
        expect(decideStop(null)).toEqual({ action: "absent" });
    });

    it("sends the write, threading the known beacon_info id", () => {
        expect(
            decideStop({ beaconInfoEventId: "$b1", stopPending: false }),
        ).toEqual({ action: "send", beaconInfoEventId: "$b1" });
    });

    it("passes a null beacon_info id through rather than inventing one", () => {
        expect(
            decideStop({ beaconInfoEventId: null, stopPending: false }),
        ).toEqual({ action: "send", beaconInfoEventId: null });
    });

    it("refuses to send a second write while one is in flight", () => {
        expect(
            decideStop({ beaconInfoEventId: "$b1", stopPending: true }),
        ).toEqual({ action: "in-flight" });
    });
});

describe("resolveStopFailure", () => {
    it("retains the share while the beacon is still live on the server", () => {
        expect(resolveStopFailure(1000, 999)).toEqual({
            action: "retain",
            error: STOP_FAILED_MESSAGE,
        });
    });

    it("drops the share once its beacon has expired anyway", () => {
        // The server stops broadcasting at `timeout` regardless of live:false,
        // so a failure at/after expiry leaves nothing to be truthful about.
        expect(resolveStopFailure(1000, 1000)).toEqual({ action: "drop" });
        expect(resolveStopFailure(1000, 5000)).toEqual({ action: "drop" });
    });

    it("never leaks a raw server error into the user-facing message", () => {
        expect(STOP_FAILED_MESSAGE).not.toMatch(/MatrixError|\[\d{3}\]/);
        expect(STOP_FAILED_MESSAGE.length).toBeGreaterThan(0);
    });
});

describe("pendingStopSweep", () => {
    const failed: StopState = { phase: "failed", error: "x" };
    const stopping: StopState = { phase: "stopping", error: null };

    it("retries failed stops whose beacon is still live", () => {
        const out = pendingStopSweep(
            [["!a:s", { expiresAt: 2000, stop: failed }]],
            1000,
        );
        expect(out).toEqual({ retry: ["!a:s"], drop: [] });
    });

    it("drops any pending stop whose beacon has expired", () => {
        const out = pendingStopSweep(
            [
                ["!a:s", { expiresAt: 500, stop: failed }],
                ["!b:s", { expiresAt: 500, stop: stopping }],
            ],
            1000,
        );
        expect(out.drop.sort()).toEqual(["!a:s", "!b:s"]);
        expect(out.retry).toEqual([]);
    });

    it("drops rather than retries a stop exactly at its expiry instant", () => {
        // Same boundary as resolveStopFailure: at `expiresAt` the beacon is
        // already dead, so retrying would send a write that can only fail.
        const out = pendingStopSweep(
            [["!a:s", { expiresAt: 1000, stop: failed }]],
            1000,
        );
        expect(out).toEqual({ retry: [], drop: ["!a:s"] });
    });

    it("leaves an in-flight stop alone and never touches an active share", () => {
        const out = pendingStopSweep(
            [
                ["!a:s", { expiresAt: 9000, stop: stopping }],
                ["!b:s", { expiresAt: 9000, stop: null }],
            ],
            1000,
        );
        expect(out).toEqual({ retry: [], drop: [] });
    });
});

describe("labels", () => {
    it("shows nothing extra for a healthy share", () => {
        expect(stopStatusLabel(null)).toBeNull();
        expect(stopButtonLabel(null)).toBe("Stop");
    });

    it("shows progress while the write is in flight", () => {
        const s: StopState = { phase: "stopping", error: null };
        expect(stopStatusLabel(s)).toBe("Stopping…");
        expect(stopButtonLabel(s)).toBe("Stopping…");
    });

    it("stays honest about a failed stop and offers a retry", () => {
        const s: StopState = { phase: "failed", error: "x" };
        expect(stopStatusLabel(s)).toBe("Still sharing — couldn't stop");
        expect(stopButtonLabel(s)).toBe("Retry stop");
    });
});

describe("isSyncRecovery", () => {
    it("fires when sync comes back after an error", () => {
        expect(isSyncRecovery("SYNCING", "ERROR")).toBe(true);
        expect(isSyncRecovery("CATCHUP", "ERROR")).toBe(true);
        expect(isSyncRecovery("PREPARED", "ERROR")).toBe(true);
        expect(isSyncRecovery("SYNCING", "RECONNECTING")).toBe(true);
    });

    it("does not fire on the steady state or on the way down", () => {
        expect(isSyncRecovery("SYNCING", "SYNCING")).toBe(false);
        expect(isSyncRecovery("ERROR", "SYNCING")).toBe(false);
        expect(isSyncRecovery("RECONNECTING", "SYNCING")).toBe(false);
        expect(isSyncRecovery("STOPPED", "ERROR")).toBe(false);
        expect(isSyncRecovery("PREPARED", null)).toBe(false);
    });
});
