import { describe, it, expect } from "vitest";
import { softClip } from "./softClip";

describe("softClip", () => {
    it("is exactly linear at normal levels", () => {
        for (const x of [0, 0.1, -0.3, 0.5, -0.8]) expect(softClip(x)).toBe(x);
    });
    it("rounds off loud peaks below full scale", () => {
        const y = softClip(1.5);
        expect(y).toBeGreaterThan(0.8);
        expect(y).toBeLessThan(1);
        expect(softClip(-1.5)).toBe(-y);
    });
    it("never exceeds full scale however hard it is driven", () => {
        expect(softClip(8)).toBeLessThanOrEqual(1);
        expect(softClip(-8)).toBeGreaterThanOrEqual(-1);
    });
    it("is monotonic", () => {
        let prev = -Infinity;
        for (let x = -4; x <= 4; x += 0.01) {
            const y = softClip(x);
            expect(y).toBeGreaterThanOrEqual(prev);
            prev = y;
        }
    });
});
