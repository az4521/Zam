/**
 * Column placement for the GIF picker's masonry grids.
 *
 * CSS multi-column (`columns-[165px]`) fills column 1 top to bottom before
 * starting column 2, so the list reads down, not across, and the browser
 * rebalances where each column breaks whenever any tile's height changes -- a
 * preview's aspect ratio learned on first load, a tags caption, the panel
 * resized. Tiles then jump between columns and the favourites look reordered
 * even though the saved list never changed. Placing tiles into explicit
 * columns here makes the order depend on the list alone.
 */

export interface Placed<T> {
    item: T;
    /** Position in the flat list: the option index keyboard navigation uses. */
    idx: number;
}

/** How many columns CSS `column-width: colWidth; column-gap: gap` would make. */
export function masonryColumnCount(
    width: number,
    colWidth: number,
    gap: number,
): number {
    return Math.max(1, Math.floor((width + gap) / (colWidth + gap)));
}

/**
 * Split `items` into `cols` columns in reading order.
 *
 * Without `heightOf`, round-robin: item i goes to column i % cols, so the top
 * row is always the first `cols` items. With it, each item goes to the
 * currently shortest column (ties to the leftmost), which balances column
 * lengths. Either way an item's column depends only on the items before it,
 * so appending (another page of results) never moves a placed tile. `heightOf`
 * must be stable for a given item -- feeding it anything learned after render
 * would bring the reshuffling back.
 */
export function distributeColumns<T>(
    items: readonly T[],
    cols: number,
    heightOf?: (item: T) => number,
): Placed<T>[][] {
    const n = Math.max(1, Math.floor(cols));
    const out: Placed<T>[][] = Array.from({ length: n }, () => []);
    const heights = new Array<number>(n).fill(0);
    items.forEach((item, idx) => {
        let c = idx % n;
        if (heightOf) {
            c = 0;
            for (let i = 1; i < n; i++) if (heights[i] < heights[c]) c = i;
            heights[c] += heightOf(item);
        }
        out[c].push({ item, idx });
    });
    return out;
}
