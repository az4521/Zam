import { describe, expect, it } from "vitest";
import {
    PACK_SHEET_CACHE_MAX_BYTES,
    PACK_SHEET_CACHE_MAX_ENTRIES,
    SHEET_COLS,
    SHEET_FORMAT_VERSION,
    SHEET_MAX_CELLS,
    cellStyle,
    chunkPack,
    likelyAnimated,
    parsePackSheetIndex,
    parseSheetMeta,
    planPackSheetEviction,
    sheetDimensions,
    sheetKey,
    sheetRows,
    type PackSheetMeta,
} from "./packSheetPlan";

const img = (n: number) => ({ mxc: `mxc://ex.org/${n}` });

describe("chunkPack", () => {
    it("dedupes by mxc keeping the first, preserving order", () => {
        const out = chunkPack([
            { mxc: "mxc://a/1", mimetype: "image/png" },
            { mxc: "mxc://a/2" },
            { mxc: "mxc://a/1", mimetype: "image/gif" },
        ]);
        expect(out).toHaveLength(1);
        expect(out[0].map((i) => i.mxc)).toEqual(["mxc://a/1", "mxc://a/2"]);
        expect(out[0][0].mimetype).toBe("image/png");
    });

    it("splits at 64 cells", () => {
        const images = Array.from({ length: 150 }, (_, i) => img(i));
        const out = chunkPack(images);
        expect(out.map((c) => c.length)).toEqual([64, 64, 22]);
        expect(out.flat().map((i) => i.mxc)).toEqual(images.map((i) => i.mxc));
    });

    it("returns nothing for an empty pack and skips junk", () => {
        expect(chunkPack([])).toEqual([]);
        expect(
            chunkPack([{ mxc: "" }, null as unknown as { mxc: string }]),
        ).toEqual([]);
        expect(SHEET_MAX_CELLS).toBe(64);
    });
});

describe("sheetKey", () => {
    it("is stable for the same list", () => {
        const a = sheetKey("emoji", ["mxc://a/1", "mxc://a/2"]);
        expect(sheetKey("emoji", ["mxc://a/1", "mxc://a/2"])).toBe(a);
    });

    it("changes with order, kind and content", () => {
        const base = sheetKey("emoji", ["mxc://a/1", "mxc://a/2"]);
        expect(sheetKey("emoji", ["mxc://a/2", "mxc://a/1"])).not.toBe(base);
        expect(sheetKey("sticker", ["mxc://a/1", "mxc://a/2"])).not.toBe(base);
        expect(sheetKey("emoji", ["mxc://a/1"])).not.toBe(base);
    });

    it("is a URL-safe token", () => {
        expect(sheetKey("emoji", [])).toMatch(/^emoji-[0-9a-f]+$/);
        expect(sheetKey("sticker", ["mxc://a/b c"])).toMatch(
            /^[A-Za-z0-9_-]+$/,
        );
    });
});

describe("sheet geometry", () => {
    it("rows round up over the column count", () => {
        expect(sheetRows(1)).toBe(1);
        expect(sheetRows(SHEET_COLS)).toBe(1);
        expect(sheetRows(SHEET_COLS + 1)).toBe(2);
        expect(sheetRows(64)).toBe(8);
    });

    it("sheet pixel size follows the kind's cell", () => {
        expect(sheetDimensions("emoji", 9)).toEqual({
            width: 768,
            height: 192,
        });
        expect(sheetDimensions("sticker", 64)).toEqual({
            width: 1024,
            height: 1024,
        });
    });
});

describe("likelyAnimated", () => {
    it("is true for a sniffed animation, a hint, or an animated mimetype", () => {
        expect(likelyAnimated({ mxc: "x" }, true)).toBe(true);
        expect(likelyAnimated({ mxc: "x", animatedHint: true }, false)).toBe(
            true,
        );
        expect(likelyAnimated({ mxc: "x", mimetype: "image/gif" }, false)).toBe(
            true,
        );
        expect(
            likelyAnimated({ mxc: "x", mimetype: "image/apng" }, false),
        ).toBe(true);
    });

    it("is false for a still image with no hint", () => {
        expect(likelyAnimated({ mxc: "x", mimetype: "image/png" }, false)).toBe(
            false,
        );
        expect(likelyAnimated({ mxc: "x" }, false)).toBe(false);
    });
});

