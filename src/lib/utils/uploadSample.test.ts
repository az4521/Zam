import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_SAMPLE_BPS, uploadSampleBps } from "./uploadSample";

describe("uploadSampleBps", () => {
    it("takes WebRTC's estimate when nothing is sent faster", () => {
        expect(uploadSampleBps(20_000_000, 1_000_000, null)).toBe(20_000_000);
    });

    it("counts a link-bound send above the estimate (probing)", () => {
        // No share sent: a camera sending 30 Mbps on an estimate that has
        // not caught up yet is evidence the line carries it.
        expect(uploadSampleBps(10_000_000, 30_000_000, null)).toBe(30_000_000);
    });

    it("does not count a share sent at its own cap", () => {
        // Picked 51.5 Mbps, the helper sends ~51 Mbps, the line estimate is
        // 40 Mbps: the 51 Mbps is our cap, not the line.
        expect(uploadSampleBps(40_000_000, 51_000_000, 51_500_000)).toBe(
            40_000_000,
        );
    });

    it("still counts a share sent well under its cap", () => {
        expect(uploadSampleBps(10_000_000, 12_000_000, 51_500_000)).toBe(
            12_000_000,
        );
    });

    it("reads zero with nothing known", () => {
        expect(uploadSampleBps(null, null, 4_000_000)).toBe(0);
        expect(uploadSampleBps(0, 0, null)).toBe(0);
    });

    it("caps a sample at the largest share bitrate", () => {
        expect(uploadSampleBps(5_771_069_706, null, null)).toBe(
            MAX_UPLOAD_SAMPLE_BPS,
        );
    });
});
