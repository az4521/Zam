// src/lib/utils/lruMemo.test.ts
import { describe, it, expect, vi } from "vitest";
import { createLruMemo } from "./lruMemo";

describe("createLruMemo", () => {
    it("computes on a miss and returns the value", () => {
        const memo = createLruMemo<number>(10);
        expect(memo.get("a", () => 1)).toBe(1);
    });

    it("returns the cached value on a hit without recomputing", () => {
        const memo = createLruMemo<number>(10);
        const compute = vi.fn(() => 1);
        memo.get("a", compute);
        expect(memo.get("a", compute)).toBe(1);
        expect(compute).toHaveBeenCalledTimes(1);
    });

    it("keeps distinct keys independent", () => {
        const memo = createLruMemo<string>(10);
        expect(memo.get("a", () => "A")).toBe("A");
        expect(memo.get("b", () => "B")).toBe("B");
        expect(memo.get("a", () => "X")).toBe("A"); // still cached
    });

    it("evicts the oldest entry past the cap", () => {
        const memo = createLruMemo<string>(2);
        memo.get("a", () => "A");
        memo.get("b", () => "B");
        memo.get("c", () => "C"); // evicts "a"
        expect(memo.size).toBe(2);
        const recompute = vi.fn(() => "A2");
        expect(memo.get("a", recompute)).toBe("A2"); // "a" gone → recomputed
        expect(recompute).toHaveBeenCalledTimes(1);
    });

    it("treats a hit as most-recently-used (recency, not insertion)", () => {
        const memo = createLruMemo<string>(2);
        memo.get("a", () => "A");
        memo.get("b", () => "B");
        memo.get("a", () => "A"); // touch "a" → "b" is now oldest
        memo.get("c", () => "C"); // evicts "b", NOT "a"
        const aCompute = vi.fn(() => "A2");
        expect(memo.get("a", aCompute)).toBe("A"); // "a" survived
        expect(aCompute).not.toHaveBeenCalled();
        const bCompute = vi.fn(() => "B2");
        expect(memo.get("b", bCompute)).toBe("B2"); // "b" was evicted
        expect(bCompute).toHaveBeenCalledTimes(1);
    });

    it("clear() empties the cache", () => {
        const memo = createLruMemo<number>(10);
        memo.get("a", () => 1);
        memo.clear();
        expect(memo.size).toBe(0);
        const recompute = vi.fn(() => 2);
        expect(memo.get("a", recompute)).toBe(2);
        expect(recompute).toHaveBeenCalledTimes(1);
    });

    it("caches falsy values (does not recompute an empty string)", () => {
        const memo = createLruMemo<string>(10);
        const compute = vi.fn(() => "");
        memo.get("a", compute);
        expect(memo.get("a", compute)).toBe("");
        expect(compute).toHaveBeenCalledTimes(1);
    });
});
