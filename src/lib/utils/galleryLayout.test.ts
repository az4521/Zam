import { describe, expect, it } from "vitest";
import {
    MAX_ASPECT,
    MIN_ASPECT,
    justifyGallery,
    layoutAspect,
    maxPerRow,
    targetRowHeight,
    thumbnailBox,
} from "./galleryLayout";

describe("layoutAspect", () => {
    it("returns w / h for valid dimensions", () => {
        expect(layoutAspect(1600, 900)).toBeCloseTo(1600 / 900);
        expect(layoutAspect(900, 1600)).toBeCloseTo(900 / 1600);
        expect(layoutAspect(100, 100)).toBe(1);
    });

    it("clamps extreme ratios to the low and high limits", () => {
        expect(layoutAspect(1, 1000)).toBe(MIN_ASPECT);
        expect(layoutAspect(10000, 10)).toBe(MAX_ASPECT);
    });

    it("falls back to 1 for missing, zero, NaN or string dimensions", () => {
        expect(layoutAspect(undefined, 100)).toBe(1);
        expect(layoutAspect(100, undefined)).toBe(1);
        expect(layoutAspect(null, null)).toBe(1);
        expect(layoutAspect(0, 100)).toBe(1);
        expect(layoutAspect(100, 0)).toBe(1);
        expect(layoutAspect(NaN, 100)).toBe(1);
        expect(layoutAspect(100, Number.NaN)).toBe(1);
        expect(layoutAspect(-5, 100)).toBe(1);
        expect(layoutAspect("abc", 100)).toBe(1);
    });

    it("parses numeric strings", () => {
        expect(layoutAspect("200", "100")).toBe(2);
    });
});

describe("targetRowHeight and maxPerRow", () => {
    it("aims for shorter rows on a narrow container", () => {
        expect(targetRowHeight(300)).toBe(115);
        expect(maxPerRow(300)).toBe(3);
    });

    it("aims for taller rows and more items on a wide container", () => {
        expect(targetRowHeight(600)).toBe(180);
        expect(maxPerRow(600)).toBe(4);
    });
});

