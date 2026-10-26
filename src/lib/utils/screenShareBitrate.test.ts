import { describe, it, expect } from "vitest";
import {
    BITRATE_SLIDER_STEPS,
    DEFAULT_SCREEN_SHARE_BITRATE,
    MIN_SCREEN_SHARE_BITRATE,
    UNMEASURED_CEILING,
    bitrateCeiling,
    bitrateFromSlider,
    bitrateParts,
    clampBitrate,
    roundBitrate,
    sliderFromBitrate,
} from "./screenShareBitrate";

describe("bitrateCeiling", () => {
    it("is 10% under the measured upload", () => {
        expect(bitrateCeiling(20_000_000)).toBe(18_000_000);
        expect(bitrateCeiling(1_000_000)).toBe(900_000);
    });

    it("never goes under the minimum", () => {
        expect(bitrateCeiling(200_000)).toBe(MIN_SCREEN_SHARE_BITRATE);
    });

    it("uses the unmeasured ceiling without a measurement", () => {
        expect(bitrateCeiling(null)).toBe(UNMEASURED_CEILING);
        expect(bitrateCeiling(0)).toBe(UNMEASURED_CEILING);
        expect(bitrateCeiling(Number.NaN)).toBe(UNMEASURED_CEILING);
    });
});

describe("clampBitrate", () => {
    it("keeps a pick between the minimum and the ceiling", () => {
        expect(clampBitrate(4_000_000, 10_000_000)).toBe(4_000_000);
        expect(clampBitrate(40_000_000, 10_000_000)).toBe(10_000_000);
        expect(clampBitrate(1000, 10_000_000)).toBe(MIN_SCREEN_SHARE_BITRATE);
    });

    it("falls back to the default for a non-number", () => {
        expect(clampBitrate(Number.NaN, 10_000_000)).toBe(
            DEFAULT_SCREEN_SHARE_BITRATE,
        );
        expect(clampBitrate(Number.NaN, 2_000_000)).toBe(2_000_000);
    });
});

describe("the bitrate slider", () => {
    const ceiling = 18_000_000;

    it("runs from the minimum to the ceiling", () => {
        expect(bitrateFromSlider(0, ceiling)).toBe(MIN_SCREEN_SHARE_BITRATE);
        expect(bitrateFromSlider(BITRATE_SLIDER_STEPS, ceiling)).toBe(ceiling);
    });

    it("is logarithmic: the middle is the geometric mean", () => {
        const mid = bitrateFromSlider(BITRATE_SLIDER_STEPS / 2, ceiling);
        const geometric = Math.sqrt(MIN_SCREEN_SHARE_BITRATE * ceiling);
        expect(Math.abs(mid - geometric)).toBeLessThan(100_000);
    });

    it("only ever lands on rounded values inside the range", () => {
        let prev = 0;
        for (let p = 0; p <= BITRATE_SLIDER_STEPS; p += 7) {
            const bps = bitrateFromSlider(p, ceiling);
            expect(bps).toBeGreaterThanOrEqual(MIN_SCREEN_SHARE_BITRATE);
            expect(bps).toBeLessThanOrEqual(ceiling);
            expect(bps).toBeGreaterThanOrEqual(prev);
            expect(roundBitrate(bps)).toBe(bps);
            prev = bps;
        }
    });

    it("puts a bitrate back where it came from", () => {
        for (const bps of [300_000, 750_000, 4_000_000, 12_000_000]) {
            const back = bitrateFromSlider(
                sliderFromBitrate(bps, ceiling),
                ceiling,
            );
            expect(Math.abs(back - bps) / bps).toBeLessThan(0.03);
        }
    });

    it("pins to the top when the ceiling is the minimum", () => {
        const low = MIN_SCREEN_SHARE_BITRATE;
        expect(sliderFromBitrate(5_000_000, low)).toBe(BITRATE_SLIDER_STEPS);
        expect(bitrateFromSlider(0, low)).toBe(low);
    });

    it("shows a pick above the ceiling at the top", () => {
        expect(sliderFromBitrate(50_000_000, ceiling)).toBe(
            BITRATE_SLIDER_STEPS,
        );
    });
});

describe("bitrateParts", () => {
    it("uses kbps under 1 Mbps and Mbps above", () => {
        expect(bitrateParts(750_000)).toEqual({ unit: "kbps", n: "750" });
        expect(bitrateParts(4_500_000)).toEqual({ unit: "mbps", n: "4.5" });
        expect(bitrateParts(18_000_000)).toEqual({ unit: "mbps", n: "18" });
    });
});
