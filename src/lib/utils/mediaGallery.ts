/**
 * Neighbour indices for stepping through an ordered media list in the lightbox.
 *
 * The lightbox shows a "previous"/"next" chevron only when the matching handler
 * is passed (it omits them at the ends of the list), so callers use this to
 * decide whether a neighbour exists and, if so, which index to jump to.
 *
 * `null` on a side means "no neighbour" — the caller should pass `undefined`
 * for that direction. An out-of-range `current` (negative, or >= `length`)
 * yields no neighbours rather than throwing, so a stale index can never crash
 * the pager.
 */
export interface GalleryNav {
    prevIndex: number | null;
    nextIndex: number | null;
}

export function galleryNav(length: number, current: number): GalleryNav {
    if (current < 0 || current >= length) {
        return { prevIndex: null, nextIndex: null };
    }
    return {
        prevIndex: current > 0 ? current - 1 : null,
        nextIndex: current < length - 1 ? current + 1 : null,
    };
}
