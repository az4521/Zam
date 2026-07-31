import { describe, it, expect, vi, afterEach } from "vitest";
import { nextRovingIndex, rovingToolbar } from "./rovingToolbar";

describe("nextRovingIndex", () => {
    it("moves right and wraps", () => {
        expect(nextRovingIndex(3, 0, "ArrowRight")).toBe(1);
        expect(nextRovingIndex(3, 2, "ArrowRight")).toBe(0);
    });

    it("moves left and wraps", () => {
        expect(nextRovingIndex(3, 1, "ArrowLeft")).toBe(0);
        expect(nextRovingIndex(3, 0, "ArrowLeft")).toBe(2);
    });

    it("jumps to the ends", () => {
        expect(nextRovingIndex(3, 1, "Home")).toBe(0);
        expect(nextRovingIndex(3, 1, "End")).toBe(2);
    });

    it("ignores keys it does not own", () => {
        for (const key of [
            "ArrowUp",
            "ArrowDown",
            "Enter",
            " ",
            "Escape",
            "Tab",
            "PageUp",
        ]) {
            expect(nextRovingIndex(3, 0, key)).toBeNull();
        }
    });

    it("returns null when there is nothing to move between", () => {
        expect(nextRovingIndex(0, 0, "ArrowRight")).toBeNull();
        expect(nextRovingIndex(1, 0, "ArrowRight")).toBeNull();
        expect(nextRovingIndex(0, 0, "Home")).toBeNull();
        expect(nextRovingIndex(1, 0, "End")).toBeNull();
    });

    // An index outside [0, count) can only come from a list that changed under
    // us (the delete-confirm buttons swap in and out of the message bar). It
    // must land on a real edge, never out of range and never mid-list.
    it("treats an out-of-range current index as the edge", () => {
        expect(nextRovingIndex(3, -1, "ArrowRight")).toBe(0);
        expect(nextRovingIndex(3, -1, "ArrowLeft")).toBe(2);
        expect(nextRovingIndex(3, 99, "ArrowLeft")).toBe(2);
        expect(nextRovingIndex(3, 99, "ArrowRight")).toBe(0);
    });

    it("never returns an index outside the list", () => {
        for (const count of [2, 3, 8]) {
            for (const current of [-99, -1, 0, 1, count - 1, count, 99]) {
                for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
                    const next = nextRovingIndex(count, current, key);
                    expect(next).not.toBeNull();
                    expect(next).toBeGreaterThanOrEqual(0);
                    expect(next).toBeLessThan(count);
                }
            }
        }
    });
});

