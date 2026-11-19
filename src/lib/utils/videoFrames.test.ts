import { describe, expect, it } from "vitest";
import { planVideoFrames } from "./videoFrames";

const base = { srcWidth: 512, srcHeight: 512, maxSide: 256, maxFrames: 60 };

describe("planVideoFrames", () => {
    it("samples at 30 fps for a short clip", () => {
        const plan = planVideoFrames({ ...base, duration: 2 });
        expect(plan.times).toHaveLength(60);
        expect(plan.times[0]).toBe(0);
        expect(plan.times[1]).toBeCloseTo(2 / 60, 9);
        expect(plan.delayMs).toBe(33);
    });

    it("keeps the frame times ascending and inside the clip", () => {
        const plan = planVideoFrames({ ...base, duration: 1.5 });
        plan.times.forEach((t, i) => {
            expect(t).toBeGreaterThanOrEqual(0);
            expect(t).toBeLessThan(1.5);
            if (i > 0) expect(t).toBeGreaterThan(plan.times[i - 1]);
        });
    });

    it("caps a long clip at maxFrames and stretches the delay", () => {
        const plan = planVideoFrames({ ...base, duration: 3600 });
        expect(plan.times).toHaveLength(60);
        expect(plan.delayMs).toBe(60_000);
        expect(plan.times[59]).toBeCloseTo((59 * 3600) / 60, 6);
    });

    it("keeps the total run time: count times delay is the duration", () => {
        const plan = planVideoFrames({ ...base, duration: 2.5 });
        const total = plan.times.length * plan.delayMs;
        // Each delay is rounded to whole milliseconds, so the sum may drift
        // by at most half a millisecond per frame.
        expect(Math.abs(total - 2500)).toBeLessThanOrEqual(
            plan.times.length / 2,
        );
    });

    it("gives a single frame for a zero-length clip", () => {
        const plan = planVideoFrames({ ...base, duration: 0 });
        expect(plan.times).toEqual([0]);
        expect(plan.delayMs).toBe(10);
    });

    it("gives a single frame for a clip under one frame long", () => {
        const plan = planVideoFrames({ ...base, duration: 0.01 });
        expect(plan.times).toHaveLength(1);
        expect(plan.delayMs).toBe(10);
    });

    it("never makes a delay shorter than 10 ms", () => {
        const plan = planVideoFrames({ ...base, duration: 0.2 });
        expect(plan.delayMs).toBeGreaterThanOrEqual(10);
    });

    it("throws for NaN, infinite or negative duration", () => {
        expect(() => planVideoFrames({ ...base, duration: NaN })).toThrow();
        expect(() =>
            planVideoFrames({ ...base, duration: Infinity }),
        ).toThrow();
        expect(() => planVideoFrames({ ...base, duration: -1 })).toThrow();
    });

    it("throws when the picture has no size", () => {
        expect(() =>
            planVideoFrames({ ...base, srcWidth: 0, duration: 1 }),
        ).toThrow();
        expect(() =>
            planVideoFrames({ ...base, srcHeight: NaN, duration: 1 }),
        ).toThrow();
    });

    it("scales the longer side to maxSide and keeps the aspect ratio", () => {
        const plan = planVideoFrames({
            ...base,
            srcWidth: 512,
            srcHeight: 256,
            duration: 1,
        });
        expect(plan.width).toBe(256);
        expect(plan.height).toBe(128);
    });

    it("never upscales a small picture", () => {
        const plan = planVideoFrames({
            ...base,
            srcWidth: 100,
            srcHeight: 50,
            duration: 1,
        });
        expect(plan.width).toBe(100);
        expect(plan.height).toBe(50);
    });

    it("keeps tiny pictures at least one pixel", () => {
        const plan = planVideoFrames({
            ...base,
            srcWidth: 1,
            srcHeight: 1000,
            duration: 1,
        });
        expect(plan.height).toBe(256);
        expect(plan.width).toBe(1);
    });

    it("rounds a very wide picture so the short side stays at least 1", () => {
        const plan = planVideoFrames({
            ...base,
            srcWidth: 10_000,
            srcHeight: 1,
            duration: 1,
        });
        expect(plan.width).toBe(256);
        expect(plan.height).toBe(1);
    });
});
