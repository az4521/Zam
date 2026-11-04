import { describe, it, expect } from "vitest";
import { distributeColumns, masonryColumnCount } from "./masonry";

const ids = <T>(cols: { item: T }[][]) => cols.map((c) => c.map((p) => p.item));

describe("masonryColumnCount", () => {
    it("matches CSS column-width/column-gap", () => {
        expect(masonryColumnCount(0, 165, 4)).toBe(1);
        expect(masonryColumnCount(333, 165, 4)).toBe(1);
        expect(masonryColumnCount(334, 165, 4)).toBe(2);
        expect(masonryColumnCount(503, 165, 4)).toBe(3);
    });
});

describe("distributeColumns", () => {
    it("round-robins so the list reads across rows", () => {
        expect(ids(distributeColumns([0, 1, 2, 3, 4, 5, 6], 3))).toEqual([
            [0, 3, 6],
            [1, 4],
            [2, 5],
        ]);
    });

    it("keeps each item's flat index", () => {
        const cols = distributeColumns(["a", "b", "c"], 2);
        expect(cols[1]).toEqual([{ item: "b", idx: 1 }]);
    });

    it("greedy mode fills the shortest column, leftmost on ties", () => {
        const h = { a: 3, b: 1, c: 1, d: 1 } as Record<string, number>;
        expect(
            ids(distributeColumns(["a", "b", "c", "d"], 2, (x) => h[x])),
        ).toEqual([["a"], ["b", "c", "d"]]);
    });

    it("appending never moves an already placed item", () => {
        const h = (x: number) => (x % 3) + 1;
        const before = ids(distributeColumns([0, 1, 2, 3, 4], 3, h));
        const after = ids(distributeColumns([0, 1, 2, 3, 4, 5, 6, 7], 3, h));
        before.forEach((col, c) =>
            expect(after[c].slice(0, col.length)).toEqual(col),
        );
    });

    it("treats a bad column count as one column", () => {
        expect(ids(distributeColumns([1, 2], 0))).toEqual([[1, 2]]);
    });
});
