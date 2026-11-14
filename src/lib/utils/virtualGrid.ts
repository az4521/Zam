// Row layout for the virtualized picker grids (EmojiPicker, StickerPicker).
//
// A picker can hold thousands of options (~1900 standard emoji plus every
// custom pack), and building a DOM button for each made it take seconds to
// open. Instead every row's position is computed here from the measured cell
// size, the scroll box is sized to the whole list, and only the rows near the
// viewport are rendered.

export interface GridSection {
    id: string;
    /** Header text, or null for a section drawn without a header. */
    label: string | null;
    /** Index of the section's first item in the flat option list. */
    start: number;
    count: number;
}

export type GridRow =
    | {
          kind: "header";
          key: string;
          sectionId: string;
          label: string;
          top: number;
          h: number;
      }
    | {
          kind: "cells";
          key: string;
          sectionId: string;
          /** Flat indexes [start, end) drawn in this row. */
          start: number;
          end: number;
          top: number;
          h: number;
      };

export interface GridMetrics {
    cols: number;
    /** Side of one square cell, in px. */
    cellSize: number;
    /** Gap between cells and between rows. */
    gap: number;
    headerHeight: number;
    /** Space under each non-empty section's last row. */
    sectionGap: number;
}

export interface GridLayout {
    rows: GridRow[];
    /** Row index holding each flat item. */
    itemRow: Int32Array;
    total: number;
}

export function buildGridLayout(
    sections: GridSection[],
    itemCount: number,
    m: GridMetrics,
): GridLayout {
    const rows: GridRow[] = [];
    const itemRow = new Int32Array(itemCount);
    if (m.cellSize <= 0 || m.cols <= 0) return { rows, itemRow, total: 0 };
    const rowH = m.cellSize + m.gap;
    let y = 0;
    for (const sec of sections) {
        if (sec.label !== null) {
            rows.push({
                kind: "header",
                key: `h:${sec.id}`,
                sectionId: sec.id,
                label: sec.label,
                top: y,
                h: m.headerHeight,
            });
            y += m.headerHeight;
        }
        for (let i = 0; i < sec.count; i += m.cols) {
            const start = sec.start + i;
            const end = Math.min(sec.start + sec.count, start + m.cols);
            itemRow.fill(rows.length, start, end);
            rows.push({
                kind: "cells",
                key: `c:${sec.id}:${start}`,
                sectionId: sec.id,
                start,
                end,
                top: y,
                h: rowH,
            });
            y += rowH;
        }
        // The last row's trailing gap becomes the section gap.
        if (sec.count > 0) y += m.sectionGap - m.gap;
    }
    return { rows, itemRow, total: Math.max(0, y) };
}

/** Index of the first row whose bottom edge is below `y` (rows.length if none). */
export function rowAt(rows: GridRow[], y: number): number {
    let lo = 0;
    let hi = rows.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (rows[mid].top + rows[mid].h <= y) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

/** Rows [from, to) to render for a viewport, with `overscan` px either side. */
export function visibleRowRange(
    rows: GridRow[],
    scrollTop: number,
    viewHeight: number,
    overscan: number,
): { from: number; to: number } {
    return {
        from: rowAt(rows, scrollTop - overscan),
        to: Math.min(
            rows.length,
            rowAt(rows, scrollTop + viewHeight + overscan) + 1,
        ),
    };
}

/** The scrollTop that brings `row` fully into view, or null if it already is. */
export function scrollTopToReveal(
    row: GridRow,
    scrollTop: number,
    viewHeight: number,
): number | null {
    if (row.top < scrollTop) return row.top;
    if (row.top + row.h > scrollTop + viewHeight)
        return row.top + row.h - viewHeight;
    return null;
}

export function indexRange(start: number, end: number): number[] {
    const out: number[] = [];
    for (let i = start; i < end; i++) out.push(i);
    return out;
}
