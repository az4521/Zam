import { describe, it, expect } from "vitest";
import {
    shouldDismissSelectionOnScroll,
    SELECTION_SCROLL_DISMISS_PX,
} from "./scrollDismiss";

describe("shouldDismissSelectionOnScroll", () => {
    it("does not dismiss when no selection is tracked (baseline null)", () => {
        expect(
            shouldDismissSelectionOnScroll({
                selectionScrollTop: null,
                currentScrollTop: 5000,
                modalOpen: false,
            }),
        ).toBe(false);
    });

    it("does not dismiss while a modal/bottom-sheet is open", () => {
        expect(
            shouldDismissSelectionOnScroll({
                selectionScrollTop: 100,
                currentScrollTop: 1000,
                modalOpen: true,
            }),
        ).toBe(false);
    });

    it("does not dismiss for jitter at or under the threshold", () => {
        expect(
            shouldDismissSelectionOnScroll({
                selectionScrollTop: 100,
                currentScrollTop: 100 + SELECTION_SCROLL_DISMISS_PX,
                modalOpen: false,
            }),
        ).toBe(false);
        expect(
            shouldDismissSelectionOnScroll({
                selectionScrollTop: 100,
                currentScrollTop: 110,
                modalOpen: false,
            }),
        ).toBe(false);
    });

    it("dismisses when scrolled down past the threshold", () => {
        expect(
            shouldDismissSelectionOnScroll({
                selectionScrollTop: 100,
                currentScrollTop: 100 + SELECTION_SCROLL_DISMISS_PX + 1,
                modalOpen: false,
            }),
        ).toBe(true);
    });

    it("dismisses when scrolled up past the threshold (negative delta)", () => {
        expect(
            shouldDismissSelectionOnScroll({
                selectionScrollTop: 500,
                currentScrollTop: 500 - SELECTION_SCROLL_DISMISS_PX - 1,
                modalOpen: false,
            }),
        ).toBe(true);
    });

    it("honors a custom threshold", () => {
        expect(
            shouldDismissSelectionOnScroll({
                selectionScrollTop: 0,
                currentScrollTop: 60,
                modalOpen: false,
                threshold: 100,
            }),
        ).toBe(false);
        expect(
            shouldDismissSelectionOnScroll({
                selectionScrollTop: 0,
                currentScrollTop: 101,
                modalOpen: false,
                threshold: 100,
            }),
        ).toBe(true);
    });
});
