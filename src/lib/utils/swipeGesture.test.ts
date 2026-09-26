import { describe, it, expect } from "vitest";
import {
    SWIPE_ENGAGE_PX,
    SWIPE_SHORT_PX,
    SWIPE_FAR_PX,
    SWIPE_MAX_PX,
    shouldEngageSwipe,
    swipeStage,
    resolveSwipeAction,
    clampSwipeTranslate,
    shouldClaimLeftward,
    SWIPE_CLAIM_PX,
} from "./swipeGesture";

describe("shouldEngageSwipe", () => {
    it("engages on a clear leftward horizontal drag past the engage threshold", () => {
        expect(shouldEngageSwipe(-(SWIPE_ENGAGE_PX + 1), 2)).toBe(true);
    });
    it("does not engage on a rightward drag", () => {
        expect(shouldEngageSwipe(SWIPE_ENGAGE_PX + 20, 0)).toBe(false);
    });
    it("does not engage when vertical dominates (scroll wins)", () => {
        expect(shouldEngageSwipe(-(SWIPE_ENGAGE_PX + 5), -100)).toBe(false);
    });
    it("does not engage below the engage threshold", () => {
        expect(shouldEngageSwipe(-(SWIPE_ENGAGE_PX - 1), 0)).toBe(false);
    });
});

describe("swipeStage", () => {
    it("is none below the short threshold", () => {
        expect(swipeStage(-(SWIPE_SHORT_PX - 1))).toBe("none");
    });
    it("is short at/above the short threshold, below far", () => {
        expect(swipeStage(-SWIPE_SHORT_PX)).toBe("short");
        expect(swipeStage(-(SWIPE_FAR_PX - 1))).toBe("short");
    });
    it("is far at/above the far threshold", () => {
        expect(swipeStage(-SWIPE_FAR_PX)).toBe("far");
    });
    it("is none for a rightward drag", () => {
        expect(swipeStage(SWIPE_FAR_PX + 50)).toBe("none");
    });
});

describe("resolveSwipeAction", () => {
    it("none stage → none", () => {
        expect(resolveSwipeAction("none", true)).toBe("none");
        expect(resolveSwipeAction("none", false)).toBe("none");
    });
    it("short stage → reply regardless of canEdit", () => {
        expect(resolveSwipeAction("short", true)).toBe("reply");
        expect(resolveSwipeAction("short", false)).toBe("reply");
    });
    it("far stage → edit only when editable", () => {
        expect(resolveSwipeAction("far", true)).toBe("edit");
        expect(resolveSwipeAction("far", false)).toBe("reply");
    });
});

describe("clampSwipeTranslate", () => {
    it("is 0 for a rightward drag", () => {
        expect(clampSwipeTranslate(40)).toBe(0);
    });
    it("tracks the finger 1:1 before the far threshold", () => {
        expect(clampSwipeTranslate(-50)).toBe(-50);
    });
    it("never exceeds -SWIPE_MAX_PX", () => {
        expect(clampSwipeTranslate(-100000)).toBe(-SWIPE_MAX_PX);
    });
    it("applies resistance past the far threshold", () => {
        // 20px past far → +10px (half speed) beyond -FAR
        expect(clampSwipeTranslate(-(SWIPE_FAR_PX + 20))).toBe(
            -(SWIPE_FAR_PX + 10),
        );
    });
});

describe("shouldClaimLeftward", () => {
    it("claims a clear leftward move past the 6px deadzone", () => {
        expect(shouldClaimLeftward(-8, 1)).toBe(true);
    });
    it("claims exactly at the 6px boundary", () => {
        expect(shouldClaimLeftward(-6, 0)).toBe(true);
    });
    it("does not claim just under the 6px deadzone", () => {
        expect(shouldClaimLeftward(-5, 0)).toBe(false);
    });
    it("does not claim a rightward move (channel drawer must survive)", () => {
        expect(shouldClaimLeftward(20, 1)).toBe(false);
    });
    it("does not claim a vertical-dominant move (scroll wins)", () => {
        expect(shouldClaimLeftward(-8, 20)).toBe(false);
    });
    it("does not claim when leftward but dy ties dx (not horizontal-dominant is still allowed at equal — matches drawer's non-cancel)", () => {
        // members cancels only when |dy| > |dx|; at |dx| === |dy| it proceeds,
        // so swipePan must also claim to beat it. dx=-10, dy=10 → |dx|>=|dy| true.
        expect(shouldClaimLeftward(-10, 10)).toBe(true);
    });
    it("SWIPE_CLAIM_PX is 6 and below SWIPE_ENGAGE_PX", () => {
        expect(SWIPE_CLAIM_PX).toBe(6);
        expect(SWIPE_CLAIM_PX).toBeLessThan(SWIPE_ENGAGE_PX);
    });
});
