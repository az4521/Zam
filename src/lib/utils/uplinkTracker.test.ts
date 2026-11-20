import { describe, expect, it } from "vitest";
import {
    MAX_UPLINK_BPS,
    UPLINK_CONGESTION_HOLD_MS,
    UplinkTracker,
} from "./uplinkTracker";

const quiet = { sent: null, loss: 0, rttMs: 40 };

describe("UplinkTracker", () => {
    it("knows nothing before a sample", () => {
        expect(new UplinkTracker().current()).toBeNull();
        expect(
            new UplinkTracker().sample(
                { available: null, sent: null, loss: null, rttMs: null },
                0,
            ),
        ).toBeNull();
    });

    it("follows WebRTC's estimate down as well as up (no stored peak)", () => {
        const u = new UplinkTracker();
        let t = 0;
        for (let i = 0; i < 6; i++)
            u.sample({ ...quiet, available: 40_000_000 }, (t += 1000));
        expect(u.current()).toBe(40_000_000);
        for (let i = 0; i < 6; i++)
            u.sample({ ...quiet, available: 3_000_000 }, (t += 1000));
        expect(u.current()).toBe(3_000_000);
    });

    it("rides out one odd reading", () => {
        const u = new UplinkTracker();
        let t = 0;
        for (const bps of [10e6, 10e6, 90e6, 10e6, 10e6])
            u.sample({ ...quiet, available: bps }, (t += 1000));
        expect(u.current()).toBe(10_000_000);
    });

    it("holds under what got through while the server reports loss", () => {
        const u = new UplinkTracker();
        let t = 0;
        for (let i = 0; i < 5; i++)
            u.sample({ ...quiet, available: 20_000_000 }, (t += 1000));
        u.sample(
            { available: 20_000_000, sent: 6_000_000, loss: 0.12, rttMs: 40 },
            (t += 1000),
        );
        expect(u.current()).toBe(5_400_000);
        expect(u.congestionHold(t)).toBe(5_400_000);
        // Calm again: the hold lapses and the estimate stands.
        t += UPLINK_CONGESTION_HOLD_MS + 1000;
        u.sample({ ...quiet, available: 20_000_000 }, t);
        expect(u.current()).toBe(20_000_000);
        expect(u.congestionHold(t)).toBeNull();
    });

    it("reads a swelling round trip as a full link", () => {
        const u = new UplinkTracker();
        let t = 0;
        for (let i = 0; i < 5; i++)
            u.sample({ ...quiet, available: 20_000_000 }, (t += 1000));
        u.sample(
            { available: 20_000_000, sent: 8_000_000, loss: 0, rttMs: 300 },
            (t += 1000),
        );
        expect(u.current()).toBe(7_200_000);
    });

    it("caps implausible estimates", () => {
        const u = new UplinkTracker();
        u.sample({ ...quiet, available: 5_000_000_000 }, 1000);
        expect(u.current()).toBe(MAX_UPLINK_BPS);
    });

    it("starts over on reset", () => {
        const u = new UplinkTracker();
        u.sample({ ...quiet, available: 5_000_000 }, 1000);
        u.reset();
        expect(u.current()).toBeNull();
    });
});
