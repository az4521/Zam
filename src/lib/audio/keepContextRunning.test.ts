import { describe, expect, it, vi } from "vitest";
import { contextNeedsResume, keepContextRunning } from "./keepContextRunning";

function target() {
    const listeners = new Map<string, Set<() => void>>();
    return {
        listeners,
        addEventListener: (type: string, l: () => void) => {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type)!.add(l);
        },
        removeEventListener: (type: string, l: () => void) =>
            listeners.get(type)?.delete(l),
        fire(type: string) {
            for (const l of listeners.get(type) ?? []) l();
        },
    };
}

function setup(state: string, visibility = "visible") {
    const ctx = Object.assign(target(), {
        state,
        resume: vi.fn(() => Promise.resolve()),
    });
    const page = Object.assign(target(), { visibilityState: visibility });
    const win = Object.assign(target(), { visibilityState: "visible" });
    const stop = keepContextRunning(ctx, page, win);
    return { ctx, page, win, stop };
}

describe("contextNeedsResume", () => {
    it("covers autoplay suspension and WebKit interruption only", () => {
        expect(contextNeedsResume("suspended")).toBe(true);
        expect(contextNeedsResume("interrupted")).toBe(true);
        expect(contextNeedsResume("running")).toBe(false);
        expect(contextNeedsResume("closed")).toBe(false);
    });
});

describe("keepContextRunning", () => {
    it("resumes an interrupted context when the page comes back", () => {
        const { ctx, page } = setup("interrupted", "hidden");
        ctx.fire("statechange");
        expect(ctx.resume).not.toHaveBeenCalled();
        page.visibilityState = "visible";
        page.fire("visibilitychange");
        expect(ctx.resume).toHaveBeenCalledTimes(1);
    });

    it("resumes a context that stops while visible", () => {
        const { ctx } = setup("running");
        ctx.state = "interrupted";
        ctx.fire("statechange");
        expect(ctx.resume).toHaveBeenCalledTimes(1);
    });

    it("leaves running and closed contexts alone", () => {
        const { ctx, win } = setup("running");
        win.fire("pageshow");
        ctx.state = "closed";
        ctx.fire("statechange");
        expect(ctx.resume).not.toHaveBeenCalled();
    });

    it("removes every listener on teardown", () => {
        const { ctx, page, win, stop } = setup("running");
        stop();
        for (const t of [ctx, page, win])
            for (const set of t.listeners.values()) expect(set.size).toBe(0);
    });
});
