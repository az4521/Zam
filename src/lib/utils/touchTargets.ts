/** WCAG 2.5.8 Target Size (Minimum), AA. */
export const MIN_TARGET_PX = 24;
/** WCAG 2.5.5 Target Size (Enhanced), AAA — the bar for touch. */
export const TOUCH_TARGET_PX = 44;

/**
 * Classes for a small action button overlaid on a larger activation target
 * (the favourite star over a GIF, and friends). The overlay is painted after
 * the target so it already wins the hit test — the accessibility problem is
 * purely that it was ~18px, small enough to miss and send the GIF instead.
 *
 * The size literals are spelled out rather than interpolated because
 * Tailwind's content scanner only emits arbitrary values it can see as
 * complete strings in the source. `min-w-[${TOUCH_TARGET_PX}px]` would leave
 * the unit tests passing while no CSS rule was ever generated.
 */
export function overlayActionClass(isTouchscreen: boolean): string {
    return isTouchscreen
        ? "inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full bg-black/60 transition-colors"
        : "inline-flex items-center justify-center min-w-[24px] min-h-[24px] rounded-full bg-black/60 hover:bg-black/80 transition-colors";
}
