import { describe, it, expect } from "vitest";
import { pagesToDrop } from "./gifResultWindow";

describe("pagesToDrop", () => {
    it("drops nothing while the results fit", () => {
        expect(pagesToDrop([50, 50], 300, 50)).toBe(0);
    });

    it("drops the oldest pages until the incoming page fits", () => {
        // 4 pages of 100 = 400; +100 incoming must fit in 300 -> drop 2 pages.
        expect(pagesToDrop([100, 100, 100, 100], 300, 100)).toBe(2);
    });

    it("never drops the newest page", () => {
        expect(pagesToDrop([500], 300, 100)).toBe(0);
        expect(pagesToDrop([400, 400], 300, 0)).toBe(1);
    });

    it("handles an empty list", () => {
        expect(pagesToDrop([], 300, 50)).toBe(0);
    });
});
