/** Parameters for the {@link focusTrap} action. */
export interface FocusTrapParams {
    /** Called when Escape is pressed while focus is inside the trap. */
    onEscape?: () => void;
}

/**
 * Pure focus-cycle logic for a focus trap. Given the number of focusable
 * elements, the index of the currently-focused one (`-1` when focus is
 * outside the trap), and whether Shift is held, returns the index to move
 * focus to when Tab must wrap — or `null` to let the browser handle a
 * normal in-range Tab.
 */
export function focusWrapTarget(
    count: number,
    activeIndex: number,
    shift: boolean,
): number | null {
    if (count <= 0) return null;
    if (count === 1) return 0; // trap keeps focus on the only element
    if (activeIndex === -1) return shift ? count - 1 : 0; // pull focus back in
    if (!shift && activeIndex === count - 1) return 0; // forward off the end
    if (shift && activeIndex === 0) return count - 1; // backward off the start
    return null; // in-range: browser handles it
}

const FOCUSABLE_SELECTOR = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusableWithin(node: HTMLElement): HTMLElement[] {
    return Array.from(
        node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

/**
 * Svelte action: trap keyboard focus within `node` while it is mounted.
 * Moves focus into the node on mount, cycles Tab/Shift+Tab within it, calls
 * `onEscape` on Escape (and then stops that event propagating, so the global
 * handler cannot dismiss a second layer with the same keypress), and restores
 * focus to the previously-focused element on destroy. Pure cycle logic lives
 * in {@link focusWrapTarget}.
 */
export function focusTrap(node: HTMLElement, params: FocusTrapParams = {}) {
    let p = params;
    let focusRaf = 0;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    function focusFirst() {
        const items = focusableWithin(node);
        // A dialog can nominate the control the user actually came for (its
        // search field, not its close button) with `data-autofocus`. Selecting
        // it here rather than in a component `$effect` avoids racing this
        // rAF-deferred call, which would otherwise always win and land focus
        // on whatever happens to be first in DOM order.
        const nominated = items.find((el) => el.hasAttribute("data-autofocus"));
        const first = nominated ?? items[0];
        if (first) {
            first.focus();
        } else {
            node.setAttribute("tabindex", "-1");
            node.focus();
        }
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            // Only claim Escape when this trap actually handles it. AppShell's
            // window-level handler dismisses the topmost slot (modal, else
            // sidebar), and `onEscape` has usually already cleared the modal
            // synchronously by the time the event gets there — so letting it
            // bubble would dismiss the panel UNDERNEATH us too. Traps with no
            // `onEscape` depend on that global handler to be dismissed at all,
            // so they must keep bubbling.
            if (!p.onEscape) return;
            p.onEscape();
            e.stopPropagation();
            return;
        }
        if (e.key !== "Tab") return;
        const items = focusableWithin(node);
        const activeIndex = items.indexOf(
            document.activeElement as HTMLElement,
        );
        const target = focusWrapTarget(items.length, activeIndex, e.shiftKey);
        if (target !== null) {
            e.preventDefault();
            items[target]?.focus();
        }
    }

    node.addEventListener("keydown", onKeydown);
    // Defer initial focus to the next frame so the node is not only laid out
    // but also revealed: some openers (e.g. the context-menu `positionMenu`
    // action) mount hidden and un-hide inside their own rAF. Because Svelte
    // runs `use:` directives in declaration order, an opener listed before
    // `focusTrap` registers its reveal rAF first and it fires first, so
    // `focusFirst` lands on a visible element. Focusing a `visibility:hidden`
    // element (which a microtask-timed focus would hit) is a browser no-op.
    focusRaf = requestAnimationFrame(focusFirst);

    return {
        update(next: FocusTrapParams) {
            p = next;
        },
        destroy() {
            cancelAnimationFrame(focusRaf);
            node.removeEventListener("keydown", onKeydown);
            if (previouslyFocused && previouslyFocused.isConnected) {
                previouslyFocused.focus();
            }
        },
    };
}
