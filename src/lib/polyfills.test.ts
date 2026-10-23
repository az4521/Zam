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

    it("adds a v4 crypto.randomUUID when the runtime lacks it", async () => {
        const original = crypto.randomUUID;
        Object.defineProperty(crypto, "randomUUID", {
            configurable: true,
            writable: true,
            value: undefined,
        });
        try {
            vi.resetModules();
            await import("./polyfills");
            const id = crypto.randomUUID();
            expect(id).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
            );
            expect(crypto.randomUUID()).not.toBe(id);
        } finally {
            Object.defineProperty(crypto, "randomUUID", {
                configurable: true,
                writable: true,
                value: original,
            });
        }
    });
});
