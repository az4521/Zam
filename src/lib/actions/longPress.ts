/** Parameters for the {@link longPress} action. */
export interface LongPressParams {
    /** Fired when a press is held past `delayMs` without moving too far.
     *  Receives the touch's viewport coordinates. */
    onTrigger: (x: number, y: number) => void;
    /** Hold duration before firing, in ms. Default 500. */
    delayMs?: number;
    /** Movement past this many px cancels the press (lets scrolling win).
     *  Default 10. */
    moveTolerancePx?: number;
    /** Optional gate: return false for a touchstart to NOT begin the press
     *  (no timer, no vibrate). Undefined = always start. Lets a caller arm the
     *  gesture conditionally and skip interactive children. */
    shouldStart?: (e: TouchEvent) => boolean;
}

/** True when a touch has moved past `tol` px from its start point. */
export function exceededMove(dx: number, dy: number, tol: number): boolean {
    return Math.sqrt(dx * dx + dy * dy) > tol;
}

/**
 * Svelte action: long-press to trigger a context action on touch devices.
 * Mirrors the shipped room-context-menu gesture (500 ms, 50 ms vibrate,
 * 10 px movement-cancel) and additionally suppresses the synthesized click
 * that follows a fired long-press, so a long-press on a tappable element
 * does not also trigger its `onclick`.
 */
export function longPress(node: HTMLElement, params: LongPressParams) {
    let p = params;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let startX = 0;
    let startY = 0;
    let fired = false;

    function clear() {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    }

    function onTouchStart(e: TouchEvent) {
        if (p.shouldStart && !p.shouldStart(e)) return;
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        fired = false;
        clear();
        timer = setTimeout(() => {
            timer = null;
            fired = true;
            navigator.vibrate?.(50);
            p.onTrigger(startX, startY);
        }, p.delayMs ?? 500);
    }

    function onTouchMove(e: TouchEvent) {
        if (!timer) return;
        const t = e.touches[0];
        if (
            exceededMove(
                t.clientX - startX,
                t.clientY - startY,
                p.moveTolerancePx ?? 10,
            )
        ) {
            clear();
        }
    }

    function onTouchEnd(e: TouchEvent) {
        clear();
        // A long-press already opened the menu; swallow the compat click so
        // the element's onclick (e.g. navigate) does not also fire.
        if (fired) {
            fired = false;
            e.preventDefault();
        }
    }

    function onTouchCancel() {
        clear();
        fired = false;
    }

    node.addEventListener("touchstart", onTouchStart);
    node.addEventListener("touchmove", onTouchMove);
    node.addEventListener("touchend", onTouchEnd);
    node.addEventListener("touchcancel", onTouchCancel);

    return {
        update(next: LongPressParams) {
            p = next;
        },
        destroy() {
            clear();
            node.removeEventListener("touchstart", onTouchStart);
            node.removeEventListener("touchmove", onTouchMove);
            node.removeEventListener("touchend", onTouchEnd);
            node.removeEventListener("touchcancel", onTouchCancel);
        },
    };
}
