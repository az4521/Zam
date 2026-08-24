/**
 * Min scrollTop change (px) from where a touch message-selection was made
 * before a scroll counts as "meaningful" and dismisses the actions bar.
 * Comfortably above the reading-anchor's ≤2px jitter, small enough that any
 * deliberate scroll dismisses. Tunable — this const is the single knob.
 */
export const SELECTION_SCROLL_DISMISS_PX = 24;

/**
 * Decide whether a timeline scroll should dismiss the touch message-actions
 * selection. Pure: the caller supplies the baseline scrollTop captured when
 * the selection was made, the live scrollTop, and whether a modal/bottom-sheet
 * is open (an in-progress action must not be nuked by a scroll under its sheet).
 */
export function shouldDismissSelectionOnScroll(params: {
    selectionScrollTop: number | null;
    currentScrollTop: number;
    modalOpen: boolean;
    threshold?: number;
}): boolean {
    const {
        selectionScrollTop,
        currentScrollTop,
        modalOpen,
        threshold = SELECTION_SCROLL_DISMISS_PX,
    } = params;
    if (selectionScrollTop === null) return false;
    if (modalOpen) return false;
    return Math.abs(currentScrollTop - selectionScrollTop) > threshold;
}
