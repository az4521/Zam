import { describe, expect, it } from "vitest";
import {
    nextWindow,
    rowOffsets,
    rowsInRange,
    windowAround,
} from "./timelineWindow";

const even = (n: number, h = 100) => rowOffsets(Array(n).fill(h));

describe("rowsInRange", () => {
    it("finds the rows overlapping a range", () => {
        const o = even(10);
        expect(rowsInRange(o, 250, 450)).toEqual({ start: 2, end: 5 });
        expect(rowsInRange(o, 200, 400)).toEqual({ start: 2, end: 4 });
    });

    it("clamps to the list", () => {
        const o = even(10);
        expect(rowsInRange(o, -500, 50)).toEqual({ start: 0, end: 1 });
        expect(rowsInRange(o, 950, 5000)).toEqual({ start: 9, end: 10 });
        expect(rowsInRange(o, 2000, 3000)).toEqual({ start: 10, end: 10 });
    });

    it("handles uneven rows", () => {
        const o = rowOffsets([10, 500, 10, 10]);
        expect(rowsInRange(o, 100, 200)).toEqual({ start: 1, end: 2 });
    });
});

describe("nextWindow", () => {
    const base = { offsets: even(1000), margin: 500 };

    it("mounts the viewport plus a margin each side", () => {
        const w = nextWindow({
            ...base,
            viewTop: 50_000,
            viewBottom: 51_000,
            current: { start: 0, end: 0 },
        });
        expect(w).toEqual({ start: 495, end: 515 });
    });

    it("keeps the current window for small scrolls", () => {
        const current = { start: 495, end: 515 };
        const w = nextWindow({
            ...base,
            viewTop: 50_100,
            viewBottom: 51_100,
            current,
        });
        expect(w).toEqual(current);
    });

    it("moves once the viewport nears the window's edge", () => {
        const w = nextWindow({
            ...base,
            viewTop: 49_300,
            viewBottom: 50_300,
            current: { start: 495, end: 515 },
        });
        expect(w).toEqual({ start: 488, end: 508 });
    });

    it("drops a window holding far more than the viewport", () => {
        const w = nextWindow({
            ...base,
            viewTop: 50_000,
            viewBottom: 51_000,
            current: { start: 0, end: 1000 },
        });
        expect(w).toEqual({ start: 495, end: 515 });
    });

    it("follows the newest row at the bottom", () => {
        const w = nextWindow({
            ...base,
            viewTop: 99_000,
            viewBottom: 100_000,
            current: { start: 980, end: 990 },
            stickToEnd: true,
        });
        expect(w.end).toBe(1000);
    });

    it("stretches over pinned rows", () => {
        const w = nextWindow({
            ...base,
            viewTop: 50_000,
            viewBottom: 51_000,
            current: { start: 0, end: 0 },
            pinned: { start: 300, end: 301 },
        });
        expect(w).toEqual({ start: 300, end: 515 });
    });

    it("never mounts nothing", () => {
        const w = nextWindow({
            ...base,
            viewTop: 500_000,
            viewBottom: 501_000,
            current: { start: 0, end: 0 },
        });
        expect(w).toEqual({ start: 999, end: 1000 });
        expect(
            nextWindow({
                ...base,
                offsets: [0],
                viewTop: 0,
                viewBottom: 10,
                current: { start: 0, end: 0 },
            }),
        ).toEqual({ start: 0, end: 0 });
    });

    it("recomputes a window left over from a longer list", () => {
        const w = nextWindow({
            ...base,
            offsets: even(10),
            viewTop: 0,
            viewBottom: 1000,
            current: { start: 495, end: 515 },
        });
        expect(w).toEqual({ start: 0, end: 10 });
    });
});

describe("windowAround", () => {
    it("centres on a row and stays inside the list", () => {
        expect(windowAround(500, 1000, 40)).toEqual({ start: 480, end: 520 });
        expect(windowAround(3, 1000, 40)).toEqual({ start: 0, end: 40 });
        expect(windowAround(998, 1000, 40)).toEqual({ start: 960, end: 1000 });
        expect(windowAround(2, 5, 40)).toEqual({ start: 0, end: 5 });
    });
});
