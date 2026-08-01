import { describe, expect, it } from "vitest";
import {
    clampActiveIndex,
    nextActiveIndex,
    optionId,
} from "./listboxNavigation";

describe("nextActiveIndex", () => {
    it("moves down from nothing active to the first option", () => {
        expect(nextActiveIndex(-1, 3, "ArrowDown")).toBe(0);
    });

    it("moves up from nothing active to the last option", () => {
        expect(nextActiveIndex(-1, 3, "ArrowUp")).toBe(2);
    });

    it("moves down through the list", () => {
        expect(nextActiveIndex(0, 3, "ArrowDown")).toBe(1);
    });

    it("wraps past the end by default", () => {
        expect(nextActiveIndex(2, 3, "ArrowDown")).toBe(0);
    });

    it("wraps before the start by default", () => {
        expect(nextActiveIndex(0, 3, "ArrowUp")).toBe(2);
    });

    it("stops at the end when looping is off", () => {
        expect(nextActiveIndex(2, 3, "ArrowDown", { loop: false })).toBe(2);
    });

    it("stops at the start when looping is off", () => {
        expect(nextActiveIndex(0, 3, "ArrowUp", { loop: false })).toBe(0);
    });

    it("jumps to the first option on Home and the last on End", () => {
        expect(nextActiveIndex(1, 3, "Home")).toBe(0);
        expect(nextActiveIndex(1, 3, "End")).toBe(2);
    });

    it("returns -1 for an empty list whatever the key", () => {
        for (const key of ["ArrowDown", "ArrowUp", "Home", "End"] as const) {
            expect(nextActiveIndex(-1, 0, key)).toBe(-1);
            expect(nextActiveIndex(5, 0, key)).toBe(-1);
        }
    });

    it("recovers from an out-of-range current index", () => {
        expect(nextActiveIndex(99, 3, "ArrowDown")).toBe(0);
    });
});

describe("clampActiveIndex", () => {
    it("keeps a valid index", () => {
        expect(clampActiveIndex(1, 3)).toBe(1);
    });

    it("drops an index past the end back to nothing active", () => {
        expect(clampActiveIndex(5, 3)).toBe(-1);
    });

    it("returns -1 when the list empties", () => {
        expect(clampActiveIndex(0, 0)).toBe(-1);
    });

    it("leaves an already-inactive index inactive", () => {
        expect(clampActiveIndex(-1, 3)).toBe(-1);
    });
});

describe("optionId", () => {
    it("builds a stable per-list id", () => {
        expect(optionId("users", 2)).toBe("users-option-2");
    });

    it("gives different lists different ids", () => {
        expect(optionId("emoji", 2)).not.toBe(optionId("users", 2));
    });
});