describe("rovingToolbar action", () => {
    let teardown: (() => void) | null = null;

    afterEach(() => {
        teardown?.();
        teardown = null;
    });

    /** Mount the action on a focusable row inside a spy-listening parent. */
    function mount(buttonCount = 3) {
        const parent = document.createElement("div");
        const row = document.createElement("div");
        row.tabIndex = 0;
        const bar = document.createElement("div");
        bar.setAttribute("data-message-actions", "");
        for (let i = 0; i < buttonCount; i++) {
            const b = document.createElement("button");
            b.textContent = `b${i}`;
            bar.appendChild(b);
        }
        row.appendChild(bar);
        parent.appendChild(row);
        document.body.appendChild(parent);

        // Stands in for whatever binds arrow keys further up the tree.
        const outerKeydown = vi.fn();
        parent.addEventListener("keydown", outerKeydown);

        const handle = rovingToolbar(row, {
            toolbarSelector: "[data-message-actions]",
        });
        teardown = () => {
            handle.destroy();
            parent.remove();
        };
        const buttons = Array.from(bar.querySelectorAll("button"));
        return { parent, row, bar, buttons, handle, outerKeydown };
    }

    const tabIndexes = (buttons: HTMLButtonElement[]) =>
        buttons.map((b) => b.tabIndex);

    function press(el: HTMLElement, key: string) {
        const evt = new KeyboardEvent("keydown", {
            key,
            bubbles: true,
            cancelable: true,
        });
        el.dispatchEvent(evt);
        return evt;
    }

    it("makes only the first item tabbable once the row takes focus", () => {
        const { row, buttons } = mount();
        row.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        expect(tabIndexes(buttons)).toEqual([0, -1, -1]);
    });

    // Rubric 1: the action must never forward focus from the row into the bar,
    // or Shift+Tab out of the first item would be pulled straight back in.
    // Focus on the row stays on the row; the bar is reached with a plain Tab
    // and left again with Shift+Tab back onto the row.
    it("does not steal focus when the row is focused", () => {
        const { row, buttons } = mount();
        row.focus();
        expect(document.activeElement).toBe(row);
        expect(buttons.some((b) => b === document.activeElement)).toBe(false);
    });

    it("moves focus with ArrowRight and keeps a single tab stop", () => {
        const { row, buttons } = mount();
        row.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        buttons[0].focus();
        press(buttons[0], "ArrowRight");
        expect(document.activeElement).toBe(buttons[1]);
        expect(tabIndexes(buttons)).toEqual([-1, 0, -1]);
    });

    it("wraps with ArrowLeft and honours Home/End", () => {
        const { row, buttons } = mount();
        row.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        buttons[0].focus();
        press(buttons[0], "ArrowLeft");
        expect(document.activeElement).toBe(buttons[2]);
        press(buttons[2], "Home");
        expect(document.activeElement).toBe(buttons[0]);
        press(buttons[0], "End");
        expect(document.activeElement).toBe(buttons[2]);
    });

    it("claims the keys it handles so they do not reach the rest of the app", () => {
        const { row, buttons, outerKeydown } = mount();
        row.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        buttons[0].focus();
        const evt = press(buttons[0], "ArrowRight");
        expect(evt.defaultPrevented).toBe(true);
        expect(outerKeydown).not.toHaveBeenCalled();
    });

    // Pins the item contract documented on the action. Svelte 5 delegates a
    // markup `onkeydown` to the app root in the BUBBLE phase, so a handler an
    // item declares only runs if the event survives the trip up past this row
    // — and for the four owned keys it does not. An item that wanted its own
    // arrow handling would therefore silently never receive it.
    it("takes its keys from an item's own delegated handler but not from a non-item", () => {
        const { parent, row, bar, buttons } = mount();
        const delegated: EventTarget[] = [];
        parent.addEventListener("keydown", (e) => {
            delegated.push(e.target as EventTarget);
        });

        row.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        buttons[0].focus();
        press(buttons[0], "ArrowRight");
        expect(delegated).toEqual([]); // the item never sees its own arrow key

        // A control that is not in the item set keeps its arrow keys.
        const field = document.createElement("input");
        bar.appendChild(field);
        field.focus();
        press(field, "ArrowRight");
        expect(delegated).toEqual([field]);
    });

    it("leaves keys it does not own alone", () => {
        const { row, buttons, outerKeydown } = mount();
        row.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        buttons[0].focus();
        for (const key of ["Enter", " ", "Escape", "Tab", "ArrowUp"]) {
            const evt = press(buttons[0], key);
            expect(evt.defaultPrevented).toBe(false);
        }
        expect(outerKeydown).toHaveBeenCalledTimes(5);
        expect(document.activeElement).toBe(buttons[0]);
    });

    it("ignores arrow keys that did not come from a toolbar item", () => {
        const { row, bar, buttons } = mount();
        row.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

        // Focus a real element first: left on <body>, an "activeElement did
        // not move" assertion would hold even if the action had moved focus.
        row.focus();
        const outside = press(row, "ArrowRight");
        expect(outside.defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(row);
        expect(tabIndexes(buttons)).toEqual([0, -1, -1]);

        // A control nested inside the bar (a picker's search field) owns its
        // own arrow keys — the toolbar must not hijack them.
        const field = document.createElement("input");
        bar.appendChild(field);
        field.focus();
        const nested = press(field, "ArrowRight");
        expect(nested.defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(field);
    });

    it("skips disabled items", () => {
        const { row, buttons } = mount();
        buttons[1].disabled = true;
        row.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        buttons[0].focus();
        press(buttons[0], "ArrowRight");
        expect(document.activeElement).toBe(buttons[2]);
    });

    it("remembers the last used item as the tab stop", () => {
        const { row, buttons } = mount();
        row.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        buttons[2].dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        expect(tabIndexes(buttons)).toEqual([-1, -1, 0]);
    });

    // The bar's contents change (the delete-confirm pair swaps in and out), so
    // a remembered index can outlive the item it pointed at.
    it("falls back to the first item when the remembered one is gone", () => {
        const { row, buttons } = mount();
        buttons[2].dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        buttons[2].remove();
        row.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        expect(tabIndexes([buttons[0], buttons[1]])).toEqual([0, -1]);
    });

    // The bar re-renders while focus sits elsewhere in the row, so nothing
    // re-syncs — until Tab, the one moment the tab order is about to be used.
    it("re-syncs the tab order when an item disappears while focus is elsewhere in the row", () => {
        const { row, buttons } = mount();
        buttons[2].focus(); // item 2 becomes the remembered tab stop
        expect(tabIndexes(buttons)).toEqual([-1, -1, 0]);

        row.focus(); // focus moves elsewhere in the same row
        buttons[2].remove(); // ...and then the bar drops that item
        const left = [buttons[0], buttons[1]];
        expect(left.filter((b) => b.tabIndex === 0)).toHaveLength(0);

        press(row, "Tab");
        expect(left.filter((b) => b.tabIndex === 0)).toHaveLength(1);
        expect(tabIndexes(left)).toEqual([0, -1]);
    });

    it("does not leave two tab stops when a new item is rendered", () => {
        const { row, bar, buttons } = mount();
        buttons[0].focus();
        expect(tabIndexes(buttons)).toEqual([0, -1, -1]);

        row.focus();
        const fresh = document.createElement("button"); // defaults to tabIndex 0
        bar.appendChild(fresh);
        expect(
            [...buttons, fresh].filter((b) => b.tabIndex === 0),
        ).toHaveLength(2);

        press(row, "Tab");
        expect(fresh.tabIndex).toBe(-1);
        expect(tabIndexes([...buttons, fresh])).toEqual([0, -1, -1, -1]);
    });

    it("does nothing when the toolbar is absent", () => {
        const row = document.createElement("div");
        document.body.appendChild(row);
        const handle = rovingToolbar(row, {
            toolbarSelector: "[data-message-actions]",
        });
        teardown = () => {
            handle.destroy();
            row.remove();
        };
        expect(() =>
            row.dispatchEvent(new FocusEvent("focusin", { bubbles: true })),
        ).not.toThrow();
        expect(() => press(row, "ArrowRight")).not.toThrow();
    });

    it("retargets the toolbar on update", () => {
        const { row, bar, buttons, handle } = mount();
        // Sync the first bar before retargeting, or the assertions below only
        // hold because the action had never written to it.
        row.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        expect(tabIndexes(buttons)).toEqual([0, -1, -1]);

        const other = document.createElement("div");
        other.setAttribute("data-other-actions", "");
        const otherButtons = [
            document.createElement("button"),
            document.createElement("button"),
        ];
        for (const b of otherButtons) other.appendChild(b);
        row.appendChild(other);

        handle.update({ toolbarSelector: "[data-other-actions]" });
        row.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

        // Two buttons, so "one tab stop" is a real claim and not a fresh
        // button's default.
        expect(tabIndexes(otherButtons)).toEqual([0, -1]);
        // The action only ever writes to its current toolbar, so the bar it
        // was retargeted away from keeps the tabindexes it was left with —
        // items 1 and 2 stay stranded at -1. Harmless for the real consumer,
        // whose params never change, but it is what actually happens.
        expect(tabIndexes(buttons)).toEqual([0, -1, -1]);
        expect(bar.contains(otherButtons[0])).toBe(false);
    });

    it("detaches its listeners on destroy", () => {
        const { row, buttons, handle } = mount();
        row.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        buttons[0].focus();
        handle.destroy(); // leave the DOM up; afterEach still tears it down
        const evt = press(buttons[0], "ArrowRight");
        expect(evt.defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(buttons[0]);
    });
});
