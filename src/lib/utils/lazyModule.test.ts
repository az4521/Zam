import { describe, it, expect, vi } from "vitest";
import { lazyModule } from "./lazyModule";

describe("lazyModule", () => {
    it("peeks null before the first load and the value after", async () => {
        const mod = lazyModule(async () => ({ v: 1 }));
        expect(mod.peek()).toBeNull();
        await mod.load();
        expect(mod.peek()).toEqual({ v: 1 });
    });

    it("calls the loader once for concurrent loads", async () => {
        const loader = vi.fn(async () => ({ v: 1 }));
        const mod = lazyModule(loader);
        const [a, b] = await Promise.all([mod.load(), mod.load()]);
        expect(loader).toHaveBeenCalledTimes(1);
        expect(a).toBe(b);
    });

    it("calls the loader once across sequential loads", async () => {
        const loader = vi.fn(async () => ({ v: 1 }));
        const mod = lazyModule(loader);
        await mod.load();
        await mod.load();
        expect(loader).toHaveBeenCalledTimes(1);
    });

    it("retries after a failure instead of caching the rejection", async () => {
        const loader = vi
            .fn<() => Promise<{ v: number }>>()
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValueOnce({ v: 2 });
        const mod = lazyModule(loader);
        await expect(mod.load()).rejects.toThrow("offline");
        expect(mod.peek()).toBeNull();
        await expect(mod.load()).resolves.toEqual({ v: 2 });
        expect(loader).toHaveBeenCalledTimes(2);
    });

    it("caches a falsy resolved module instead of reloading it", async () => {
        // The cache must key on "have I loaded yet", not on the module's
        // truthiness: a module whose namespace resolves to a falsy value
        // (0, "", false) would otherwise re-invoke the loader on every call
        // and re-download nothing forever.
        const loader = vi.fn(async () => 0);
        const mod = lazyModule(loader);
        expect(await mod.load()).toBe(0);
        expect(await mod.load()).toBe(0);
        expect(loader).toHaveBeenCalledTimes(1);
        expect(mod.peek()).toBe(0);
    });

    it("keeps peek() null while a load is still in flight", async () => {
        let release: (value: { v: number }) => void = () => {};
        const mod = lazyModule(
            () => new Promise<{ v: number }>((r) => (release = r)),
        );
        const pending = mod.load();
        expect(mod.peek()).toBeNull();
        release({ v: 3 });
        await pending;
        expect(mod.peek()).toEqual({ v: 3 });
    });
});
