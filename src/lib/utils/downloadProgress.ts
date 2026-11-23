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
 *
 * The same expected size is also a guard. A response that delivers far more
 * bytes than the event declared is aborted, and every buffering read has an
 * absolute ceiling, so a hostile or broken server cannot exhaust memory.
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
    /**
     * Absolute ceiling for the bytes this read may buffer. Defaults to
     * {@link MAX_BUFFERED_BYTES}; a caller may lower it, never raise it.
     */
    maxBytes?: number;
}

/**
 * The most a buffering read will hold in memory (1 GiB). Legitimate files
 * larger than this should be streamed instead of buffered.
 */
export const MAX_BUFFERED_BYTES = 1024 * 1024 * 1024;

/** Slack allowed past an expected size: the larger of 1 MiB or 5%. */
const OVERRUN_SLACK_MIN_BYTES = 1024 * 1024;
const OVERRUN_SLACK_RATIO = 0.05;

// Chunks arrive far faster than anyone can read a counter; cap UI updates.
const MIN_REPORT_INTERVAL_MS = 100;

/** Thrown when a body is larger than its declared size or the buffer ceiling
 *  allows. The read is cancelled before the excess is buffered. */
export class DownloadSizeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DownloadSizeError";
    }
}

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

/** The most bytes a body declared as `expected` may deliver before it is
 *  treated as hostile: the declared size plus 5%, but at least 1 MiB. */
export function overrunLimit(expected: number): number {
    return (
        expected +
        Math.max(
            OVERRUN_SLACK_MIN_BYTES,
            Math.floor(expected * OVERRUN_SLACK_RATIO),
        )
    );
}

/** The hard byte limit for one read, given the expected size (if any). */
function hardLimitFor(expected: number | null, maxBytes: number): number {
    const cap = positiveInt(maxBytes) ?? MAX_BUFFERED_BYTES;
    return expected === null ? cap : Math.min(cap, overrunLimit(expected));
}

function checkDeclared(expected: number | null, maxBytes: number): void {
    const cap = positiveInt(maxBytes) ?? MAX_BUFFERED_BYTES;
    if (expected !== null && expected > cap) {
        throw new DownloadSizeError(
            `Download is ${expected} bytes, over the ${cap} byte limit`,
        );
    }
}

function overrunError(loaded: number, limit: number): DownloadSizeError {
    return new DownloadSizeError(
        `Download delivered more than ${limit} bytes (received ${loaded})`,
    );
}

/**
 * Pump a streaming body to the end, handing each chunk to `onChunk` and
 * reporting progress. Throws, after cancelling the reader, as soon as the
 * body grows past its limit or the signal aborts.
 */
async function pumpBody(
    resp: Response,
    opts: ReadProgressOptions,
    onChunk: (chunk: Uint8Array) => void,
): Promise<number> {
    const { onProgress, signal } = opts;
    const maxBytes = opts.maxBytes ?? MAX_BUFFERED_BYTES;
    let total = expectedBodySize(resp, opts.expectedSize);
    checkDeclared(total, maxBytes);
    const limit = hardLimitFor(total, maxBytes);
    const reader = resp.body?.getReader();
    if (!reader) {
        // No streaming body (very old engine): all or nothing.
        const buf = new Uint8Array(await resp.arrayBuffer());
        if (buf.length > limit) throw overrunError(buf.length, limit);
        onProgress?.({ loaded: buf.length, total: buf.length });
        onChunk(buf);
        return buf.length;
    }
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
        loaded += value.length;
        if (loaded > limit) {
            void reader.cancel().catch(() => {});
            throw overrunError(loaded, limit);
        }
        onChunk(value);
        // An estimate that turned out low is worse than none.
        if (total !== null && loaded > total) total = null;
        const now = Date.now();
        if (onProgress && now - lastReport >= MIN_REPORT_INTERVAL_MS) {
            lastReport = now;
            onProgress({ loaded, total });
        }
    }
    onProgress?.({ loaded, total: total ?? loaded });
    return loaded;
}

/**
 * Read a response body to the end, reporting progress. Returns the chunks
 * (callers decide whether they want a Blob or one contiguous buffer; prefer
 * {@link readBodyBytes} when one buffer is what is wanted).
 */
export async function readBodyWithProgress(
    resp: Response,
    opts: ReadProgressOptions = {},
): Promise<Uint8Array[]> {
    const chunks: Uint8Array[] = [];
    await pumpBody(resp, opts, (c) => chunks.push(c));
    return chunks;
}

/**
 * Read a response body into one contiguous buffer. When the size is known
 * up front (Content-Length or the event's size) the buffer is allocated once
 * at that size and chunks are written straight into it, so there is no
 * chunk list and no concatenating copy. Otherwise it grows geometrically.
 * The returned buffer is exactly as long as the body.
 */
export async function readBodyBytes(
    resp: Response,
    opts: ReadProgressOptions = {},
): Promise<Uint8Array<ArrayBuffer>> {
    const maxBytes = opts.maxBytes ?? MAX_BUFFERED_BYTES;
    const expected = expectedBodySize(resp, opts.expectedSize);
    checkDeclared(expected, maxBytes);
    const limit = hardLimitFor(expected, maxBytes);
    let out = new Uint8Array(Math.min(expected ?? 0, limit));
    let at = 0;
    const loaded = await pumpBody(resp, opts, (chunk) => {
        if (at + chunk.length > out.length) {
            const want = Math.max(at + chunk.length, out.length * 2, 64 * 1024);
            const grown = new Uint8Array(Math.min(want, limit));
            grown.set(out.subarray(0, at), 0);
            out = grown;
        }
        out.set(chunk, at);
        at += chunk.length;
    });
    return loaded === out.length ? out : out.slice(0, loaded);
}
