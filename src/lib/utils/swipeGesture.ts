// Pure swipe-to-reply gesture math (item 6). Zero DOM/SDK imports so it is
// fully unit-testable. The message row is dragged LEFT to reveal one morphing
// action button; these helpers decide when a drag counts as a swipe, which
// threshold it has crossed, what release does, and how far the row translates.

export const SWIPE_ENGAGE_PX = 12;
export const SWIPE_SHORT_PX = 64;
export const SWIPE_FAR_PX = 128;
export const SWIPE_MAX_PX = 152;

export type SwipeStage = "none" | "short" | "far";
export type SwipeAction = "none" | "reply" | "edit";

/** True when a drag is a clear leftward, horizontal-dominant swipe past the
 *  engage threshold — i.e. a deliberate swipe, not a scroll or a rightward drag. */
export function shouldEngageSwipe(
    dx: number,
    dy: number,
    engagePx: number = SWIPE_ENGAGE_PX,
): boolean {
    return dx < 0 && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= engagePx;
}

/** The threshold a leftward drag has crossed. Rightward/small → "none". */
export function swipeStage(
    dx: number,
    shortPx: number = SWIPE_SHORT_PX,
    farPx: number = SWIPE_FAR_PX,
): SwipeStage {
    const mag = dx < 0 ? -dx : 0;
    if (mag >= farPx) return "far";
    if (mag >= shortPx) return "short";
    return "none";
}

/** What a release at this stage does. Edit is offered only on your own
 *  messages; every other reachable stage is reply. */
export function resolveSwipeAction(
    stage: SwipeStage,
    isOwn: boolean,
): SwipeAction {
    if (stage === "none") return "none";
    if (stage === "far" && isOwn) return "edit";
    return "reply";
}

/** Signed translateX (≤ 0) to apply to the row. Tracks the finger 1:1 up to the
 *  far threshold, then half-speed resistance, hard-clamped at -maxPx. */
export function clampSwipeTranslate(
    dx: number,
    maxPx: number = SWIPE_MAX_PX,
): number {
    if (dx >= 0) return 0;
    const mag = -dx;
    let out: number;
    if (mag <= SWIPE_FAR_PX) out = mag;
    else out = SWIPE_FAR_PX + (mag - SWIPE_FAR_PX) / 2;
    return -Math.min(out, maxPx);
}
