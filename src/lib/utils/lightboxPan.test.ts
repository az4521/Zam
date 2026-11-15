import { describe, expect, it } from "vitest";
import { PAN_SLACK_FRACTION, panLimit } from "./lightboxPan";

describe("panLimit", () => {
    it("matches the old clamp at fit (scale 1)", () => {
        // Image smaller than the viewport: no pan at all.
        expect(panLimit(600, 1000, 1)).toBe(0);
        // Image wider than the viewport: exact overhang on each side.
        expect(panLimit(1400, 1000, 1)).toBe(200);
    });

    it("adds slack past the overhang once zoomed", () => {
        const slack = 1000 * PAN_SLACK_FRACTION;
        expect(panLimit(2000, 1000, 2)).toBe(500 + slack);
    });

    it("gives slack only when the zoomed image is smaller than the viewport", () => {
        expect(panLimit(900, 1000, 1.5)).toBe(1000 * PAN_SLACK_FRACTION);
    });

    it("never returns a negative limit", () => {
        expect(panLimit(0, 1000, 1)).toBe(0);
        expect(panLimit(-5, 1000, 0.5)).toBe(0);
    });
});

describe("panLimit sideways (onlyWhenOverflowing)", () => {
    it("gives no slack to a zoomed image that still fits", () => {
        expect(panLimit(900, 1000, 1.5, true)).toBe(0);
    });
    it("gives slack once the zoomed image overflows", () => {
        expect(panLimit(1200, 1000, 2, true)).toBe(100 + 250);
    });
});
