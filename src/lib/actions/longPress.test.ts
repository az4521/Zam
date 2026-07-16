import { describe, it, expect } from "vitest";
import { exceededMove } from "./longPress";

describe("exceededMove", () => {
    it("is false below tolerance", () => {
        expect(exceededMove(3, 4, 10)).toBe(false); // distance 5
    });

    it("is false at exactly the tolerance", () => {
        expect(exceededMove(6, 8, 10)).toBe(false); // distance 10, not > 10
    });

    it("is true past the tolerance", () => {
        expect(exceededMove(9, 12, 10)).toBe(true); // distance 15
    });

    it("handles negative deltas", () => {
        expect(exceededMove(-9, -12, 10)).toBe(true); // distance 15
    });
});
