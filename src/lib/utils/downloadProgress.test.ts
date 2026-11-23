import { describe, it, expect, vi } from "vitest";
import {
    DownloadSizeError,
    MAX_BUFFERED_BYTES,
    expectedBodySize,
    overrunLimit,
    readBodyBytes,
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

/** A stream that pulls `count` chunks of `size` bytes on demand, recording
 *  how many were pulled and whether the consumer cancelled it. */
function pulledStream(size: number, count: number) {
    const state = { pulled: 0, cancelled: false };
    const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
            if (state.pulled >= count) {
                controller.close();
                return;
            }
            state.pulled++;
            controller.enqueue(new Uint8Array(size).fill(state.pulled & 0xff));
        },
        cancel() {
            state.cancelled = true;
        },
    });
    return { stream, state };
}

const MiB = 1024 * 1024;

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

    it("aborts and cancels the reader when the body overruns its declared size", async () => {
        // Declares 10 bytes, then streams 4 MiB of 1 MiB chunks.
        const { stream, state } = pulledStream(MiB, 4);
        await expect(
            readBodyWithProgress(new Response(stream), { expectedSize: 10 }),
        ).rejects.toBeInstanceOf(DownloadSizeError);
        expect(state.cancelled).toBe(true);
        // It stopped at the first chunk past the limit, not at the end.
        expect(state.pulled).toBeLessThan(4);
    });

    it("tolerates a body a little past its declared size", async () => {
        // 1 MiB + 1 byte over a declared 10 bytes: within the 1 MiB slack.
        const { stream } = pulledStream(MiB + 1, 1);
        const chunks = await readBodyWithProgress(new Response(stream), {
            expectedSize: 10,
        });
        expect(chunks.reduce((n, c) => n + c.length, 0)).toBe(MiB + 1);
    });

    it("enforces an absolute ceiling when no size is known", async () => {
        await expect(
            readBodyWithProgress(new Response(streamOf([1, 2, 3, 4, 5])), {
                maxBytes: 4,
            }),
        ).rejects.toBeInstanceOf(DownloadSizeError);
    });

    it("refuses a declared size over the ceiling before reading the body", async () => {
        const { stream, state } = pulledStream(1024, 8);
        await expect(
            readBodyWithProgress(new Response(stream), {
                expectedSize: 4096,
                maxBytes: 1024,
            }),
        ).rejects.toBeInstanceOf(DownloadSizeError);
        // The stream may prefill one chunk on construction, but the read
        // never starts, so it is not drained.
        expect(state.pulled).toBeLessThanOrEqual(1);
        expect(state.pulled).toBeLessThan(8);
    });

    it("uses 1 GiB as the default ceiling", () => {
        expect(MAX_BUFFERED_BYTES).toBe(1024 * MiB);
    });
});

describe("overrunLimit", () => {
    it("allows the larger of 1 MiB or 5% past the expected size", () => {
        expect(overrunLimit(100)).toBe(100 + MiB);
        expect(overrunLimit(100 * MiB)).toBe(100 * MiB + 5 * MiB);
    });
});

describe("readBodyBytes", () => {
    it("returns one buffer holding the whole body, in order", async () => {
        const bytes = await readBodyBytes(
            new Response(streamOf([1, 2], [3], [4, 5, 6])),
        );
        expect([...bytes]).toEqual([1, 2, 3, 4, 5, 6]);
        expect(bytes.buffer.byteLength).toBe(bytes.length);
    });

    it("fills a buffer preallocated from the declared size", async () => {
        const bytes = await readBodyBytes(
            new Response(streamOf([1, 2], [3, 4]), {
                headers: { "content-length": "4" },
            }),
        );
        expect([...bytes]).toEqual([1, 2, 3, 4]);
        expect(bytes.buffer.byteLength).toBe(4);
    });

    it("trims the buffer when the body is shorter than declared", async () => {
        const bytes = await readBodyBytes(
            new Response(streamOf([1, 2, 3]), { headers: {} }),
            { expectedSize: 10 },
        );
        expect([...bytes]).toEqual([1, 2, 3]);
        expect(bytes.buffer.byteLength).toBe(3);
    });

    it("grows past an undeclared size without losing bytes", async () => {
        const big = Array.from({ length: 200 * 1024 }, (_, i) => i & 0xff);
        const bytes = await readBodyBytes(new Response(streamOf(big)));
        expect(bytes.length).toBe(big.length);
        expect(bytes[12345]).toBe(big[12345]);
        expect(bytes[big.length - 1]).toBe(big[big.length - 1]);
    });

    it("rejects a body past its declared size and cancels the reader", async () => {
        const { stream, state } = pulledStream(MiB, 4);
        await expect(
            readBodyBytes(new Response(stream), { expectedSize: 10 }),
        ).rejects.toBeInstanceOf(DownloadSizeError);
        expect(state.cancelled).toBe(true);
    });

    it("rejects a body past the ceiling", async () => {
        await expect(
            readBodyBytes(new Response(streamOf([1, 2, 3, 4, 5])), {
                maxBytes: 4,
            }),
        ).rejects.toBeInstanceOf(DownloadSizeError);
    });
});
