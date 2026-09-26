/**
 * When a message row's action bar is in the DOM at all.
 *
 * The bar is ~24 elements per row (buttons, SVGs, the report/redact
 * components) and was about half of all timeline DOM, mounted for every row
 * on every room switch while only the hovered or focused row ever shows it.
 * The row mounts it on demand instead; the bar's own CSS still decides
 * visibility once it is mounted.
 *
 * - `hovered`: the pointer is over the row (pointer devices only).
 * - `focused`: focus is on the row or inside it — the keyboard path. The row
 *   is the tab stop, so this mounts the bar before the Tab that moves into it.
 * - `pinned`: something keeps the bar open regardless (reaction picker,
 *   delete confirm, report/redact dialog, a touch selection).
 */
export function shouldMountActionBar(s: {
    hovered: boolean;
    focused: boolean;
    pinned: boolean;
}): boolean {
    return s.hovered || s.focused || s.pinned;
}

/**
 * True when focus, now on `next` (`document.activeElement` once a `focusout`
 * has settled), is no longer on `row` or inside it.
 */
export function focusLeavesRow(row: Node, next: Node | null): boolean {
    return !next || !row.contains(next);
}
