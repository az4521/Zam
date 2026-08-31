import { describe, it, expect, vi } from "vitest";
import { swipePan } from "./swipePan";
import { SWIPE_SHORT_PX, SWIPE_FAR_PX } from "$lib/utils/swipeGesture";

function touchEvent(type: string, x: number, y: number): Event {
    const e = new Event(type, { bubbles: true, cancelable: true });
    const t = [{ clientX: x, clientY: y }];
    Object.defineProperty(e, "touches", { value: t });
    Object.defineProperty(e, "changedTouches", { value: t });
    return e;
}

function setup(overrides: Partial<Parameters<typeof swipePan>[1]> = {}) {
    const node = document.createElement("div");
    document.body.appendChild(node);
    const calls = {
        engage: vi.fn(),
        move: vi.fn(),
        release: vi.fn(),
        cancel: vi.fn(),
    };
    const handle = swipePan(node, {
        enabled: true,
        onEngage: calls.engage,
        onMove: calls.move,
        onRelease: calls.release,
        onCancel: calls.cancel,
        ...overrides,
    });
    return { node, calls, handle };
}

describe("swipePan", () => {
    it("engages once and moves on a leftward drag, releases with the stage", () => {
        const { node, calls } = setup();
        node.dispatchEvent(touchEvent("touchstart", 200, 100));
        node.dispatchEvent(
            touchEvent("touchmove", 200 - (SWIPE_SHORT_PX + 5), 102),
        );
        expect(calls.engage).toHaveBeenCalledTimes(1);
        expect(calls.move).toHaveBeenCalled();
        const [, stage] = calls.move.mock.calls.at(-1)!;
        expect(stage).toBe("short");
        node.dispatchEvent(
            touchEvent("touchend", 200 - (SWIPE_SHORT_PX + 5), 102),
        );
        expect(calls.release).toHaveBeenCalledWith("short");
    });

    it("does not engage on a vertical drag (scroll wins)", () => {
        const { node, calls } = setup();
        node.dispatchEvent(touchEvent("touchstart", 200, 100));
        node.dispatchEvent(touchEvent("touchmove", 196, 260));
        node.dispatchEvent(touchEvent("touchend", 196, 260));
        expect(calls.engage).not.toHaveBeenCalled();
        expect(calls.release).not.toHaveBeenCalled();
    });

    it("does nothing when disabled", () => {
        const { node, calls } = setup({ enabled: false });
        node.dispatchEvent(touchEvent("touchstart", 200, 100));
        node.dispatchEvent(touchEvent("touchmove", 40, 100));
        expect(calls.engage).not.toHaveBeenCalled();
    });

    it("preventDefaults an engaged move (blocks scroll hijack)", () => {
        const { node } = setup();
        node.dispatchEvent(touchEvent("touchstart", 200, 100));
        const mv = touchEvent("touchmove", 200 - (SWIPE_FAR_PX + 5), 101);
        node.dispatchEvent(mv);
        expect(mv.defaultPrevented).toBe(true);
    });

    it("reports far stage past the far threshold", () => {
        const { node, calls } = setup();
        node.dispatchEvent(touchEvent("touchstart", 300, 100));
        node.dispatchEvent(
            touchEvent("touchmove", 300 - (SWIPE_FAR_PX + 10), 100),
        );
        const [, stage] = calls.move.mock.calls.at(-1)!;
        expect(stage).toBe("far");
    });

    it("fires onCancel on touchcancel", () => {
        const { node, calls } = setup();
        node.dispatchEvent(touchEvent("touchstart", 200, 100));
        node.dispatchEvent(touchEvent("touchmove", 120, 100));
        node.dispatchEvent(touchEvent("touchcancel", 120, 100));
        expect(calls.cancel).toHaveBeenCalled();
    });

    it("update() swaps params and destroy() removes listeners", () => {
        const { node, calls, handle } = setup();
        handle.update({ enabled: false });
        node.dispatchEvent(touchEvent("touchstart", 200, 100));
        node.dispatchEvent(touchEvent("touchmove", 40, 100));
        expect(calls.engage).not.toHaveBeenCalled();
        handle.destroy();
    });

    it("stops touchstart reaching ancestor drawer handlers when enabled", () => {
        const parent = document.createElement("div");
        const node = document.createElement("div");
        parent.appendChild(node);
        document.body.appendChild(parent);
        const ancestor = vi.fn();
        parent.addEventListener("touchstart", ancestor);
        const handle = swipePan(node, { enabled: true });
        node.dispatchEvent(touchEvent("touchstart", 200, 100));
        expect(ancestor).not.toHaveBeenCalled();
        handle.destroy();
        parent.remove();
    });

    it("lets touchstart reach ancestor drawer handlers when disabled", () => {
        const parent = document.createElement("div");
        const node = document.createElement("div");
        parent.appendChild(node);
        document.body.appendChild(parent);
        const ancestor = vi.fn();
        parent.addEventListener("touchstart", ancestor);
        const handle = swipePan(node, { enabled: false });
        node.dispatchEvent(touchEvent("touchstart", 200, 100));
        expect(ancestor).toHaveBeenCalledTimes(1);
        handle.destroy();
        parent.remove();
    });
});
