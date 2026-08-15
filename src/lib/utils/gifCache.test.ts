import { describe, it, expect } from "vitest";
import { gifCacheKey, canReuseGifResults, GIF_CACHE_TTL_MS } from "./gifCache";

describe("gifCacheKey", () => {
    it("combines kind and a normalized query", () => {
        expect(gifCacheKey("gifs", "")).toBe("gifs\n");
        expect(gifCacheKey("gifs", "Cat")).toBe("gifs\ncat");
    });

    it("trims and lowercases the query so equivalent searches share a key", () => {
        expect(gifCacheKey("gifs", "  Happy Dog  ")).toBe("gifs\nhappy dog");
        expect(gifCacheKey("memes", "LOL")).toBe("memes\nlol");
    });

    it("separates kinds and queries into distinct keys", () => {
        expect(gifCacheKey("gifs", "x")).not.toBe(gifCacheKey("memes", "x"));
        expect(gifCacheKey("gifs", "a")).not.toBe(gifCacheKey("gifs", "b"));
    });
});

describe("canReuseGifResults", () => {
    const base = {
        requestedKey: "gifs\n",
        cachedKey: "gifs\n",
        cachedAt: 1_000,
        now: 1_000,
        ttlMs: GIF_CACHE_TTL_MS,
        itemCount: 24,
    };

    it("reuses fresh results already displayed for the same key", () => {
        expect(canReuseGifResults(base)).toBe(true);
    });

    it("does NOT reuse when there is nothing displayed", () => {
        expect(canReuseGifResults({ ...base, itemCount: 0 })).toBe(false);
    });

    it("does NOT reuse across a different tab/query (key mismatch)", () => {
        expect(canReuseGifResults({ ...base, requestedKey: "gifs\ncat" })).toBe(
            false,
        );
    });

    it("does NOT reuse before any load has recorded a key", () => {
        expect(canReuseGifResults({ ...base, cachedKey: null })).toBe(false);
    });

    it("reuses right up to the TTL edge but not past it", () => {
        expect(
            canReuseGifResults({
                ...base,
                cachedAt: 1_000,
                now: 1_000 + GIF_CACHE_TTL_MS,
            }),
        ).toBe(true);
        expect(
            canReuseGifResults({
                ...base,
                cachedAt: 1_000,
                now: 1_000 + GIF_CACHE_TTL_MS + 1,
            }),
        ).toBe(false);
    });

    it("treats a backwards clock as fresh rather than refetching", () => {
        expect(canReuseGifResults({ ...base, now: 500 })).toBe(true);
    });
});
