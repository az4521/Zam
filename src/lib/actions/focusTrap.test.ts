import {
    describe,
    it,
    expect,
    vi,
    afterEach,
    beforeAll,
    afterAll,
} from "vitest";
import { focusWrapTarget, focusTrap, activeFocusTrap } from "./focusTrap";

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

// Initial focus. The trap focuses the first focusable in DOM order, which for a
// dialog is usually its close ✕ button rather than the field the user came to
// use. `data-autofocus` lets a dialog nominate that field without racing the
// trap's own rAF-deferred focus call (audit A11Y-01: "initial focus").
describe("focusTrap initial focus", () => {
    let teardown: (() => void) | null = null;

    // jsdom has no layout engine and hard-codes `offsetParent` to null, so the
    // action's visibility filter (`el.offsetParent !== null`) would reject every
    // element here and the trap would fall back to focusing its own node —
    // making all three assertions read `<div>` instead of a control. Report
    // attached elements as laid out for the duration of this block; the action
    // itself is deliberately left alone, since that filter is what keeps a
    // display:none control from stealing focus in a real browser.
    const realOffsetParent = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        "offsetParent",
    );

    beforeAll(() => {
        Object.defineProperty(HTMLElement.prototype, "offsetParent", {
            configurable: true,
            get(this: HTMLElement) {
                return this.parentElement;
            },
        });
    });

    afterAll(() => {
        if (realOffsetParent) {
            Object.defineProperty(
                HTMLElement.prototype,
                "offsetParent",
                realOffsetParent,
            );
        }
    });

    afterEach(() => {
        teardown?.();
        teardown = null;
    });

    function mount(html: string) {
        const node = document.createElement("div");
        node.innerHTML = html;
        document.body.appendChild(node);
        const handle = focusTrap(node, {});
        teardown = () => {
            handle.destroy();
            node.remove();
        };
        return node;
    }

    /** The trap defers its initial focus to the next animation frame. */
    function nextFrame() {
        return new Promise((resolve) => requestAnimationFrame(resolve));
    }

    it("focuses the first focusable element when nothing opts in", async () => {
        const node = mount(
            `<button id="close">x</button><input id="search" />`,
        );
        await nextFrame();
        expect(document.activeElement?.id).toBe("close");
    });

    it("focuses the nominated element instead of the first one", async () => {
        const node = mount(
            `<button id="close">x</button><input id="search" data-autofocus />`,
        );
        await nextFrame();
        expect(document.activeElement?.id).toBe("search");
    });

    it("falls back to the first focusable when the nominee cannot take focus", async () => {
        const node = mount(
            `<button id="close">x</button><input id="search" data-autofocus disabled />`,
        );
        await nextFrame();
        expect(document.activeElement?.id).toBe("close");
    });
});

describe("activeFocusTrap", () => {
    let teardown: (() => void) | null = null;

    // Use the same offsetParent stub as the initial-focus tests.
    const realOffsetParent = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        "offsetParent",
    );

    beforeAll(() => {
        Object.defineProperty(HTMLElement.prototype, "offsetParent", {
            configurable: true,
            get(this: HTMLElement) {
                return this.parentElement;
            },
        });
    });

    afterAll(() => {
        if (realOffsetParent) {
            Object.defineProperty(
                HTMLElement.prototype,
                "offsetParent",
                realOffsetParent,
            );
        }
    });

    afterEach(() => {
        teardown?.();
        teardown = null;
    });

    function mount(active: boolean, onEscape?: () => void) {
        const node = document.createElement("div");
        node.innerHTML = `<button id="btn">test</button>`;
        document.body.appendChild(node);
        const handle = activeFocusTrap(node, { active, onEscape });
        teardown = () => {
            handle.destroy();
            node.remove();
        };
        return { node, handle };
    }

    function nextFrame() {
        return new Promise((resolve) => requestAnimationFrame(resolve));
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

    it("does not move focus when active is false", async () => {
        const original = document.activeElement;
        mount(false);
        await nextFrame();
        expect(document.activeElement).toBe(original);
    });

    it("does not call onEscape when active is false", () => {
        const onEscape = vi.fn();
        const { node } = mount(false, onEscape);
        pressEscape(node);
        expect(onEscape).not.toHaveBeenCalled();
    });

    it("activates the trap when active is true", async () => {
        const { node } = mount(true);
        await nextFrame();
        const btn = node.querySelector("#btn");
        expect(document.activeElement).toBe(btn);
    });

    it("calls onEscape when active is true", () => {
        const onEscape = vi.fn();
        const { node } = mount(true, onEscape);
        pressEscape(node);
        expect(onEscape).toHaveBeenCalledTimes(1);
    });

    it("stops calling onEscape after active flips to false", async () => {
        const onEscape = vi.fn();
        const { node, handle } = mount(true, onEscape);
        await nextFrame();

        handle.update?.({ active: false, onEscape });
        pressEscape(node);

        expect(onEscape).not.toHaveBeenCalled();
    });

    it("starts calling onEscape again after flipping back to true", async () => {
        const onEscape = vi.fn();
        const { node, handle } = mount(false, onEscape);
        await nextFrame();

        handle.update?.({ active: true, onEscape });
        await nextFrame();
        pressEscape(node);

        expect(onEscape).toHaveBeenCalledTimes(1);
    });

    it("cleans up when destroyed while active", async () => {
        const onEscape = vi.fn();
        const { node, handle } = mount(true, onEscape);
        await nextFrame();

        handle.destroy();
        pressEscape(node);

        expect(onEscape).not.toHaveBeenCalled();
    });
});
