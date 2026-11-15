import { describe, it, expect } from "vitest";
import { swipeCommits, swipeSettleMs } from "./lightboxSwipe";

describe("swipeCommits", () => {
    it("does not step on a short slow drag", () => {
        // 60px is under min(100, 0.2 * 375) = 75px, and too slow to flick.
        expect(swipeCommits(-60, 300, 375)).toBe(false);
    });

    it("steps once past a fifth of the viewport", () => {
        expect(swipeCommits(-80, 300, 375)).toBe(true);
    });

    it("caps the distance threshold at 100px on wide viewports", () => {
        expect(swipeCommits(-90, 300, 1000)).toBe(false);
        expect(swipeCommits(-101, 300, 1000)).toBe(true);
    });

    it("steps on a quick flick that has gone far enough", () => {
        expect(swipeCommits(-40, 50, 375)).toBe(true);
    });

    it("does not step on a flick too short to count", () => {
        expect(swipeCommits(-20, 10, 375)).toBe(false);
    });

    it("treats direction symmetrically", () => {
        expect(swipeCommits(80, 300, 375)).toBe(true);
        expect(swipeCommits(-80, 300, 375)).toBe(true);
    });
});

describe("swipeSettleMs", () => {
    it("settles a nudge in the minimum time", () => {
        expect(swipeSettleMs(0, 375)).toBe(150);
    });

    it("takes the maximum time for a full-screen slide", () => {
        expect(swipeSettleMs(375, 375)).toBe(300);
        expect(swipeSettleMs(10_000, 375)).toBe(300);
    });

    it("scales with the remaining distance in between", () => {
        const half = swipeSettleMs(187.5, 375);
        expect(half).toBeGreaterThan(150);
        expect(half).toBeLessThan(300);
    });

    it("never goes below the minimum for negative or unknown sizes", () => {
        expect(swipeSettleMs(-50, 375)).toBe(150);
        expect(swipeSettleMs(100, 0)).toBe(150);
    });
});
