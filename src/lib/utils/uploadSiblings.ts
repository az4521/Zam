/**
 * Pure derivation of the "sibling set" for paging a message's OWN uploaded
 * images in the shared lightbox.
 *
 * A standard `m.image` event carries exactly one image, so a run of adjacent
 * uploads is the only "several images" case for upload tiles (the inline-body
 * gallery in messageBodyGallery.ts handles the multi-<img> formatted_body case).
 * Given the chronological events, a parallel `pageable` flag (true iff the event
 * is an image upload displayable in the paged lightbox — the caller decides,
 * e.g. a plain m.image with a resolvable url and no encrypted `file`), and the
 * clicked index, this returns the ascending indices of the maximal contiguous
 * run of pageable uploads that share the clicked event's burst.
 *
 * "Same burst" reuses the timeline's existing grouping rule: an adjacent pair
 * stays in the run only when `shouldShowHeader` is false for the later one
 * (same sender AND within the 5-minute window). A non-pageable event, a
 * different sender, or a > 5-minute gap all break the run.
 *
 * SDK-free (structural `TimelineDisplayEvent`) so it is unit-testable; an
 * out-of-range or non-pageable click yields `[]` rather than throwing.
 */
import { shouldShowHeader, type TimelineDisplayEvent } from "./timelineDisplay";

export function siblingUploadIndices(
    events: readonly TimelineDisplayEvent[],
    pageable: readonly boolean[],
    clickedIndex: number,
): number[] {
    if (clickedIndex < 0 || clickedIndex >= events.length) return [];
    if (!pageable[clickedIndex]) return [];

    // shouldShowHeader wants a plain array; `events` is chronological already.
    const list = events as TimelineDisplayEvent[];

    let start = clickedIndex;
    while (start > 0 && pageable[start - 1] && !shouldShowHeader(list, start)) {
        start--;
    }

    let end = clickedIndex;
    while (
        end < events.length - 1 &&
        pageable[end + 1] &&
        !shouldShowHeader(list, end + 1)
    ) {
        end++;
    }

    const out: number[] = [];
    for (let i = start; i <= end; i++) out.push(i);
    return out;
}
