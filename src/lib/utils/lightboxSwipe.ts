/**
 * Release maths for swiping between items in the lightbox. No DOM, so it is
 * unit-testable; the viewer decides what to draw from these numbers.
 */

/** px/ms: a quick flick steps on its own, once it has gone this far. */
export const SWIPE_FLICK_SPEED = 0.4;
export const SWIPE_FLICK_MIN = 30;

export const SWIPE_SETTLE_MIN_MS = 150;
export const SWIPE_SETTLE_MAX_MS = 300;

/** Whether a released drag steps to the neighbour: past a fifth of the
 *  viewport (at most 100px), or a quick flick. */
export function swipeCommits(
    dx: number,
    elapsedMs: number,
    width: number,
): boolean {
    const dist = Math.abs(dx);
    const speed = dist / Math.max(1, elapsedMs);
    return (
        dist > Math.min(100, width * 0.2) ||
        (dist > SWIPE_FLICK_MIN && speed > SWIPE_FLICK_SPEED)
    );
}

/** Duration of the release animation covering `remaining` px of a `width` px
 *  viewport: a nudge settles in 150ms, a full-screen slide takes 300ms. */
export function swipeSettleMs(remaining: number, width: number): number {
    if (!(width > 0)) return SWIPE_SETTLE_MIN_MS;
    const ratio = Math.min(1, Math.max(0, remaining / width));
    return Math.round(
        SWIPE_SETTLE_MIN_MS +
            (SWIPE_SETTLE_MAX_MS - SWIPE_SETTLE_MIN_MS) * ratio,
    );
}
