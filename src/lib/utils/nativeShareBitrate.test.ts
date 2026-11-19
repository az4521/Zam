import { describe, expect, it } from "vitest";
import {
    nativeBitrateChanged,
    nativeBitrateTarget,
    nativeSenderBitrate,
    NATIVE_SENDER_BITRATE_FLOOR,
    NATIVE_START_BITRATE,
    UPLINK_CEILING_CALM_MS,
    UplinkCeiling,
} from "./nativeShareBitrate";

describe("nativeBitrateTarget", () => {
    it("keeps the picked bitrate when the uplink is roomy", () => {
        expect(nativeBitrateTarget(6_000_000, 50_000_000)).toBe(6_000_000);
    });

    it("holds the bitrate to 85% of a smaller uplink", () => {
        expect(nativeBitrateTarget(6_000_000, 4_000_000)).toBe(3_400_000);
    });

    it("starts low while the uplink is unknown, and never above the pick", () => {
        expect(nativeBitrateTarget(6_000_000, null)).toBe(NATIVE_START_BITRATE);
        expect(nativeBitrateTarget(1_000_000, null)).toBe(1_000_000);
        expect(nativeBitrateTarget(6_000_000, undefined)).toBe(
            NATIVE_START_BITRATE,
        );
        expect(nativeBitrateTarget(6_000_000, 0)).toBe(NATIVE_START_BITRATE);
    });
});

describe("nativeBitrateTarget with realistic links", () => {
    it("never raises the target above the picked bitrate", () => {
        for (const avail of [5e6, 20e6, 60e6, 500e6]) {
            expect(nativeBitrateTarget(4_000_000, avail)).toBeLessThanOrEqual(
                4_000_000,
            );
        }
    });

    it("keeps a 4 Mbps pick on a 9 Mbps uplink", () => {
        expect(nativeBitrateTarget(4_000_000, 9_000_000)).toBe(4_000_000);
    });

    it("holds a 4 Mbps pick on a 4.5 Mbps uplink to 3.825 Mbps", () => {
        expect(nativeBitrateTarget(4_000_000, 4_500_000)).toBe(3_825_000);
    });

    it("holds a 51.5 Mbps pick on a 57 Mbps uplink to 48.45 Mbps", () => {
        expect(nativeBitrateTarget(51_500_000, 57_000_000)).toBe(48_450_000);
    });

    it("holds a 51.5 Mbps pick on a 30 Mbps uplink to 25.5 Mbps", () => {
        expect(nativeBitrateTarget(51_500_000, 30_000_000)).toBe(25_500_000);
    });
});

describe("nativeBitrateChanged", () => {
    it("always sends the first value", () => {
        expect(nativeBitrateChanged(null, 3_000_000)).toBe(true);
    });

    it("ignores changes of 10% or less", () => {
        expect(nativeBitrateChanged(3_000_000, 3_200_000)).toBe(false);
        expect(nativeBitrateChanged(3_000_000, 2_700_000)).toBe(false);
    });

    it("sends changes over 10%", () => {
        expect(nativeBitrateChanged(3_000_000, 3_400_000)).toBe(true);
        expect(nativeBitrateChanged(3_000_000, 2_600_000)).toBe(true);
    });
});

describe("nativeSenderBitrate", () => {
    it("raises a low picked bitrate to the placeholder floor", () => {
        expect(nativeSenderBitrate(1_000_000)).toBe(
            NATIVE_SENDER_BITRATE_FLOOR,
        );
    });

    it("keeps a higher picked bitrate", () => {
        expect(nativeSenderBitrate(20_000_000)).toBe(20_000_000);
    });
});

describe("UplinkCeiling", () => {
    it("passes the estimate through until it collapses", () => {
        const c = new UplinkCeiling();
        for (let t = 0, bps = 1e6; t < 20_000; t += 500, bps *= 1.04)
            expect(c.limit(bps, t)).toBe(bps);
        expect(c.current()).toBeNull();
    });

    it("rides out WebRTC's ordinary 15% backoffs", () => {
        const c = new UplinkCeiling();
        c.limit(10e6, 0);
        c.limit(8.5e6, 500);
        c.limit(7.3e6, 1000);
        expect(c.current()).toBeNull();
    });

    it("holds the helper under 80% of where the uplink collapsed", () => {
        const c = new UplinkCeiling();
        c.limit(40e6, 0);
        c.limit(60e6, 500);
        expect(c.limit(1e6, 1000)).toBe(1e6);
        expect(c.current()).toBe(48e6);
        // The estimate climbs back past it: the helper stops at the ceiling.
        expect(c.limit(55e6, 20_000)).toBe(48e6);
    });

    it("raises the ceiling slowly while the link stays calm", () => {
        const c = new UplinkCeiling();
        c.limit(50e6, 0);
        c.limit(5e6, 500); // ceiling 40 Mbps
        for (let t = 1000; t < 500 + UPLINK_CEILING_CALM_MS; t += 500)
            c.limit(45e6, t);
        expect(c.current()).toBe(40e6);
        c.limit(45e6, 500 + UPLINK_CEILING_CALM_MS);
        expect(c.current()).toBeCloseTo(44e6);
    });

    it("lets an unknown estimate through", () => {
        expect(new UplinkCeiling().limit(null, 0)).toBeNull();
    });
});
