// Which timeline rows MessageArea mounts. Only rows near the viewport are
// rendered; the rest are spacers sized from each row's last measured height
// (an estimate until it has been measured), so a room scrolled far back holds
// a screenful or two of message components instead of every one loaded.

/** Rows mounted on entering a room, before anything has been measured. */
export const INITIAL_WINDOW_ROWS = 40;
/** Height assumed for a row that has never been measured. */
export const DEFAULT_ROW_HEIGHT = 72;
/** Mounted beyond each edge of the viewport: this many viewport heights, but
 *  at least WINDOW_MARGIN_MIN_PX. */
export const WINDOW_MARGIN_SCREENS = 1.5;
export const WINDOW_MARGIN_MIN_PX = 600;

export interface RowWindow {
    /** First mounted row. */
    start: number;
    /** One past the last mounted row. */
    end: number;
}

/** offsets[i] is where row i starts; offsets[n] is the total height. */
export function rowOffsets(heights: readonly number[]): number[] {
    const out = new Array<number>(heights.length + 1);
    out[0] = 0;
    for (let i = 0; i < heights.length; i++) out[i + 1] = out[i] + heights[i];
    return out;
}

/** The rows overlapping [top, bottom) (list coordinates). */
export function rowsInRange(
    offsets: readonly number[],
    top: number,
    bottom: number,
): RowWindow {
    const n = offsets.length - 1;
    // First row whose bottom edge is below `top`.
    let lo = 0;
    let hi = n;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (offsets[mid + 1] <= top) lo = mid + 1;
        else hi = mid;
    }
    const start = lo;
    // First row starting at or below `bottom`.
    hi = n;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (offsets[mid] < bottom) lo = mid + 1;
        else hi = mid;
    }
    return { start, end: Math.max(start, lo) };
}

export interface WindowInput {
    offsets: readonly number[];
    /** The viewport in list coordinates. */
    viewTop: number;
    viewBottom: number;
    /** Extra height mounted above and below the viewport. */
    margin: number;
    current: RowWindow;
    /** Rows that must stay mounted (focus, selection, playing media). */
    pinned?: RowWindow | null;
    /** Follow the newest row (the user is at the bottom). */
    stickToEnd?: boolean;
}

/**
 * The rows to mount next. The current window is kept while it still covers
 * the viewport with half a margin to spare and holds no more than two
 * margins beyond it, so scrolling a little doesn't remount rows every frame.
 */
export function nextWindow(input: WindowInput): RowWindow {
    const { offsets, viewTop, viewBottom, margin, current } = input;
    const n = offsets.length - 1;
    if (n <= 0) return { start: 0, end: 0 };
    const inner = rowsInRange(
        offsets,
        viewTop - margin / 2,
        viewBottom + margin / 2,
    );
    const outer = rowsInRange(
        offsets,
        viewTop - margin * 2,
        viewBottom + margin * 2,
    );
    let next: RowWindow;
    if (
        current.end <= n &&
        current.start <= inner.start &&
        current.start >= outer.start &&
        current.end >= inner.end &&
        current.end <= outer.end
    ) {
        next = { ...current };
    } else {
        next = rowsInRange(offsets, viewTop - margin, viewBottom + margin);
    }
    if (input.stickToEnd) next.end = n;
    if (input.pinned && input.pinned.end > input.pinned.start) {
        next.start = Math.min(next.start, input.pinned.start);
        next.end = Math.max(next.end, Math.min(n, input.pinned.end));
    }
    // Never mount nothing: a window that fell entirely into a spacer (a jump
    // past every measured row) still shows the rows nearest the viewport.
    if (next.end <= next.start) {
        const at = Math.min(n - 1, Math.max(0, next.start));
        next = { start: at, end: at + 1 };
    }
    return next;
}

/** A window of about `rows` rows centred on `index`. */
export function windowAround(
    index: number,
    n: number,
    rows = INITIAL_WINDOW_ROWS,
): RowWindow {
    const start = Math.max(0, Math.min(index - (rows >> 1), n - rows));
    return { start, end: Math.min(n, start + rows) };
}
