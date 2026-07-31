/**
 * Pure keyboard-navigation arithmetic for ARIA comboboxes and listboxes.
 *
 * A combobox keeps DOM focus on its text input and moves a *virtual* cursor
 * over the options via `aria-activedescendant`. That cursor is just an index,
 * so the rules for moving it — wrap or stop at the ends, recover when the
 * result list shrinks under it — are pure arithmetic and belong here rather
 * than being reinvented (and mis-reinvented) inside each component.
 *
 * An index of `-1` means "no option is active": the input's own text is the
 * current value and Enter should fall back to the component's default action.
 */

export type NavKey = "ArrowDown" | "ArrowUp" | "Home" | "End";

/**
 * Force an active index back into range for a list of `count` options.
 *
 * Returns `-1` (nothing active) rather than a nearest-neighbour guess when the
 * index no longer points at a real option: after the result list changes under
 * the user, silently moving the cursor to a *different* option would let Enter
 * pick something they never arrowed to.
 */
export function clampActiveIndex(current: number, count: number): number {
    if (count <= 0) return -1;
    if (current < 0 || current >= count) return -1;
    return current;
}

/**
 * The index the active option should move to for a navigation key.
 *
 * Wraps around both ends by default (the ARIA authoring-practices default for
 * a combobox popup); pass `{ loop: false }` to stop at the first/last option.
 * From nothing active, ArrowDown enters at the top and ArrowUp at the bottom.
 * An empty list always yields `-1`, and an out-of-range `current` is treated
 * as nothing active so a stale index cannot skew the next move.
 */
export function nextActiveIndex(
    current: number,
    count: number,
    key: NavKey,
    options?: { loop?: boolean },
): number {
    if (count <= 0) return -1;
    if (key === "Home") return 0;
    if (key === "End") return count - 1;

    const loop = options?.loop ?? true;
    const from = clampActiveIndex(current, count);

    if (key === "ArrowUp") {
        if (from === -1) return count - 1;
        if (from > 0) return from - 1;
        return loop ? count - 1 : 0;
    }

    // ArrowDown
    if (from === -1) return 0;
    if (from < count - 1) return from + 1;
    return loop ? 0 : count - 1;
}

/**
 * The DOM id of one option, for `aria-activedescendant`.
 *
 * `listId` must be unique per component *instance* — a picker mounted twice on
 * one page would otherwise emit duplicate ids and both instances' ARIA
 * references would resolve to whichever element the document happens to hold
 * first.
 */
export function optionId(listId: string, index: number): string {
    return `${listId}-option-${index}`;
}
