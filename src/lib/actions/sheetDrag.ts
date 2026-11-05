/** Progressive swipe-down dismissal for the mobile bottom sheet. Touch events
 *  (not pointer events): the move listener is non-passive so an engaged drag
 *  can preventDefault the native scroll/overscroll, which pointer events cannot
 *  do once the browser has claimed the touch (pointercancel). A drag engages
 *  only for a mostly-vertical downward move that began with every scrollable
 *  ancestor inside the sheet at scrollTop 0, so scrolling a long list is left
 *  alone. Engaged drags suppress the compat click so a menu button under the
 *  finger does not fire. */

/** Movement before a drag engages, so taps on menu buttons survive jitter. */
export const ENGAGE_PX = 8;
/** Dismiss when dragged past this fraction of the sheet height. */
export const DISMISS_FRACTION = 0.3;
/** Dismiss on a flick faster than this (px/ms, downward). */
export const DISMISS_VELOCITY = 0.5;
const RUBBER_BAND = 0.25;

/** 1:1 downward, damped upward. */
export function dragOffset(dy: number): number {
    return dy >= 0 ? dy : dy * RUBBER_BAND;
}

export function shouldEngageSheetDrag(dx: number, dy: number): boolean {
    return dy > ENGAGE_PX && dy > Math.abs(dx);
}

export function shouldDismissSheet(
    offset: number,
    height: number,
    velocity: number,
): boolean {
    return offset > height * DISMISS_FRACTION || velocity > DISMISS_VELOCITY;
}

/** True when `target` or any ancestor up to `root` is scrolled away from the top. */
export function scrolledBelowTop(
    target: Element | null,
    root: HTMLElement,
): boolean {
    for (let el = target; el; el = el.parentElement) {
        if (el.scrollTop > 0) return true;
        if (el === root) break;
    }
    return false;
}

export interface SheetDragParams {
    onDismiss: () => void;
    /** Report drag progress 0..1 (0 = resting, 1 = fully off-screen). */
    onProgress?: (progress: number) => void;
    /** Whether transitions may animate (reduced motion => false). */
    animate?: () => boolean;
    /**
     * The sheet to move, when the gesture is read off another element (the
     * backdrop, so a swipe anywhere on screen drags the sheet). Defaults to
     * the node the action is on.
     */
    sheet?: () => HTMLElement | undefined;
}

const SETTLE_MS = 200;
const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

export function sheetDrag(node: HTMLElement, params: SheetDragParams) {
    let p = params;
    let startX = 0;
    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0;
    let armed = false;
    let engaged = false;
    let suppressClick = false;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    const sheet = () => p.sheet?.() ?? node;

    function height() {
        return sheet().offsetHeight || 1;
    }

    function setOffset(px: number) {
        sheet().style.transform = px ? `translateY(${px}px)` : "";
        p.onProgress?.(Math.max(0, Math.min(1, px / height())));
    }

    function settle(toPx: number, done?: () => void) {
        const dur = p.animate?.() === false ? 0 : SETTLE_MS;
        clearTimeout(settleTimer);
        const el = sheet();
        if (dur === 0) {
            el.style.transition = "";
            setOffset(toPx);
            done?.();
            return;
        }
        el.style.transition = `transform ${dur}ms ${EASE}`;
        setOffset(toPx);
        settleTimer = setTimeout(() => {
            el.style.transition = "";
            done?.();
        }, dur);
    }

    function onTouchStart(e: TouchEvent) {
        engaged = false;
        armed = false;
        if (e.touches.length !== 1) return;
        // A new touch during a settle/spring-back takes over from wherever it is.
        clearTimeout(settleTimer);
        sheet().style.transition = "";
        if (scrolledBelowTop(e.target as Element | null, node)) return;
        const t = e.touches[0];
        startX = t.clientX;
        startY = lastY = t.clientY;
        lastT = performance.now();
        velocity = 0;
        armed = true;
    }

    function onTouchMove(e: TouchEvent) {
        if (!armed || e.touches.length !== 1) return;
        const t = e.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        if (!engaged) {
            if (!shouldEngageSheetDrag(dx, dy)) {
                // An upward or horizontal move hands the gesture back to the
                // browser (scroll); it can never become a sheet drag mid-gesture.
                if (dy < -ENGAGE_PX || Math.abs(dx) > ENGAGE_PX) armed = false;
                return;
            }
            engaged = true;
        }
        if (e.cancelable) e.preventDefault();
        const now = performance.now();
        if (now > lastT) velocity = (t.clientY - lastY) / (now - lastT);
        lastY = t.clientY;
        lastT = now;
        setOffset(dragOffset(dy));
    }

    function onTouchEnd(e: TouchEvent) {
        if (!engaged) {
            armed = false;
            return;
        }
        const t = e.changedTouches[0];
        const offset = dragOffset(t ? t.clientY - startY : 0);
        const dismiss =
            e.type === "touchend" &&
            shouldDismissSheet(offset, height(), velocity);
        armed = engaged = false;
        suppressClick = true;
        setTimeout(() => (suppressClick = false), 400);
        if (dismiss) settle(height(), p.onDismiss);
        else settle(0);
    }

    function onClickCapture(e: MouseEvent) {
        if (!suppressClick) return;
        suppressClick = false;
        e.preventDefault();
        e.stopPropagation();
    }

    node.addEventListener("touchstart", onTouchStart, { passive: true });
    node.addEventListener("touchmove", onTouchMove, { passive: false });
    node.addEventListener("touchend", onTouchEnd);
    node.addEventListener("touchcancel", onTouchEnd);
    node.addEventListener("click", onClickCapture, true);

    return {
        update(next: SheetDragParams) {
            p = next;
        },
        destroy() {
            clearTimeout(settleTimer);
            node.removeEventListener("touchstart", onTouchStart);
            node.removeEventListener("touchmove", onTouchMove);
            node.removeEventListener("touchend", onTouchEnd);
            node.removeEventListener("touchcancel", onTouchEnd);
            node.removeEventListener("click", onClickCapture, true);
        },
    };
}
