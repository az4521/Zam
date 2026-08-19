import { afterEach, describe, expect, it, vi } from "vitest";
import { suppressNextClick } from "./suppressNextClick";

/**
 * These tests run in jsdom. A capture-phase listener on `window` is the very
 * first listener invoked for any event dispatched on a connected node, so the
 * guard can cancel a click before it reaches whatever element is under the
 * cursor.
 */
describe("suppressNextClick", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    function fireClick(el: EventTarget): MouseEvent {
        const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
        el.dispatchEvent(ev);
        return ev;
    }

    it("cancels the next click after arming", () => {
        const node = document.createElement("div");
        document.body.appendChild(node);
        try {
            suppressNextClick();
            const ev = fireClick(node);
            expect(ev.defaultPrevented).toBe(true);
        } finally {
            node.remove();
        }
    });

    it("stops the click from reaching a handler behind it", () => {
        const link = document.createElement("a");
        document.body.appendChild(link);
        const behindHandler = vi.fn();
        link.addEventListener("click", behindHandler);
        try {
            suppressNextClick();
            fireClick(link);
            expect(behindHandler).not.toHaveBeenCalled();
        } finally {
            link.remove();
        }
    });

    it("self-disposes: only the first click is cancelled", () => {
        const node = document.createElement("div");
        document.body.appendChild(node);
        try {
            suppressNextClick();
            const first = fireClick(node);
            const second = fireClick(node);
            expect(first.defaultPrevented).toBe(true);
            expect(second.defaultPrevented).toBe(false);
        } finally {
            node.remove();
        }
    });

    it("disposer cancels the arming before any click fires", () => {
        const node = document.createElement("div");
        document.body.appendChild(node);
        try {
            const dispose = suppressNextClick();
            dispose();
            const ev = fireClick(node);
            expect(ev.defaultPrevented).toBe(false);
        } finally {
            node.remove();
        }
    });

    it("calling the disposer twice is safe", () => {
        const dispose = suppressNextClick();
        expect(() => {
            dispose();
            dispose();
        }).not.toThrow();
    });

    it("auto-disposes after the timeout so a later click is not swallowed", () => {
        vi.useFakeTimers();
        const node = document.createElement("div");
        document.body.appendChild(node);
        try {
            suppressNextClick({ timeoutMs: 500 });
            vi.advanceTimersByTime(501);
            const ev = fireClick(node);
            expect(ev.defaultPrevented).toBe(false);
        } finally {
            node.remove();
        }
    });

    it("does not auto-dispose before the timeout elapses", () => {
        vi.useFakeTimers();
        const node = document.createElement("div");
        document.body.appendChild(node);
        try {
            suppressNextClick({ timeoutMs: 500 });
            vi.advanceTimersByTime(499);
            const ev = fireClick(node);
            expect(ev.defaultPrevented).toBe(true);
        } finally {
            node.remove();
        }
    });

    it("listens on a custom target", () => {
        const el = document.createElement("button");
        document.body.appendChild(el);
        const outside = document.createElement("div");
        document.body.appendChild(outside);
        try {
            suppressNextClick({ target: el });
            // A click on an unrelated element is not swallowed.
            const other = fireClick(outside);
            expect(other.defaultPrevented).toBe(false);
            // A click on the guarded target is swallowed.
            const guarded = new MouseEvent("click", {
                bubbles: true,
                cancelable: true,
            });
            el.dispatchEvent(guarded);
            expect(guarded.defaultPrevented).toBe(true);
        } finally {
            el.remove();
            outside.remove();
        }
    });
});
