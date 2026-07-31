import { describe, expect, it } from "vitest";
import {
    MIN_TARGET_PX,
    TOUCH_TARGET_PX,
    overlayActionClass,
} from "./touchTargets";

describe("overlayActionClass", () => {
    it("meets the WCAG 2.5.8 minimum on pointer devices", () => {
        expect(MIN_TARGET_PX).toBeGreaterThanOrEqual(24);
        const cls = overlayActionClass(false);
        expect(cls).toContain(`min-w-[${MIN_TARGET_PX}px]`);
        expect(cls).toContain(`min-h-[${MIN_TARGET_PX}px]`);
    });

    it("meets the WCAG 2.5.5 touch target on touchscreens", () => {
        expect(TOUCH_TARGET_PX).toBeGreaterThanOrEqual(44);
        const cls = overlayActionClass(true);
        expect(cls).toContain(`min-w-[${TOUCH_TARGET_PX}px]`);
        expect(cls).toContain(`min-h-[${TOUCH_TARGET_PX}px]`);
    });

    it("centres the icon inside the enlarged hit area", () => {
        for (const touch of [true, false]) {
            const cls = overlayActionClass(touch);
            expect(cls).toContain("inline-flex");
            expect(cls).toContain("items-center");
            expect(cls).toContain("justify-center");
        }
    });

    it("never returns a smaller touch target than the pointer one", () => {
        expect(TOUCH_TARGET_PX).toBeGreaterThanOrEqual(MIN_TARGET_PX);
    });
});
