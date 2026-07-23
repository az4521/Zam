import { describe, it, expect } from "vitest";
import { moveNeighbours } from "./reorderMove";

describe("moveNeighbours", () => {
    const ids = ["A", "B", "C", "D"];

    it("moves an interior item up: brackets it with the item two-above and the item it displaced", () => {
        // [A,B,C,D] move C(2) up -> [A,C,B,D]; C sits between A and B
        expect(moveNeighbours(ids, 2, "up")).toEqual({
            beforeId: "A",
            afterId: "B",
        });
    });

    it("moves an interior item down: brackets it with the item it displaced and the next", () => {
        // [A,B,C,D] move B(1) down -> [A,C,B,D]; B sits between C and D
        expect(moveNeighbours(ids, 1, "down")).toEqual({
            beforeId: "C",
            afterId: "D",
        });
    });

    it("moving the second item up puts it at the head (beforeId null)", () => {
        // [A,B,C,D] move B(1) up -> [B,A,C,D]; B sits before A
        expect(moveNeighbours(ids, 1, "up")).toEqual({
            beforeId: null,
            afterId: "A",
        });
    });

    it("moving the second-to-last item down puts it at the tail (afterId null)", () => {
        // [A,B,C,D] move C(2) down -> [A,B,D,C]; C sits after D
        expect(moveNeighbours(ids, 2, "down")).toEqual({
            beforeId: "D",
            afterId: null,
        });
    });

    it("returns null moving the first item up (no-op boundary)", () => {
        expect(moveNeighbours(ids, 0, "up")).toBeNull();
    });

    it("returns null moving the last item down (no-op boundary)", () => {
        expect(moveNeighbours(ids, 3, "down")).toBeNull();
    });

    it("returns null for an out-of-range or negative index", () => {
        expect(moveNeighbours(ids, 4, "up")).toBeNull();
        expect(moveNeighbours(ids, -1, "down")).toBeNull();
    });

    it("returns null for a single-element or empty list", () => {
        expect(moveNeighbours(["only"], 0, "up")).toBeNull();
        expect(moveNeighbours(["only"], 0, "down")).toBeNull();
        expect(moveNeighbours([], 0, "up")).toBeNull();
    });
});
