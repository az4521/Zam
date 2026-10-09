import { describe, it, expect } from "vitest";
import {
    nextBackfillLimit,
    updateVisibleRatio,
    countRowsAbove,
    BACKFILL_MAX_EVENTS,
    BACKFILL_MIN_EVENTS,
    INITIAL_VISIBLE_RATIO,
} from "./backfillSizing";

describe("nextBackfillLimit", () => {
    it("asks for the usual page in an ordinary room", () => {
        expect(nextBackfillLimit(30, INITIAL_VISIBLE_RATIO)).toBe(15);
    });

    it("scales up when few events are visible", () => {
        // 1 in 4 visible: 15 rows need 60 events.
        expect(nextBackfillLimit(30, 0.25)).toBe(60);
    });

    it("stays within bounds", () => {
        expect(nextBackfillLimit(30, 0)).toBe(BACKFILL_MAX_EVENTS);
        expect(nextBackfillLimit(1, 1)).toBe(BACKFILL_MIN_EVENTS);
        expect(nextBackfillLimit(-5, 1)).toBe(BACKFILL_MIN_EVENTS);
    });
});

describe("updateVisibleRatio", () => {
    it("moves halfway toward the last page's share", () => {
        expect(updateVisibleRatio(1, 0, 15)).toBe(0.5);
        expect(updateVisibleRatio(0.5, 15, 15)).toBe(0.75);
    });

    it("converges in a join-heavy room so pages grow", () => {
        let ratio = INITIAL_VISIBLE_RATIO;
        const limits: number[] = [];
        for (let i = 0; i < 5; i++) {
            const limit = nextBackfillLimit(30, ratio);
            limits.push(limit);
            // 1 visible message per 50 events.
            ratio = updateVisibleRatio(ratio, Math.round(limit / 50), limit);
        }
        expect(limits[0]).toBe(15);
        expect(limits.at(-1)).toBe(BACKFILL_MAX_EVENTS);
    });

    it("ignores an empty request and clamps odd input", () => {
        expect(updateVisibleRatio(0.3, 5, 0)).toBe(0.3);
        expect(updateVisibleRatio(0, 40, 20)).toBe(0.5);
        expect(updateVisibleRatio(1, -3, 20)).toBe(0.5);
    });
});

describe("countRowsAbove", () => {
    const rows = (bottoms: number[]) =>
        bottoms.map((bottom) => ({
            getBoundingClientRect: () => ({ bottom }),
        }));

    it("counts rows ending at or above the line", () => {
        expect(countRowsAbove(rows([10, 20, 30, 40]), 25)).toBe(2);
        expect(countRowsAbove(rows([10, 20, 30, 40]), 20)).toBe(2);
        expect(countRowsAbove(rows([10, 20, 30, 40]), 0)).toBe(0);
        expect(countRowsAbove(rows([10, 20, 30, 40]), 99)).toBe(4);
        expect(countRowsAbove(rows([]), 5)).toBe(0);
    });
});
