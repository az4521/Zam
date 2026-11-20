import { describe, it, expect } from "vitest";
import {
    AUTO_SCREEN_SHARE_BITRATE,
    BITRATE_SLIDER_STEPS,
    DEFAULT_SCREEN_SHARE_BITRATE,
    MAX_SCREEN_SHARE_BITRATE,
    MIN_SCREEN_SHARE_BITRATE,
    SHARE_AUTO_MAX_BPS,
    SHARE_AUTO_START_BPS,
    bitrateFromSlider,
    bitrateParts,
    clampBitrate,
    isAutoBitrate,
    roundBitrate,
    shareBitrateCap,
    shareStartBitrate,
    sliderFromBitrate,
} from "./screenShareBitrate";

describe("shareBitrateCap", () => {
    it("defaults to automatic", () => {
        expect(DEFAULT_SCREEN_SHARE_BITRATE).toBe(AUTO_SCREEN_SHARE_BITRATE);
        expect(isAutoBitrate(DEFAULT_SCREEN_SHARE_BITRATE)).toBe(true);
    });

    it("has no ceiling of its own in automatic mode", () => {
        expect(shareBitrateCap(AUTO_SCREEN_SHARE_BITRATE, null)).toBe(
            SHARE_AUTO_MAX_BPS,
        );
    });

    it("takes a typed-in upload speed as the automatic cap", () => {
        expect(shareBitrateCap(AUTO_SCREEN_SHARE_BITRATE, 12_000_000)).toBe(
            12_000_000,
        );
    });

    it("sends a pick as picked, whatever the upload", () => {
        expect(shareBitrateCap(20_000_000, 4_000_000)).toBe(20_000_000);
        expect(shareBitrateCap(3_000_000, null)).toBe(3_000_000);
        expect(shareBitrateCap(90_000_000, null)).toBe(
            MAX_SCREEN_SHARE_BITRATE,
        );
    });
});

describe("shareStartBitrate", () => {
    it("publishes an uncapped share at a sane start", () => {
        expect(shareStartBitrate(SHARE_AUTO_MAX_BPS)).toBe(
            SHARE_AUTO_START_BPS,
        );
        expect(shareStartBitrate(3_000_000)).toBe(3_000_000);
    });
});

describe("clampBitrate", () => {
    it("keeps a pick between the minimum and the ceiling", () => {
        expect(clampBitrate(4_000_000, 10_000_000)).toBe(4_000_000);
        expect(clampBitrate(40_000_000, 10_000_000)).toBe(10_000_000);
        expect(clampBitrate(1000, 10_000_000)).toBe(MIN_SCREEN_SHARE_BITRATE);
    });

    it("puts automatic (or a non-number) at the top", () => {
        expect(clampBitrate(Number.NaN, 10_000_000)).toBe(10_000_000);
        expect(clampBitrate(0, 10_000_000)).toBe(10_000_000);
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
});

describe("bitrateParts", () => {
    it("uses kbps under 1 Mbps and Mbps above", () => {
        expect(bitrateParts(750_000)).toEqual({ unit: "kbps", n: "750" });
        expect(bitrateParts(4_500_000).unit).toBe("mbps");
    });
});
