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

    it("adds signal.reason and throwIfAborted when the runtime lacks them", async () => {
        const proto = AbortSignal.prototype;
        const reason = Object.getOwnPropertyDescriptor(proto, "reason")!;
        const throwIf = Object.getOwnPropertyDescriptor(
            proto,
            "throwIfAborted",
        )!;
        const abort = Object.getOwnPropertyDescriptor(
            AbortController.prototype,
            "abort",
        )!;
        delete (proto as { reason?: unknown }).reason;
        delete (proto as { throwIfAborted?: unknown }).throwIfAborted;
        try {
            vi.resetModules();
            await import("./polyfills");
            const controller = new AbortController();
            expect(() => controller.signal.throwIfAborted()).not.toThrow();
            const why = new Error("stop");
            controller.abort(why);
            expect(controller.signal.reason).toBe(why);
            expect(() => controller.signal.throwIfAborted()).toThrow("stop");

            const bare = new AbortController();
            bare.abort();
            expect((bare.signal.reason as DOMException).name).toBe(
                "AbortError",
            );
        } finally {
            Object.defineProperty(proto, "reason", reason);
            Object.defineProperty(proto, "throwIfAborted", throwIf);
            Object.defineProperty(AbortController.prototype, "abort", abort);
        }
    });
});
