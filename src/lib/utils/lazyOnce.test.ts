import { describe, expect, it, vi } from "vitest";
import { lazyOnce } from "./lazyOnce";

describe("lazyOnce", () => {
    it("runs the loader once and shares its promise", async () => {
        const load = vi.fn(async () => 42);
        const get = lazyOnce(load);
        const a = get();
        const b = get();
        expect(a).toBe(b);
        expect(await a).toBe(42);
        expect(load).toHaveBeenCalledTimes(1);
    });

    it("retries after a failed load", async () => {
        const load = vi
            .fn<() => Promise<string>>()
            .mockRejectedValueOnce(new Error("chunk gone"))
            .mockResolvedValueOnce("ok");
        const get = lazyOnce(load);
        await expect(get()).rejects.toThrow("chunk gone");
        expect(await get()).toBe("ok");
        expect(load).toHaveBeenCalledTimes(2);
    });
});
