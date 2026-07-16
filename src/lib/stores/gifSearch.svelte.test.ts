import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the KLIPY util: keep url builders as cheap passthroughs, control fetchKlipy.
const fetchKlipy = vi.fn();
vi.mock("$lib/utils/klipy", () => ({
    fetchKlipy: (url: string) => fetchKlipy(url),
    trendingUrl: (kind: string, page: number) => `trending:${kind}:${page}`,
    searchUrl: (kind: string, q: string, page: number) =>
        `search:${kind}:${q}:${page}`,
}));

import {
    gifSearchState,
    loadGifs,
    queueSearch,
    loadMore,
} from "./gifSearch.svelte";

function page(items: number, hasNext: boolean) {
    return {
        items: Array.from({ length: items }, (_, i) => ({
            id: String(i),
            url: `u${i}`,
            previewUrl: `p${i}`,
            width: 1,
            height: 1,
        })),
        hasNext,
    };
}

beforeEach(() => {
    vi.useFakeTimers();
    fetchKlipy.mockReset();
    gifSearchState.kind = "gifs";
    gifSearchState.query = "";
    gifSearchState.items = [];
    gifSearchState.page = 1;
    gifSearchState.loading = false;
    gifSearchState.error = null;
    gifSearchState.exhausted = false;
});

afterEach(() => {
    vi.useRealTimers();
});

describe("gifSearch store", () => {
    it("debounces queueSearch and loads only the latest query", async () => {
        fetchKlipy.mockResolvedValueOnce(page(3, true));
        queueSearch("gifs", "ca");
        queueSearch("gifs", "cat"); // supersedes before the debounce fires
        expect(fetchKlipy).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(350);
        expect(fetchKlipy).toHaveBeenCalledTimes(1);
        expect(fetchKlipy).toHaveBeenCalledWith("search:gifs:cat:1");
        expect(gifSearchState.items).toHaveLength(3);
        expect(gifSearchState.exhausted).toBe(false);
    });

    it("loadGifs with an empty query loads trending immediately", async () => {
        fetchKlipy.mockResolvedValueOnce(page(2, false));
        loadGifs("gifs", "");
        await vi.advanceTimersByTimeAsync(0);
        expect(fetchKlipy).toHaveBeenCalledWith("trending:gifs:1");
        expect(gifSearchState.exhausted).toBe(true);
    });

    it("loadGifs clears a pending debounce (no double fetch)", async () => {
        fetchKlipy.mockResolvedValue(page(1, true));
        queueSearch("gifs", "dog");
        loadGifs("memes", ""); // switching tab mid-debounce
        await vi.advanceTimersByTimeAsync(350);
        expect(fetchKlipy).toHaveBeenCalledTimes(1);
        expect(fetchKlipy).toHaveBeenCalledWith("trending:memes:1");
    });

    it("loadMore appends the next page and stops when exhausted", async () => {
        fetchKlipy.mockResolvedValueOnce(page(2, true));
        loadGifs("gifs", "");
        await vi.advanceTimersByTimeAsync(0);
        fetchKlipy.mockResolvedValueOnce(page(2, false));
        loadMore();
        await vi.advanceTimersByTimeAsync(0);
        expect(gifSearchState.items).toHaveLength(4);
        expect(gifSearchState.exhausted).toBe(true);
        loadMore(); // exhausted -> no-op
        expect(fetchKlipy).toHaveBeenCalledTimes(2);
    });

    it("sets an error message and clears items on failure", async () => {
        fetchKlipy.mockRejectedValueOnce(new Error("KLIPY 429"));
        loadGifs("gifs", "");
        await vi.advanceTimersByTimeAsync(0);
        expect(gifSearchState.error).toMatch(/KLIPY/);
        expect(gifSearchState.items).toEqual([]);
    });

    it("loadGifs records the kind so loadMore reuses it", async () => {
        fetchKlipy.mockResolvedValueOnce(page(1, true));
        loadGifs("memes", "");
        await vi.advanceTimersByTimeAsync(0);
        expect(gifSearchState.kind).toBe("memes");
        fetchKlipy.mockResolvedValueOnce(page(1, false));
        loadMore();
        await vi.advanceTimersByTimeAsync(0);
        expect(fetchKlipy).toHaveBeenLastCalledWith("trending:memes:2");
    });

    it("drops results from a superseded in-flight request", async () => {
        let resolveOld!: (v: unknown) => void;
        let resolveNew!: (v: unknown) => void;
        const pOld = new Promise((r) => (resolveOld = r));
        const pNew = new Promise((r) => (resolveNew = r));
        fetchKlipy.mockReturnValueOnce(pOld).mockReturnValueOnce(pNew);

        loadGifs("gifs", "old"); // seq 1, awaits pOld
        loadGifs("gifs", "new"); // seq 2, supersedes; awaits pNew

        resolveNew(page(2, false)); // newer resolves first
        await vi.advanceTimersByTimeAsync(0);
        expect(gifSearchState.items).toHaveLength(2);
        expect(gifSearchState.exhausted).toBe(true); // newer request's value

        resolveOld(page(5, true)); // older resolves late -> must be ignored
        await vi.advanceTimersByTimeAsync(0);
        expect(gifSearchState.items).toHaveLength(2); // unchanged by stale write
        expect(gifSearchState.exhausted).toBe(true); // not clobbered by stale write
    });
});
