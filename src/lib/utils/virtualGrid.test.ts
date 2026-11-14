import { describe, it, expect } from "vitest";
import {
    buildGridLayout,
    rowAt,
    visibleRowRange,
    scrollTopToReveal,
    indexRange,
} from "./virtualGrid";

const M = { cols: 4, cellSize: 36, gap: 4, headerHeight: 28, sectionGap: 8 };

describe("buildGridLayout", () => {
    it("lays out headers and rows with section gaps", () => {
        const { rows, itemRow, total } = buildGridLayout(
            [
                { id: "a", label: "A", start: 0, count: 6 },
                { id: "b", label: "B", start: 6, count: 4 },
            ],
            10,
            M,
        );
        expect(rows.map((r) => [r.kind, r.sectionId, r.top])).toEqual([
            ["header", "a", 0],
            ["cells", "a", 28],
            ["cells", "a", 68],
            ["header", "b", 112], // 68 + 40 row + (8 - 4) section gap
            ["cells", "b", 140],
        ]);
        expect(total).toBe(184);
        expect([...itemRow]).toEqual([1, 1, 1, 1, 2, 2, 4, 4, 4, 4]);
        const last = rows[2];
        expect(last.kind === "cells" && [last.start, last.end]).toEqual([4, 6]);
    });

    it("draws a header-less section and an empty pack's header", () => {
        const { rows } = buildGridLayout(
            [
                { id: "empty", label: "E", start: 0, count: 0 },
                { id: "s", label: null, start: 0, count: 2 },
            ],
            2,
            M,
        );
        expect(rows.map((r) => r.kind)).toEqual(["header", "cells"]);
        expect(rows[1].top).toBe(28);
    });

    it("is empty until the grid has been measured", () => {
        const l = buildGridLayout(
            [{ id: "a", label: "A", start: 0, count: 3 }],
            3,
            { ...M, cellSize: 0 },
        );
        expect(l.rows).toEqual([]);
        expect(l.total).toBe(0);
    });
});

describe("row lookup", () => {
    const { rows } = buildGridLayout(
        [{ id: "a", label: "A", start: 0, count: 40 }],
        40,
        M,
    );

    it("finds the row under a y position", () => {
        expect(rowAt(rows, -100)).toBe(0);
        expect(rowAt(rows, 27)).toBe(0);
        expect(rowAt(rows, 28)).toBe(1);
        expect(rowAt(rows, 1e9)).toBe(rows.length);
    });

    it("renders only the window plus overscan", () => {
        const r = visibleRowRange(rows, 200, 100, 0);
        expect(rows[r.from].top).toBeLessThanOrEqual(200);
        expect(rows[r.to - 1].top).toBeLessThan(300);
        expect(r.to - r.from).toBeLessThanOrEqual(5);
    });

    it("scrolls just enough to reveal a row", () => {
        const row = rows[5]; // top 188, h 40
        expect(scrollTopToReveal(row, 0, 100)).toBe(128);
        expect(scrollTopToReveal(row, 300, 100)).toBe(188);
        expect(scrollTopToReveal(row, 150, 100)).toBeNull();
    });
});

it("indexRange", () => {
    expect(indexRange(3, 6)).toEqual([3, 4, 5]);
});
