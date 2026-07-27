import { describe, it, expect, vi, afterEach } from "vitest";
import { focusWrapTarget, focusTrap } from "./focusTrap";

describe("focusWrapTarget", () => {
    it("returns null when there is nothing to trap", () => {
        expect(focusWrapTarget(0, -1, false)).toBeNull();
    });

    it("wraps forward from the last element to the first", () => {
        expect(focusWrapTarget(3, 2, false)).toBe(0);
    });

    it("wraps backward from the first element to the last", () => {
        expect(focusWrapTarget(3, 0, true)).toBe(2);
    });

    it("lets the browser handle a normal forward Tab in range", () => {
        expect(focusWrapTarget(3, 0, false)).toBeNull();
        expect(focusWrapTarget(3, 1, false)).toBeNull();
    });

    it("lets the browser handle a normal backward Tab in range", () => {
        expect(focusWrapTarget(3, 2, true)).toBeNull();
        expect(focusWrapTarget(3, 1, true)).toBeNull();
    });

    it("pulls focus back into the trap when it escaped (activeIndex -1)", () => {
        expect(focusWrapTarget(3, -1, false)).toBe(0); // forward → first
        expect(focusWrapTarget(3, -1, true)).toBe(2); // backward → last
    });

    it("keeps focus on the sole element when count is 1", () => {
        expect(focusWrapTarget(1, 0, false)).toBe(0);
        expect(focusWrapTarget(1, 0, true)).toBe(0);
    });
});

// Escape ownership. AppShell listens for Escape on `window` and dismisses the
// topmost slot (modal, else sidebar). A trap that handles its own Escape must
// therefore stop the event bubbling, or the same keypress dismisses the trap
// AND whatever is underneath it — e.g. the room-header overflow sheet closing
// the member list along with itself. But traps WITHOUT an `onEscape` rely on
// that global handler to dismiss them, so the event must still bubble there.
describe("focusTrap Escape propagation", () => {
    let teardown: (() => void) | null = null;

    afterEach(() => {
        teardown?.();
        teardown = null;
    });

    /** Mount the trap on a child of a spy-listening parent. */
    function mountTrap(params: { onEscape?: () => void }) {
        const parent = document.createElement("div");
        const node = document.createElement("div");
        node.appendChild(document.createElement("button"));
        parent.appendChild(node);
        document.body.appendChild(parent);

        // Stands in for AppShell's `<svelte:window onkeydown>`: it only runs
        // if the event is allowed to bubble out of the trap.
        const globalHandler = vi.fn();
        parent.addEventListener("keydown", globalHandler);

        const handle = focusTrap(node, params);
        teardown = () => {
            handle.destroy();
            parent.remove();
        };
        return { node, globalHandler };
    }

    function pressEscape(node: HTMLElement) {
        node.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "Escape",
                bubbles: true,
                cancelable: true,
            }),
        );
    }

    it("handles Escape itself and stops it reaching the global handler", () => {
        const onEscape = vi.fn();
        const { node, globalHandler } = mountTrap({ onEscape });

        pressEscape(node);

        expect(onEscape).toHaveBeenCalledTimes(1);
        expect(globalHandler).not.toHaveBeenCalled();
    });

    it("lets Escape bubble to the global handler when there is no onEscape", () => {
        const { node, globalHandler } = mountTrap({});

        pressEscape(node);

        expect(globalHandler).toHaveBeenCalledTimes(1);
    });

    it("still lets other keys bubble even when onEscape is supplied", () => {
        const { node, globalHandler } = mountTrap({ onEscape: vi.fn() });

        node.dispatchEvent(
            new KeyboardEvent("keydown", { key: "a", bubbles: true }),
        );

        expect(globalHandler).toHaveBeenCalledTimes(1);
    });
});
