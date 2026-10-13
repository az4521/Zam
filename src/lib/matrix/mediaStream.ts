import { matrixClient } from "./runtime";
import { isSameOrigin } from "$lib/utils/mxcUri";
import {
    createStreamDecryptor,
    type EncryptedFileInfo,
} from "$lib/utils/decryptAttachment";
import {
    expectedBodySize,
    type DownloadProgress,
} from "$lib/utils/downloadProgress";

/**
 * An authenticated, optionally decrypting, progress-reporting reader over a
 * homeserver media download. The shared first half of every "use the bytes as
 * they arrive" feature: video and audio fed to a MediaSource
 * (videoStream.ts) and progressive image previews (progressiveImage.ts).
 */

/** What the pipelines need from a body reader: a ReadableStream's, or ours. */
export interface ChunkReader {
    read(): Promise<ReadableStreamReadResult<Uint8Array>>;
}

export interface OpenReaderOptions {
    /** `content.file` of an encrypted attachment: chunks come out decrypted. */
    decrypt?: EncryptedFileInfo;
    /** Size from the event, for progress when the server sends no length. */
    expectedSize?: number | null;
    /** Bytes downloaded so far. */
    onProgress?: (p: DownloadProgress) => void;
    signal?: AbortSignal;
}

// Chunks arrive faster than anyone can read a counter; cap UI updates.
const PROGRESS_INTERVAL_MS = 100;

export function authHeaders(httpUrl: string): Record<string, string> {
    if (!matrixClient) throw new Error("Not logged in");
    // Same guard as fetchAttachmentBlob: the token never leaves the homeserver.
    if (!isSameOrigin(httpUrl, matrixClient.getHomeserverUrl())) {
        throw new Error("Refusing to fetch a non-homeserver URL with auth");
    }
    const token = matrixClient.getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Fetch `httpUrl` with the access token and return its body as a chunk reader
 * that reports progress and, for an encrypted attachment, yields plaintext.
 *
 * ⚠ For a decrypting reader the final read() runs the integrity check and
 * REJECTS on a mismatch. Plaintext handed out before that final read is
 * UNVERIFIED: a caller that shows or plays it early must treat a rejection as
 * "all of that was tampered with" and tear it down, and must not keep the
 * bytes (a blob URL, a download) until the last read has succeeded.
 */
export async function openAuthedReader(
    httpUrl: string,
    opts: OpenReaderOptions = {},
): Promise<ChunkReader> {
    const resp = await fetch(httpUrl, {
        headers: authHeaders(httpUrl),
        signal: opts.signal,
    });
    if (!resp.ok) throw new Error(`Media fetch failed: ${resp.status}`);

    const total = expectedBodySize(resp, opts.expectedSize);
    let raw: ChunkReader;
    const streamReader = resp.body?.getReader();
    if (streamReader) {
        raw = streamReader;
    } else {
        // No streaming body: one chunk, once.
        let sent = false;
        const all = new Uint8Array(await resp.arrayBuffer());
        raw = {
            read: async () =>
                sent
                    ? { done: true, value: undefined }
                    : ((sent = true), { done: false, value: all }),
        };
    }
    const decryptor = opts.decrypt
        ? await createStreamDecryptor(opts.decrypt)
        : null;
    let loaded = 0;
    let lastReport = 0;
    let finished = false;
    const report = (force = false) => {
        const now = Date.now();
        if (!force && now - lastReport < PROGRESS_INTERVAL_MS) return;
        lastReport = now;
        opts.onProgress?.({
            loaded,
            total: total !== null && loaded <= total ? total : null,
        });
    };
    report(true);
    return {
        async read() {
            for (;;) {
                const r = await raw.read();
                if (r.done) {
                    report(true);
                    if (decryptor && !finished) {
                        finished = true;
                        const tail = await decryptor.finish();
                        if (tail.length) return { done: false, value: tail };
                    }
                    return { done: true, value: undefined };
                }
                loaded += r.value.length;
                report();
                if (!decryptor) return r;
                const out = await decryptor.push(r.value);
                if (out.length) return { done: false, value: out };
            }
        },
    };
}
