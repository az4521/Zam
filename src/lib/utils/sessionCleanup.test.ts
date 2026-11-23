import { afterEach, describe, expect, it, vi } from "vitest";
import { onSessionTeardown, runSessionTeardown } from "./sessionCleanup";

describe("sessionCleanup", () => {
    const unregisters: Array<() => void> = [];
    const register = (fn: () => void) => {
        const u = onSessionTeardown(fn);
        unregisters.push(u);
        return u;
    };
    afterEach(() => {
        for (const u of unregisters.splice(0)) u();
        vi.restoreAllMocks();
    });

    it("runs every registered hook", () => {
        const a = vi.fn();
        const b = vi.fn();
        register(a);
        register(b);
        runSessionTeardown();
        expect(a).toHaveBeenCalledTimes(1);
        expect(b).toHaveBeenCalledTimes(1);
    });

    it("stops running a hook once its unregister is called", () => {
        const fn = vi.fn();
        const unregister = register(fn);
        unregister();
        runSessionTeardown();
        expect(fn).not.toHaveBeenCalled();
    });

    it("keeps running the remaining hooks when one throws", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const boom = vi.fn(() => {
            throw new Error("boom");
        });
        const after = vi.fn();
        register(boom);
        register(after);
        expect(() => runSessionTeardown()).not.toThrow();
        expect(boom).toHaveBeenCalledTimes(1);
        expect(after).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it("is safe to run twice", () => {
        const fn = vi.fn();
        register(fn);
        runSessionTeardown();
        runSessionTeardown();
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it("keeps a single entry when the same function is registered twice", () => {
        const fn = vi.fn();
        register(fn);
        register(fn);
        runSessionTeardown();
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
