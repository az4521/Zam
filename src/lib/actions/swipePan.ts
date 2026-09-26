/** Swipe-to-reply pan gesture (item 6). Owns the touch lifecycle for a single
 *  message row: detects a deliberate leftward swipe, drives the row translate,
 *  and reports the crossed threshold on release. Detection is core; the action
 *  (reply/edit) is a plugin's — this action only reports. Coexists with the
 *  item-5 hold (a horizontal move cancels the hold via its own move tolerance)
 *  and suppresses the post-swipe tap by preventing the compat click on end. */
import {
    shouldEngageSwipe,
    swipeStage,
    clampSwipeTranslate,
    shouldClaimLeftward,
    type SwipeStage,
} from "$lib/utils/swipeGesture";
import { targetCanScrollHoriz } from "$lib/utils/scrollHoriz";

// Vertical scroll dominates over horizontal swipe beyond this threshold.
const VERTICAL_LOCK_PX = 8;

export interface SwipePanParams {
    enabled: boolean;
    onEngage?: () => void;
    onMove?: (translateX: number, stage: SwipeStage) => void;
    onRelease?: (stage: SwipeStage) => void;
    onCancel?: () => void;
}

export function swipePan(node: HTMLElement, params: SwipePanParams) {
    let p = params;
    let startX = 0;
    let startY = 0;
    let startTarget: Element | null = null;
    let armed = false;
    let engaged = false;

    function reset() {
        armed = false;
        engaged = false;
    }

    function onTouchStart(e: TouchEvent) {
        if (!p.enabled || e.touches.length !== 1) {
            reset();
            return;
        }
        // Arm the swipe detector but do NOT stop touchstart propagation — the
        // channel (left) drawer opener lives on a wrapping ancestor and opens on
        // a RIGHTWARD drag, so a rightward row-swipe must reach it. The LEFTWARD
        // members/pinned drawers are claimed direction-aware in onTouchMove once
        // the gesture direction is clear (see below). Not an edge gesture, so it
        // never fights the Android system back-swipe. onTouchEnd stays non-passive
        // to also suppress the tap.
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startTarget = e.target as Element | null;
        armed = true;
        engaged = false;
    }

    function onTouchMove(e: TouchEvent) {
        if (!armed) return;
        if (!p.enabled || e.touches.length !== 1) {
            if (engaged) p.onCancel?.();
            reset();
            return;
        }
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        // audit UX-04: Don't hijack horizontal scroll of wide code blocks/tables.
        // If the touch started inside a horizontally scrollable element that can
        // still scroll in the swipe direction, let it scroll natively instead of
        // engaging the swipe-to-reply gesture.
        if (!engaged && targetCanScrollHoriz(startTarget, dx)) {
            reset();
            return;
        }
        // Claim the touch from ancestor drawer handlers direction-aware. The
        // members/pinned drawers (MessageArea) open on a LEFTWARD drag — the same
        // direction as reply — and engage at their own 6px deadzone, so once this
        // move is clearly leftward we stop it reaching their document-level move
        // handlers. A RIGHTWARD drag must reach the channel (left) drawer opener,
        // and a vertical drag must reach the scroller, so we do NOT stop those.
        // Once engaged, own the whole gesture so nothing hijacks mid-reply.
        if (engaged || shouldClaimLeftward(dx, dy)) {
            e.stopPropagation();
        }
        if (!engaged) {
            if (
                Math.abs(dy) > Math.abs(dx) &&
                Math.abs(dy) > VERTICAL_LOCK_PX
            ) {
                // Clearly vertical — hand the gesture back to the scroller.
                reset();
                return;
            }
            if (!shouldEngageSwipe(dx, dy)) return;
            engaged = true;
            p.onEngage?.();
        }
        e.preventDefault();
        p.onMove?.(clampSwipeTranslate(dx), swipeStage(dx));
    }

    function onTouchEnd(e: TouchEvent) {
        if (engaged) {
            p.onRelease?.(swipeStage(e.changedTouches[0].clientX - startX));
            e.preventDefault();
        }
        reset();
    }

    function onTouchCancel() {
        if (engaged) p.onCancel?.();
        reset();
    }

    node.addEventListener("touchstart", onTouchStart, { passive: false });
    node.addEventListener("touchmove", onTouchMove, { passive: false });
    node.addEventListener("touchend", onTouchEnd, { passive: false });
    node.addEventListener("touchcancel", onTouchCancel);

    return {
        update(next: SwipePanParams) {
            p = next;
        },
        destroy() {
            node.removeEventListener("touchstart", onTouchStart);
            node.removeEventListener("touchmove", onTouchMove);
            node.removeEventListener("touchend", onTouchEnd);
            node.removeEventListener("touchcancel", onTouchCancel);
        },
    };
}
