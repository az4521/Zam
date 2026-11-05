import { describe, expect, it, vi } from "vitest";
import { BlobUrlCache } from "./blobUrlCache";

function setup(max: number, inUse?: (url: string) => boolean) {
    const revoked: string[] = [];
    const cache = new BlobUrlCache(max, inUse, (u) => revoked.push(u));
    const fill = (key: string) =>
        cache.get(key, () => Promise.resolve(`blob:${key}`));
    return { cache, revoked, fill };
}

describe("BlobUrlCache", () => {
    it("shares one entry per key", async () => {
        const { cache } = setup(5);
        const make = vi.fn(() => Promise.resolve("blob:a"));
        await cache.get("a", make);
        await cache.get("a", make);
        expect(make).toHaveBeenCalledTimes(1);
    });

    it("revokes the least recently used URL past its size", async () => {
        const { cache, revoked, fill } = setup(2);
        await fill("a");
        await fill("b");
        await fill("a"); // a is now the most recent
        await fill("c");
        expect(revoked).toEqual(["blob:b"]);
        expect(cache.size).toBe(2);
    });

    it("never revokes a held URL, and catches up on release", async () => {
        const { revoked, fill, cache } = setup(1);
        const release = cache.hold(await fill("a"));
        await fill("b");
        expect(revoked).toEqual([]);
        expect(cache.size).toBe(2);
        await fill("c"); // b goes, a is held
        expect(revoked).toEqual(["blob:b"]);
        release();
        expect(revoked).toEqual(["blob:b", "blob:a"]);
    });

    it("counts holds", async () => {
        const { revoked, fill, cache } = setup(0);
        const url = await fill("a");
        const r1 = cache.hold(url);
        const r2 = cache.hold(url);
        r1();
        r1(); // a second call is a no-op
        await fill("b");
        expect(revoked).not.toContain("blob:a");
        r2();
        expect(revoked).toContain("blob:a");
    });

    it("leaves URLs the page still shows", async () => {
        const shown = new Set(["blob:a"]);
        const { revoked, fill } = setup(1, (u) => shown.has(u));
        await fill("a");
        await fill("b");
        await fill("c");
        expect(revoked).toEqual(["blob:b"]);
    });

    it("keeps null results and retries rejections", async () => {
        const { cache } = setup(5);
        const nothing = vi.fn(() => Promise.resolve(null));
        await cache.get("a", nothing);
        await cache.get("a", nothing);
        expect(nothing).toHaveBeenCalledTimes(1);
        const failing = vi.fn(() => Promise.reject(new Error("offline")));
        await expect(cache.get("b", failing)).rejects.toThrow();
        await expect(cache.get("b", failing)).rejects.toThrow();
        expect(failing).toHaveBeenCalledTimes(2);
    });

    it("does not revoke the URL it just handed out", async () => {
        const { cache, revoked, fill } = setup(1);
        cache.hold(await fill("a"));
        const b = await fill("b");
        expect(revoked).not.toContain(b);
    });
});
