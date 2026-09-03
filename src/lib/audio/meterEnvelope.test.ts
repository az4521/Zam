import { describe, it, expect } from "vitest";
import { smoothMeterLevel, ATTACK_MS, RELEASE_MS } from "./meterEnvelope";

describe("smoothMeterLevel", () => {
    it("rises instantly with instant attack (attackMs 0)", () => {
        // A louder reading must show immediately — this is the anti-lag core.
        expect(smoothMeterLevel(0.1, 0.9, 16, 0, 140)).toBe(0.9);
    });

    it("returns next when prev equals next", () => {
        expect(smoothMeterLevel(0.5, 0.5, 16, 0, 140)).toBe(0.5);
    });

    it("decays only partway toward a lower reading in one frame", () => {
        // release path: moves toward next but does not snap to it.
        const out = smoothMeterLevel(1, 0, 16, 0, 140);
        const coeff = 1 - Math.exp(-16 / 140);
        expect(out).toBeCloseTo(1 - coeff, 6);
        expect(out).toBeGreaterThan(0);
        expect(out).toBeLessThan(1);
    });

    it("decays further when more time has elapsed (frame-rate independent)", () => {
        const small = smoothMeterLevel(1, 0, 8, 0, 140);
        const big = smoothMeterLevel(1, 0, 33, 0, 140);
        // A longer gap decays more, so the LOWER remaining value comes from big dt.
        expect(big).toBeLessThan(small);
    });

    it("effectively snaps down when dt dwarfs the release constant", () => {
        expect(smoothMeterLevel(1, 0, 10_000, 0, 140)).toBeCloseTo(0, 4);
    });

    it("treats a non-positive dt as instant (no divide surprises)", () => {
        expect(smoothMeterLevel(1, 0, 0, 0, 140)).toBe(0);
        expect(smoothMeterLevel(1, 0, -5, 0, 140)).toBe(0);
    });

    it("ships instant attack and a moderate release default", () => {
        expect(ATTACK_MS).toBe(0);
        expect(RELEASE_MS).toBeGreaterThan(60);
        expect(RELEASE_MS).toBeLessThan(400);
    });
});
