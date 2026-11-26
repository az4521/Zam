import { describe, it, expect } from "vitest";
import {
    FILE_SHARE_HEADROOM,
    FILE_SHARE_MIN_BPS,
    fileShareMaxBitrate,
    fileSourceBitrate,
} from "./fileShareBitrate";

const MBPS = 1_000_000;
// A 100 s file at `mbps` megabits per second, in bytes.
const sizeFor = (mbps: number, seconds: number) => (mbps * MBPS * seconds) / 8;

describe("fileSourceBitrate", () => {
    it("is size times 8 over duration", () => {
        expect(fileSourceBitrate(sizeFor(4, 100), 100)).toBeCloseTo(4 * MBPS);
    });

    it("is unknown without a size or a length", () => {
        expect(fileSourceBitrate(0, 100)).toBeNull();
        expect(fileSourceBitrate(1000, 0)).toBeNull();
        expect(fileSourceBitrate(1000, Infinity)).toBeNull();
        expect(fileSourceBitrate(Number.NaN, 10)).toBeNull();
    });
});

describe("fileShareMaxBitrate", () => {
    const cap = 100_000_000;

    it("sends a 4 Mbps file at its bitrate plus headroom, not the cap", () => {
        const bps = fileShareMaxBitrate(sizeFor(4, 100), 100, cap);
        expect(bps).toBe(Math.round(4 * MBPS * FILE_SHARE_HEADROOM));
        expect(bps).toBeLessThan(cap);
    });

    it("never goes under the 1 Mbps floor", () => {
        expect(fileShareMaxBitrate(sizeFor(0.1, 100), 100, cap)).toBe(
            FILE_SHARE_MIN_BPS,
        );
    });

    it("never goes over the picked cap", () => {
        expect(fileShareMaxBitrate(sizeFor(50, 100), 100, 8 * MBPS)).toBe(
            8 * MBPS,
        );
    });

    it("a cap under the floor is the cap", () => {
        expect(fileShareMaxBitrate(sizeFor(4, 100), 100, 500_000)).toBe(
            500_000,
        );
    });

    it("uses the cap when the length is unknown", () => {
        expect(fileShareMaxBitrate(sizeFor(4, 100), Infinity, cap)).toBe(cap);
    });
});
