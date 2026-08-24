import { describe, it, expect } from "vitest";
import { decideDrawerSnap, MIN_SNAP_MS, MAX_SNAP_MS } from "./drawerSnap";

const WIDTH = 312;
// translate (px, in [-WIDTH, 0]) that leaves the drawer at a given open fraction.
const at = (progress: number) => progress * WIDTH - WIDTH;

describe("decideDrawerSnap", () => {
    it("opens on a slow drag dragged past the midpoint", () => {
        expect(decideDrawerSnap(at(0.6), WIDTH, 0).open).toBe(true);
    });

    it("stays closed on a slow drag that stops short of the midpoint", () => {
        expect(decideDrawerSnap(at(0.4), WIDTH, 0).open).toBe(false);
    });

    it("opens on a fast flick toward open even below the midpoint", () => {
        expect(decideDrawerSnap(at(0.2), WIDTH, 0.6).open).toBe(true);
    });

    it("closes on a fast flick toward closed even above the midpoint", () => {
        expect(decideDrawerSnap(at(0.8), WIDTH, -0.6).open).toBe(false);
    });

    it("settles faster after a hard flick than after a slow release over the same distance", () => {
        const from = at(0.5);
        const flick = decideDrawerSnap(from, WIDTH, 1.5).durationMs;
        const slow = decideDrawerSnap(from, WIDTH, 0).durationMs;
        expect(flick).toBeLessThan(slow);
    });

    it("clamps a slow full-width settle to the max snap duration", () => {
        // Barely flicked open from fully closed: full width to travel, near-zero speed.
        expect(decideDrawerSnap(at(0), WIDTH, 0.4).durationMs).toBe(
            MAX_SNAP_MS,
        );
    });

    it("clamps a hard flick to the min snap duration", () => {
        expect(decideDrawerSnap(at(0.5), WIDTH, 5).durationMs).toBe(
            MIN_SNAP_MS,
        );
    });

    it("clamps an over-drag past the open edge to a valid open decision", () => {
        const d = decideDrawerSnap(50, WIDTH, 0);
        expect(d.open).toBe(true);
        expect(d.durationMs).toBeGreaterThanOrEqual(MIN_SNAP_MS);
        expect(d.durationMs).toBeLessThanOrEqual(MAX_SNAP_MS);
    });
});
