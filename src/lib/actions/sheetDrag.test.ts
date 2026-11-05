import { describe, it, expect } from "vitest";
import {
    dragOffset,
    shouldEngageSheetDrag,
    shouldDismissSheet,
    scrolledBelowTop,
    ENGAGE_PX,
} from "./sheetDrag";

describe("sheetDrag", () => {
    it("tracks downward 1:1 and damps upward", () => {
        expect(dragOffset(100)).toBe(100);
        expect(dragOffset(-100)).toBeGreaterThan(-100);
        expect(dragOffset(-100)).toBeLessThan(0);
    });

    it("engages only on a mostly-vertical downward move past the threshold", () => {
        expect(shouldEngageSheetDrag(0, ENGAGE_PX)).toBe(false);
        expect(shouldEngageSheetDrag(0, ENGAGE_PX + 1)).toBe(true);
        expect(shouldEngageSheetDrag(30, 20)).toBe(false);
        expect(shouldEngageSheetDrag(0, -50)).toBe(false);
    });

    it("dismisses past 30% of height or on a fast flick", () => {
        expect(shouldDismissSheet(100, 400, 0)).toBe(false);
        expect(shouldDismissSheet(121, 400, 0)).toBe(true);
        expect(shouldDismissSheet(10, 400, 0.8)).toBe(true);
        expect(shouldDismissSheet(10, 400, -2)).toBe(false);
    });

    it("detects a scrolled ancestor inside the sheet but not above it", () => {
        const outer = document.createElement("div");
        const sheet = document.createElement("div");
        const list = document.createElement("div");
        outer.append(sheet);
        sheet.append(list);
        Object.defineProperty(outer, "scrollTop", { value: 50 });
        expect(scrolledBelowTop(list, sheet)).toBe(false);
        Object.defineProperty(list, "scrollTop", { value: 5 });
        expect(scrolledBelowTop(list, sheet)).toBe(true);
    });
});
