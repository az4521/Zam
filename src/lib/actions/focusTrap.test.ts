import { describe, it, expect } from "vitest";
import { focusWrapTarget } from "./focusTrap";

describe("focusWrapTarget", () => {
    it("returns null when there is nothing to trap", () => {
        expect(focusWrapTarget(0, -1, false)).toBeNull();
    });

    it("wraps forward from the last element to the first", () => {
        expect(focusWrapTarget(3, 2, false)).toBe(0);
    });

    it("wraps backward from the first element to the last", () => {
        expect(focusWrapTarget(3, 0, true)).toBe(2);
    });

    it("lets the browser handle a normal forward Tab in range", () => {
        expect(focusWrapTarget(3, 0, false)).toBeNull();
        expect(focusWrapTarget(3, 1, false)).toBeNull();
    });

    it("lets the browser handle a normal backward Tab in range", () => {
        expect(focusWrapTarget(3, 2, true)).toBeNull();
        expect(focusWrapTarget(3, 1, true)).toBeNull();
    });

    it("pulls focus back into the trap when it escaped (activeIndex -1)", () => {
        expect(focusWrapTarget(3, -1, false)).toBe(0); // forward → first
        expect(focusWrapTarget(3, -1, true)).toBe(2); // backward → last
    });

    it("keeps focus on the sole element when count is 1", () => {
        expect(focusWrapTarget(1, 0, false)).toBe(0);
        expect(focusWrapTarget(1, 0, true)).toBe(0);
    });
});
