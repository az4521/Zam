/**
 * Pan limit for the lightbox viewer. No DOM, so it is unit-testable.
 */

/** Extra room past each edge while zoomed, as a fraction of the viewport.
 *  Lets edge text be pulled clear of the toolbar and caption overlays. */
export const PAN_SLACK_FRACTION = 0.25;

/** Max |offset| from centre on one axis. At fit (scale <= 1) the image may
 *  not pan past its own overhang; once zoomed, it may also go
 *  PAN_SLACK_FRACTION of the viewport beyond that. With `onlyWhenOverflowing`
 *  (the sideways axis) the slack applies only to an image wider than the
 *  viewport: a lightly zoomed image that still fits keeps swiping to its
 *  neighbours on the first drag instead of panning into the slack. */
export function panLimit(
    scaledSize: number,
    viewportSize: number,
    scale: number,
    onlyWhenOverflowing = false,
): number {
    const overhang = Math.max(0, (scaledSize - viewportSize) / 2);
    const zoomed =
        scale > 1 && (!onlyWhenOverflowing || scaledSize > viewportSize);
    return overhang + (zoomed ? viewportSize * PAN_SLACK_FRACTION : 0);
}
