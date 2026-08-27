import { describe, expect, it } from "vitest";
import { isDoubleTap } from "./doubleTap";

describe("double-tap gesture", () => {
    it("requires taps to be close in time and position", () => {
        const first = { at: 1000, x: 40, y: 50 };
        expect(isDoubleTap(first, { at: 1250, x: 48, y: 55 })).toBe(true);
        expect(isDoubleTap(first, { at: 1400, x: 48, y: 55 })).toBe(false);
        expect(isDoubleTap(first, { at: 1250, x: 100, y: 55 })).toBe(false);
    });
});
