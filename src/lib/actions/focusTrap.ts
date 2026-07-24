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
 * `onEscape` on Escape, and restores focus to the previously-focused element
 * on destroy. Pure cycle logic lives in {@link focusWrapTarget}.
 */
export function focusTrap(node: HTMLElement, params: FocusTrapParams = {}) {
    let p = params;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    function focusFirst() {
        const items = focusableWithin(node);
        if (items.length > 0) {
            items[0].focus();
        } else {
            node.setAttribute("tabindex", "-1");
            node.focus();
        }
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            p.onEscape?.();
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
    // Defer initial focus one microtask so the node's children are laid out.
    queueMicrotask(focusFirst);

    return {
        update(next: FocusTrapParams) {
            p = next;
        },
        destroy() {
            node.removeEventListener("keydown", onKeydown);
            if (previouslyFocused && previouslyFocused.isConnected) {
                previouslyFocused.focus();
            }
        },
    };
}
