/**
 * Whether an off-canvas drawer sitting at `translate` (px) is fully off screen.
 *
 * The mobile drawers stay MOUNTED when closed — they are only translated out of
 * view — so without this they remain tabbable and a hardware-keyboard user's
 * focus vanishes into invisible UI (audit A11Y-02). Callers feed the result to
 * `inert`, so the answer must be conservative: anything we cannot read as
 * definitely-closed stays interactive.
 *
 * The drawer's direction is inferred from the sign of `closedTranslate`: a
 * left-hand drawer parks at a negative offset (`-width`), a right-hand one at a
 * positive offset (`+width`). Both open at 0.
 */
export function isOffCanvasClosed(
    translate: number,
    closedTranslate: number,
): boolean {
    if (!Number.isFinite(translate) || !Number.isFinite(closedTranslate)) {
        return false;
    }
    if (closedTranslate === 0) return false;
    return closedTranslate < 0
        ? translate <= closedTranslate
        : translate >= closedTranslate;
}
