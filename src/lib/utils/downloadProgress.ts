/**
 * Byte-level progress for a fetch body.
 *
 * `resp.blob()` / `resp.arrayBuffer()` give no feedback until the last byte
 * lands, which on a slow homeserver reads as a frozen spinner. Reading the
 * body stream ourselves lets the UI show how much has arrived.
 *
 * Matrix homeservers often send no `Content-Length` (tuwunel behind nginx
 * does not), so the total falls back to the event's own `info.size`: for an
 * encrypted attachment AES-CTR keeps the ciphertext exactly as long as the
 * plaintext, so that is the right number to count against.
 */

export interface DownloadProgress {
    /** Bytes received so far. */
    loaded: number;
    /** Expected size, or null when neither the server nor the event said. */
    total: number | null;
}

export interface ReadProgressOptions {
    onProgress?: (p: DownloadProgress) => void;
    /** Size from the event, used when the response has no Content-Length. */
    expectedSize?: number | null;
    signal?: AbortSignal;
}

// Chunks arrive far faster than anyone can read a counter; cap UI updates.
const MIN_REPORT_INTERVAL_MS = 100;

function positiveInt(n: unknown): number | null {
    return typeof n === "number" && Number.isFinite(n) && n > 0
        ? Math.floor(n)
        : null;
}

/** Expected body size: the response's Content-Length, else the event's. */
export function expectedBodySize(
    resp: Response,
    fallback?: number | null,
): number | null {
    const header = Number(resp.headers.get("content-length"));
    // A Content-Encoding means the header counts compressed bytes, which the
    // stream's decoded chunks will not add up to.
    const encoded = !!resp.headers.get("content-encoding");
    return (encoded ? null : positiveInt(header)) ?? positiveInt(fallback);
}

/**
 * Read a response body to the end, reporting progress. Returns the chunks
 * (callers decide whether they want a Blob or one contiguous buffer).
 */
export async function readBodyWithProgress(
    resp: Response,
    opts: ReadProgressOptions = {},
): Promise<Uint8Array[]> {
    const { onProgress, signal } = opts;
    let total = expectedBodySize(resp, opts.expectedSize);
    const reader = resp.body?.getReader();
    if (!reader) {
        // No streaming body (very old engine): all or nothing.
        const buf = new Uint8Array(await resp.arrayBuffer());
        onProgress?.({ loaded: buf.length, total: buf.length });
        return [buf];
    }
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    let lastReport = 0;
    onProgress?.({ loaded: 0, total });
    for (;;) {
        if (signal?.aborted) {
            void reader.cancel().catch(() => {});
            throw new DOMException("Aborted", "AbortError");
        }
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        // An estimate that turned out low is worse than none.
        if (total !== null && loaded > total) total = null;
        const now = Date.now();
        if (onProgress && now - lastReport >= MIN_REPORT_INTERVAL_MS) {
            lastReport = now;
            onProgress({ loaded, total });
        }
    }
    onProgress?.({ loaded, total: total ?? loaded });
    return chunks;
}
