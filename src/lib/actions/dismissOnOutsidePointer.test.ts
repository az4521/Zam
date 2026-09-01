import { describe, it, expect, vi, afterEach } from "vitest";
import { dismissOnOutsidePointer } from "./dismissOnOutsidePointer";

// jsdom lacks a PointerEvent constructor; the listener matches on the event
// TYPE string, so a MouseEvent typed "pointerdown" exercises the same path.
function firePointerDown(target: EventTarget) {
    target.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, cancelable: true }),
    );
}

describe("dismissOnOutsidePointer", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("dismisses on a pointerdown outside the node", () => {
        const menu = document.createElement("div");
        const outside = document.createElement("button");
        document.body.append(menu, outside);
        const onDismiss = vi.fn();
        dismissOnOutsidePointer(menu, { onDismiss });

        firePointerDown(outside);
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it("does NOT dismiss on a pointerdown inside the node", () => {
        const menu = document.createElement("div");
        const item = document.createElement("button");
        menu.append(item);
        document.body.append(menu);
        const onDismiss = vi.fn();
        dismissOnOutsidePointer(menu, { onDismiss });

        firePointerDown(item);
        expect(onDismiss).not.toHaveBeenCalled();
    });

    it("stops dismissing after destroy", () => {
        const menu = document.createElement("div");
        const outside = document.createElement("button");
        document.body.append(menu, outside);
        const onDismiss = vi.fn();
        const handle = dismissOnOutsidePointer(menu, { onDismiss });

        handle.destroy();
        firePointerDown(outside);
        expect(onDismiss).not.toHaveBeenCalled();
    });

    it("uses the latest onDismiss after update", () => {
        const menu = document.createElement("div");
        const outside = document.createElement("button");
        document.body.append(menu, outside);
        const first = vi.fn();
        const second = vi.fn();
        const handle = dismissOnOutsidePointer(menu, { onDismiss: first });

        handle.update({ onDismiss: second });
        firePointerDown(outside);
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });

    it("does not throw when the pointerdown target is null", () => {
        const menu = document.createElement("div");
        document.body.append(menu);
        const onDismiss = vi.fn();
        dismissOnOutsidePointer(menu, { onDismiss });

        expect(() => firePointerDown(window)).not.toThrow();
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });
});