describe("cellStyle", () => {
    const url = "blob:https://app.example/3f2a-1b";

    it("places the corners at 0% and 100%", () => {
        expect(cellStyle(url, 0, 2)).toBe(
            `background-image:url("${url}");background-size:800% 200%;background-position:0% 0%;background-repeat:no-repeat`,
        );
        expect(cellStyle(url, 7, 2)).toContain("background-position:100% 0%");
        expect(cellStyle(url, 8, 2)).toContain("background-position:0% 100%");
        expect(cellStyle(url, 15, 2)).toContain(
            "background-position:100% 100%",
        );
    });

    it("uses the same percent math as emojiSprites", () => {
        // 10 rows: cell (col 3, row 4) is at x = 3/7, y = 4/9.
        const style = cellStyle(url, 4 * SHEET_COLS + 3, 10);
        expect(style).toContain(
            `background-position:${(3 / 7) * 100}% ${(4 / 9) * 100}%`,
        );
        expect(style).toContain("background-size:800% 1000%");
    });

    it("returns empty for a non-blob url or a bad index", () => {
        expect(cellStyle("https://x.example/a.png", 0, 1)).toBe("");
        expect(cellStyle('blob:x")bad', 0, 1)).toBe("");
        expect(cellStyle(url, 8, 1)).toBe("");
        expect(cellStyle(url, -1, 1)).toBe("");
        expect(cellStyle(url, 0.5, 1)).toBe("");
        expect(cellStyle(url, 0, 0)).toBe("");
    });
});

describe("parsePackSheetIndex", () => {
    it("keeps good entries and drops junk", () => {
        const out = parsePackSheetIndex([
            { key: "emoji-abc", bytes: 10, lastUsed: 5 },
            { key: "emoji-abc", bytes: 99, lastUsed: 6 },
            { key: "bad key!", bytes: 1, lastUsed: 1 },
            { key: "x", bytes: -1, lastUsed: 1 },
            { key: "y", bytes: 1, lastUsed: "now" },
            null,
            "junk",
        ]);
        expect(out).toEqual([{ key: "emoji-abc", bytes: 10, lastUsed: 5 }]);
    });

    it("returns an empty index for anything that is not an array", () => {
        expect(parsePackSheetIndex(null)).toEqual([]);
        expect(parsePackSheetIndex({ a: 1 })).toEqual([]);
        expect(parsePackSheetIndex("x")).toEqual([]);
    });
});

describe("planPackSheetEviction", () => {
    it("drops nothing within the limits", () => {
        const index = [
            { key: "a", bytes: 1000, lastUsed: 1 },
            { key: "b", bytes: 1000, lastUsed: 2 },
        ];
        expect(planPackSheetEviction(index, 10)).toEqual([]);
    });

    it("drops least recently used first until the byte cap holds", () => {
        const half = PACK_SHEET_CACHE_MAX_BYTES / 2;
        const index = [
            { key: "new", bytes: half, lastUsed: 30 },
            { key: "old", bytes: half, lastUsed: 10 },
            { key: "mid", bytes: half, lastUsed: 20 },
        ];
        expect(planPackSheetEviction(index, 100)).toEqual(["old"]);
    });

    it("drops by entry count too", () => {
        const index = Array.from(
            { length: PACK_SHEET_CACHE_MAX_ENTRIES + 2 },
            (_, i) => ({
                key: `k${i}`,
                bytes: 1,
                lastUsed: i,
            }),
        );
        expect(planPackSheetEviction(index, 1e9)).toEqual(["k0", "k1"]);
    });

    it("treats a future lastUsed as now", () => {
        const half = PACK_SHEET_CACHE_MAX_BYTES / 2;
        const index = [
            { key: "skewed", bytes: half, lastUsed: 1e15 },
            { key: "fresh", bytes: half, lastUsed: 50 },
            { key: "extra", bytes: 1, lastUsed: 60 },
        ];
        // "skewed" clamps to now (100), so "fresh" is the oldest.
        expect(planPackSheetEviction(index, 100)).toEqual(["fresh"]);
    });
});

describe("parseSheetMeta", () => {
    const valid = (): PackSheetMeta => ({
        v: SHEET_FORMAT_VERSION,
        kind: "emoji",
        cell: 96,
        cols: SHEET_COLS,
        rows: 2,
        mxcs: Array.from({ length: 9 }, (_, i) => `mxc://a/${i}`),
        animated: Array(9).fill(false),
        missing: Array(9).fill(false),
    });

    it("accepts a well-formed manifest", () => {
        const meta = parseSheetMeta(valid());
        expect(meta).not.toBeNull();
        expect(meta?.rows).toBe(2);
        expect(meta?.mxcs).toHaveLength(9);
    });

    it("rejects a different format version", () => {
        expect(parseSheetMeta({ ...valid(), v: 2 })).toBeNull();
    });

    it("rejects mismatched lengths", () => {
        const m = valid();
        expect(parseSheetMeta({ ...m, animated: [false] })).toBeNull();
        expect(parseSheetMeta({ ...m, missing: [] })).toBeNull();
    });

    it("rejects a row count that does not fit the cells", () => {
        expect(parseSheetMeta({ ...valid(), rows: 1 })).toBeNull();
    });

    it("rejects unknown kinds, wrong cell sizes and bad values", () => {
        const m = valid();
        expect(parseSheetMeta({ ...m, kind: "avatar" })).toBeNull();
        expect(parseSheetMeta({ ...m, cell: 64 })).toBeNull();
        expect(
            parseSheetMeta({ ...m, mxcs: [1, 2, 3, 4, 5, 6, 7, 8, 9] }),
        ).toBeNull();
        expect(parseSheetMeta(null)).toBeNull();
        expect(parseSheetMeta("junk")).toBeNull();
    });
});
