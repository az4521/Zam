/** Parameters for the {@link dismissOnOutsidePointer} action. */
export interface DismissOnOutsidePointerParams {
    /** Called when a pointerdown lands outside the node. */
    onDismiss: () => void;
}

/**
 * Svelte action: while `node` is mounted, dismiss it when a `pointerdown`
 * lands OUTSIDE it. Used by the desktop context menus (room, space,
 * call-participant) in place of a full-viewport backdrop `<button>`.
 *
 * Why not a backdrop: a `fixed inset-0` backdrop is the top hit target, so a
 * right-click on a DIFFERENT menu target lands on the backdrop and that
 * target's own `oncontextmenu` never fires — the menu is stuck on the first
 * target. With no backdrop, the pointer reaches the real element: this action
 * dismisses the open menu on the outside `pointerdown`, and the right-click's
 * following `contextmenu` opens the new target's menu in the same gesture.
 *
 * Listens in the CAPTURE phase so it runs even if something stops propagation,
 * and never calls preventDefault/stopPropagation — the outside event MUST be
 * free to continue to its real target. A `pointerdown` inside the node is the
 * menu's own interaction and is ignored.
 */
export function dismissOnOutsidePointer(
    node: HTMLElement,
    params: DismissOnOutsidePointerParams,
) {
    let p = params;

    function onPointerDown(e: PointerEvent) {
        const target = e.target;
        if (target instanceof Node && node.contains(target)) return;
        p.onDismiss();
    }

    window.addEventListener("pointerdown", onPointerDown, true);

    return {
        update(next: DismissOnOutsidePointerParams) {
            p = next;
        },
        destroy() {
            window.removeEventListener("pointerdown", onPointerDown, true);
        },
    };
}
