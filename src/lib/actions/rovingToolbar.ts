/** Keys the roving toolbar owns. Everything else is left to bubble. */
const KEYS = new Set(["ArrowLeft", "ArrowRight", "Home", "End"]);

/**
 * Next active index for a roving-tabindex toolbar, or `null` when the key is
 * not ours / there is nothing to move between. Pure: no DOM, no side effects.
 *
 * `current` may be out of range when the item list changed under us (the
 * message bar swaps its delete-confirm buttons in and out). Such an index is
 * treated as a virtual slot just past the corresponding edge, so the step
 * always lands on a real item at an edge — never out of range, never mid-list.
 */
export function nextRovingIndex(
    count: number,
    current: number,
    key: string,
): number | null {
    if (count < 2 || !KEYS.has(key)) return null;
    if (key === "Home") return 0;
    if (key === "End") return count - 1;
    const from = Math.min(Math.max(current, -1), count);
    if (key === "ArrowRight") {
        const next = from + 1;
        return next >= count ? 0 : next;
    }
    const prev = from - 1;
    return prev < 0 ? count - 1 : prev;
}

/** Parameters for the {@link rovingToolbar} action. */
export interface RovingToolbarParams {
    /** Selector for the toolbar container inside `node`. */
    toolbarSelector: string;
    /** Selector for the toolbar's focusable items. */
    itemSelector?: string;
}

const DEFAULT_ITEMS = "button:not([disabled])";

/**
 * Svelte action: makes a hover-revealed action bar a single tab stop whose
 * items are traversed with the arrow keys (the ARIA toolbar pattern).
 *
 * Attach it to the container that owns focus — the message ROW — pointing at
 * the bar, NOT to the bar itself: the bar is `display:none` until the row has
 * focus-within, so nothing inside it can be focused first to reveal it. The
 * row's `focusin` is what synchronises the item tabindexes, and by the time
 * the browser moves focus onward with Tab the bar is displayed and its active
 * item is tabbable.
 *
 * The action never moves focus by itself, so Shift+Tab out of the first item
 * lands back on the row and Tab off the active item leaves the row entirely —
 * there is no keyboard trap.
 *
 * Deliberately no `MutationObserver` (per-row observers were removed from this
 * surface for measured cost): the item list is re-queried on every `focusin`
 * and every handled `keydown`. Also deliberately no Escape handling — Escape
 * belongs to the pickers and dialogs these buttons open.
 */
export function rovingToolbar(node: HTMLElement, params: RovingToolbarParams) {
    let p = params;
    let active = 0;

    const items = (): HTMLElement[] => {
        const bar = node.querySelector(p.toolbarSelector);
        if (!bar) return [];
        return Array.from(
            bar.querySelectorAll<HTMLElement>(p.itemSelector ?? DEFAULT_ITEMS),
        );
    };

    /** Exactly one item is tabbable; the rest are reachable by arrow key only. */
    const sync = (list: HTMLElement[]) => {
        if (list.length === 0) return;
        if (active >= list.length || active < 0) active = 0;
        list.forEach((el, i) => {
            el.tabIndex = i === active ? 0 : -1;
        });
    };

    const onFocusIn = (e: FocusEvent) => {
        const list = items();
        const i = list.indexOf(e.target as HTMLElement);
        if (i >= 0) active = i;
        sync(list);
    };

    const onKeydown = (e: KeyboardEvent) => {
        const list = items();
        // Strict identity, not `closest`: a key pressed in something nested
        // inside the bar (a picker's search field) is not ours to handle.
        const from = list.indexOf(e.target as HTMLElement);
        if (from < 0) return; // not on a toolbar item — leave the key alone
        const next = nextRovingIndex(list.length, from, e.key);
        if (next === null) return;
        e.preventDefault();
        e.stopPropagation();
        active = next;
        sync(list);
        list[next].focus();
    };

    node.addEventListener("focusin", onFocusIn);
    node.addEventListener("keydown", onKeydown);

    return {
        update(next: RovingToolbarParams) {
            p = next;
        },
        destroy() {
            node.removeEventListener("focusin", onFocusIn);
            node.removeEventListener("keydown", onKeydown);
        },
    };
}
