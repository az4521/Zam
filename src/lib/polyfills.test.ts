import { describe, expect, it, vi } from "vitest";

describe("polyfills", () => {
    it("adds Promise.withResolvers when the runtime lacks it", async () => {
        const original = Promise.withResolvers;
        // @ts-expect-error simulating an old WebView
        delete Promise.withResolvers;
        try {
            vi.resetModules();
            await import("./polyfills");
            const { promise, resolve } = Promise.withResolvers<number>();
            resolve(7);
            await expect(promise).resolves.toBe(7);
            const failing = Promise.withResolvers<number>();
            failing.reject(new Error("no"));
            await expect(failing.promise).rejects.toThrow("no");
        } finally {
            Object.defineProperty(Promise, "withResolvers", {
                configurable: true,
                writable: true,
                value: original,
            });
        }
    });

    it("leaves a native Promise.withResolvers alone", async () => {
        const native = Promise.withResolvers;
        vi.resetModules();
        await import("./polyfills");
        expect(Promise.withResolvers).toBe(native);
    });
});
