import { describe, expect, it } from "vitest";
import {
    nativeBitrateChanged,
    nativeBitrateTarget,
    nativeSenderBitrate,
    NATIVE_SENDER_BITRATE_FLOOR,
} from "./nativeShareBitrate";

describe("nativeBitrateTarget", () => {
    it("keeps the picked bitrate when the uplink is roomy", () => {
        expect(nativeBitrateTarget(6_000_000, 50_000_000)).toBe(6_000_000);
    });

    it("holds the bitrate to 85% of a smaller uplink", () => {
        expect(nativeBitrateTarget(6_000_000, 4_000_000)).toBe(3_400_000);
    });

    it("keeps the picked bitrate while the uplink is unknown", () => {
        expect(nativeBitrateTarget(6_000_000, null)).toBe(6_000_000);
        expect(nativeBitrateTarget(6_000_000, undefined)).toBe(6_000_000);
        expect(nativeBitrateTarget(6_000_000, 0)).toBe(6_000_000);
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
