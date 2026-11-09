import { describe, expect, it } from "vitest";
import { RedundancyController, RED_MIN_ON_MS } from "./audioRedundancy";

function feed(c: RedundancyController, losses: number[], start = 0) {
    const out: (boolean | null)[] = [];
    losses.forEach((l, i) => out.push(c.push(l, start + i * 3000)));
    return out;
}

describe("RedundancyController", () => {
    it("stays off on a clean link", () => {
        const c = new RedundancyController();
        expect(feed(c, Array(20).fill(0)).every((r) => r === null)).toBe(true);
        expect(c.on).toBe(false);
    });

    it("ignores a single spike", () => {
        const c = new RedundancyController();
        feed(c, [0, 0, 0.1, 0, 0]);
        expect(c.on).toBe(false);
    });

    it("comes on after sustained loss", () => {
        const c = new RedundancyController();
        const r = feed(c, [0.03, 0.04, 0.05]);
        expect(r[2]).toBe(true);
        expect(c.on).toBe(true);
    });

    it("waits out the minimum on-time, then needs a quiet stretch", () => {
        const c = new RedundancyController();
        feed(c, [0.05, 0.05, 0.05]);
        const quiet = feed(c, Array(10).fill(0), 9000);
        // 10 quiet samples span 27 s, under the minimum.
        expect(quiet.every((r) => r === null)).toBe(true);
        expect(c.on).toBe(true);
        expect(c.push(0, 6000 + RED_MIN_ON_MS)).toBe(false);
        expect(c.on).toBe(false);
    });

    it("stays on while loss lingers just above the off threshold", () => {
        const c = new RedundancyController();
        feed(c, [0.05, 0.05, 0.05]);
        for (let i = 0; i < 30; i++) c.push(i % 5 === 0 ? 0.01 : 0, 70_000 + i);
        expect(c.on).toBe(true);
    });

    it("ignores missing samples", () => {
        const c = new RedundancyController();
        expect(c.push(null, 0)).toBeNull();
        expect(c.push(Number.NaN, 0)).toBeNull();
    });
});
