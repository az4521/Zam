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
    type SwipeStage,
} from "$lib/utils/swipeGesture";

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
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
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
