import { describe, it, expect } from "vitest";
import { anchoredActiveIndex } from "./listboxAnchor";

const KEYS = ["a", "b", "c"];

describe("anchoredActiveIndex", () => {
    it("keeps the cursor while the anchored option is still at that index", () => {
        expect(anchoredActiveIndex(1, "b", KEYS)).toBe(1);
    });

    it("keeps a cursor on the first and the last option", () => {
        expect(anchoredActiveIndex(0, "a", KEYS)).toBe(0);
        expect(anchoredActiveIndex(2, "c", KEYS)).toBe(2);
    });

    it("drops the cursor when the whole list was replaced under it", () => {
        // A debounced search landing, or a tab flip: index 1 is still in range,
        // so clamping alone would have left a cursor on someone else's item.
        expect(anchoredActiveIndex(1, "b", ["x", "y", "z"])).toBe(-1);
    });

    it("drops the cursor when the anchored option shifted position", () => {
        // "a" was removed, so "b" is now index 0 and index 1 holds "c".
        expect(anchoredActiveIndex(1, "b", ["b", "c"])).toBe(-1);
    });

    it("does not re-point the cursor at wherever the anchor moved to", () => {
        // "c" is still in the list, at index 2. Following it would move the
        // selection without re-announcing it, which is the bug, not the fix.
        expect(anchoredActiveIndex(1, "c", KEYS)).toBe(-1);
    });

    it("reports nothing active for an empty list", () => {
        expect(anchoredActiveIndex(0, "a", [])).toBe(-1);
    });

    it("reports nothing active when the index fell off the end", () => {
        expect(anchoredActiveIndex(3, "c", KEYS)).toBe(-1);
    });

    it("reports nothing active when there is no anchor", () => {
        expect(anchoredActiveIndex(1, null, KEYS)).toBe(-1);
    });

    it("does not match an out-of-range index against an undefined anchor", () => {
        // A caller that built its anchor from `keys[i]` without an `?? null`
        // holds `undefined` once `i` runs off the end — and `keys[99]` is
        // `undefined` too, so an unclamped comparison would call that stale
        // cursor active and let Enter fire on nothing.
        const noAnchor = undefined as unknown as string | null;
        expect(anchoredActiveIndex(99, noAnchor, KEYS)).toBe(-1);
    });
});
