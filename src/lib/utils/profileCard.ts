// Pure geometry/summary helpers for the user profile card popout.

export interface AnchorRect {
    top: number;
    left: number;
    right: number;
    bottom: number;
}

export interface Size {
    width: number;
    height: number;
}

const MARGIN = 8;

/**
 * Position a popout card beside its anchor: to the right when it fits, flipped
 * to the left otherwise, top-aligned with the anchor and clamped so the card
 * stays inside the viewport (with an 8px margin).
 */
export function popoutPosition(
    anchor: AnchorRect,
    card: Size,
    viewport: Size,
    gap = MARGIN,
): { left: number; top: number } {
    let left = anchor.right + gap;
    if (left + card.width > viewport.width - MARGIN) {
        left = anchor.left - card.width - gap;
    }
    left = Math.max(MARGIN, left);

    let top = anchor.top;
    if (top + card.height > viewport.height - MARGIN) {
        top = viewport.height - MARGIN - card.height;
    }
    top = Math.max(MARGIN, top);

    return { left, top };
}

/**
 * Sort mutual room names (case-insensitive) and cap the list for display,
 * reporting how many were folded into a "+N more" line.
 */
export function summarizeMutualRooms(
    names: string[],
    max = 3,
): { shown: string[]; moreCount: number } {
    const sorted = [...names].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
    return {
        shown: sorted.slice(0, max),
        moreCount: Math.max(0, sorted.length - max),
    };
}
