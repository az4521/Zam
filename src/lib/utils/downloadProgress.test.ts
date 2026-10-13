import { describe, it, expect, vi } from "vitest";
import {
    expectedBodySize,
    readBodyWithProgress,
    type DownloadProgress,
} from "./downloadProgress";

function streamOf(...chunks: number[][]): ReadableStream<Uint8Array> {
    return new ReadableStream({
        start(controller) {
            for (const c of chunks) controller.enqueue(new Uint8Array(c));
            controller.close();
        },
    });
}

describe("expectedBodySize", () => {
    it("prefers Content-Length", () => {
        const resp = new Response("x", { headers: { "content-length": "10" } });
        expect(expectedBodySize(resp, 99)).toBe(10);
    });

    it("falls back to the event's size when the server sends none", () => {
        expect(expectedBodySize(new Response("x"), 42)).toBe(42);
    });

    it("is null when nothing is known, or the size is nonsense", () => {
        expect(expectedBodySize(new Response("x"))).toBeNull();
        expect(expectedBodySize(new Response("x"), 0)).toBeNull();
        expect(expectedBodySize(new Response("x"), -5)).toBeNull();
        expect(expectedBodySize(new Response("x"), NaN)).toBeNull();
    });

    it("ignores Content-Length on a compressed response", () => {
        const resp = new Response("x", {
            headers: { "content-length": "10", "content-encoding": "gzip" },
        });
        expect(expectedBodySize(resp, 50)).toBe(50);
    });
});

describe("readBodyWithProgress", () => {
    it("returns every chunk, in order", async () => {
        const resp = new Response(streamOf([1, 2], [3], [4, 5, 6]));
        const chunks = await readBodyWithProgress(resp);
        expect(chunks.flatMap((c) => [...c])).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it("reports a start, and a final report with the full count", async () => {
        const seen: DownloadProgress[] = [];
        const resp = new Response(streamOf([1, 2], [3, 4]));
        await readBodyWithProgress(resp, {
            expectedSize: 4,
            onProgress: (p) => seen.push(p),
        });
        expect(seen[0]).toEqual({ loaded: 0, total: 4 });
        expect(seen.at(-1)).toEqual({ loaded: 4, total: 4 });
    });

    it("never reports a total smaller than what has arrived", async () => {
        const seen: DownloadProgress[] = [];
        const resp = new Response(streamOf([1, 2, 3, 4]));
        await readBodyWithProgress(resp, {
            expectedSize: 2, // an estimate that turned out low
            onProgress: (p) => seen.push(p),
        });
        for (const p of seen) {
            if (p.total !== null)
                expect(p.total).toBeGreaterThanOrEqual(p.loaded);
        }
        expect(seen.at(-1)).toEqual({ loaded: 4, total: 4 });
    });

    it("reports an unknown total as null while downloading", async () => {
        const seen: DownloadProgress[] = [];
        await readBodyWithProgress(new Response(streamOf([1], [2])), {
            onProgress: (p) => seen.push(p),
        });
        expect(seen[0]).toEqual({ loaded: 0, total: null });
    });

    it("throttles reports instead of firing once per chunk", async () => {
        vi.useFakeTimers();
        try {
            const onProgress = vi.fn();
            const chunks = Array.from({ length: 50 }, () => [1]);
            await readBodyWithProgress(new Response(streamOf(...chunks)), {
                onProgress,
            });
            // initial + (at most one throttled) + final, not 52
            expect(onProgress.mock.calls.length).toBeLessThanOrEqual(4);
        } finally {
            vi.useRealTimers();
        }
    });

    it("stops reading when aborted", async () => {
        const abort = new AbortController();
        abort.abort();
        await expect(
            readBodyWithProgress(new Response(streamOf([1, 2, 3])), {
                signal: abort.signal,
            }),
        ).rejects.toMatchObject({ name: "AbortError" });
    });
});