describe("justifyGallery", () => {
    it("returns no rows for no items or zero width", () => {
        expect(justifyGallery([], 400)).toEqual([]);
        expect(justifyGallery([1, 1], 0)).toEqual([]);
        expect(justifyGallery([1, 1], -10)).toEqual([]);
    });

    it("lays out a single landscape item capped by the width", () => {
        const rows = justifyGallery([2], 300);
        expect(rows).toHaveLength(1);
        expect(rows[0].tiles).toEqual([{ index: 0, width: 300, height: 150 }]);
    });

    it("lays out a single portrait item capped at 320 high", () => {
        const rows = justifyGallery([0.5], 400);
        expect(rows).toHaveLength(1);
        expect(rows[0].height).toBe(320);
        expect(rows[0].tiles).toEqual([{ index: 0, width: 160, height: 320 }]);
    });

    it("packs items into rows with every row's tiles at one height", () => {
        const aspects = [1.5, 0.75, 1, 1.33, 2, 0.6, 1.78, 1];
        for (const width of [300, 600]) {
            const rows = justifyGallery(aspects, width, { gap: 4 });
            for (const row of rows) {
                expect(row.tiles.length).toBeGreaterThan(0);
                for (const tile of row.tiles) {
                    expect(tile.height).toBe(row.height);
                }
            }
        }
    });

    it("makes every filled row's tiles and gaps span the width exactly", () => {
        const aspects = [1.5, 0.75, 1, 1.33, 2, 0.8, 1.78, 1, 1.2, 0.9];
        for (const width of [300, 333, 600, 777]) {
            const gap = 4;
            const rows = justifyGallery(aspects, width, { gap });
            for (const row of rows.slice(0, -1)) {
                const used = row.tiles.reduce((s, t) => s + t.width, 0);
                expect(used + gap * (row.tiles.length - 1)).toBe(width);
            }
        }
    });

    it("keeps each tile's width and height near its clamped aspect", () => {
        const aspects = [1.5, 0.75, 1, 1.33, 2, 0.6, 1.78, 1];
        const rows = justifyGallery(aspects, 600, { gap: 4 });
        for (const row of rows) {
            row.tiles.forEach((tile, pos) => {
                const ar = layoutAspect(aspects[tile.index], 1);
                // A filled row's last tile takes the rounding remainder; the
                // last row can be filled too when a lone item joined it.
                const isRemainder = pos === row.tiles.length - 1;
                const tolerance = isRemainder ? 2 : 1;
                expect(
                    Math.abs(tile.width - ar * tile.height),
                ).toBeLessThanOrEqual(tolerance);
            });
        }
    });

    it("never puts more items in a row than maxPerRow allows", () => {
        const aspects = Array.from({ length: 20 }, () => 2.5);
        const aspectsPortrait = Array.from({ length: 20 }, () => 0.5);
        for (const width of [300, 600]) {
            for (const set of [aspects, aspectsPortrait]) {
                const rows = justifyGallery(set, width, { gap: 4 });
                for (const row of rows) {
                    expect(row.tiles.length).toBeLessThanOrEqual(
                        maxPerRow(width),
                    );
                }
            }
        }
    });

    it("keeps the last row no taller than the target row height", () => {
        const aspects = [1, 1, 1, 1, 1, 1, 1];
        for (const width of [300, 600]) {
            const rows = justifyGallery(aspects, width, { gap: 4 });
            expect(rows.at(-1)!.height).toBeLessThanOrEqual(
                targetRowHeight(width),
            );
        }
    });

    it("does not stretch a row that the per-row cap cut short", () => {
        // Four portrait items at 600px cannot reach the width at the target
        // height, so the first row must stay at or below the target height.
        const rows = justifyGallery([0.5, 0.5, 0.5, 0.5, 0.5], 600, {
            gap: 4,
        });
        expect(rows[0].tiles).toHaveLength(4);
        expect(rows[0].height).toBeLessThanOrEqual(targetRowHeight(600));
    });

    it("covers every index 0..n-1 exactly once, in order", () => {
        const aspects = [1.5, 0.75, 1, 1.33, 2, 0.6, 1.78, 1, 0.5];
        const rows = justifyGallery(aspects, 480, { gap: 4 });
        const indices = rows.flatMap((r) => r.tiles.map((t) => t.index));
        expect(indices).toEqual(aspects.map((_, i) => i));
    });
});

describe("thumbnailBox", () => {
    it("rounds the needed edge up to a shared bucket", () => {
        expect(thumbnailBox(100, 80, 1)).toBe(320);
        expect(thumbnailBox(100, 80, 2)).toBe(320);
        expect(thumbnailBox(200, 150, 2)).toBe(640);
        expect(thumbnailBox(900, 900, 1)).toBe(800);
        expect(thumbnailBox(50, 50, 1)).toBe(96);
    });

    it("treats a missing device pixel ratio as 1", () => {
        expect(thumbnailBox(50, 50, 0)).toBe(96);
    });
});

describe("justifyGallery lone last item", () => {
    it("lays three 4:3 photos out as one row, not 2 + 1", () => {
        for (const width of [343, 480]) {
            const rows = justifyGallery([4 / 3, 4 / 3, 4 / 3], width);
            expect(rows).toHaveLength(1);
            const used = rows[0].tiles.reduce((s, t) => s + t.width, 0);
            expect(used + 8).toBe(width);
        }
    });

    it("leaves a lone item on its own row when joining would be too short", () => {
        // Four wide panoramas: a fifth on the same row would be a sliver.
        const rows = justifyGallery([2.5, 2.5, 2.5], 480);
        expect(rows.length).toBeGreaterThan(1);
    });
});
