import { matrixClient } from "./runtime";
import { isSameOrigin } from "$lib/utils/mxcUri";
import { safeAttachmentMimeType } from "$lib/utils/attachmentMime";
import type { ISOFile, Movie } from "mp4box";

/**
 * Authenticated media (`/_matrix/client/v1/media/download/...`) needs an
 * `Authorization` header a `<video src>` can't send. Normally the service
 * worker injects it, but a page with no controlling worker gets a 401: Tor
 * Browser disables service workers outright, and a hard reload loads the page
 * uncontrolled.
 *
 * Buffering the whole file into a blob works but can't start until the last
 * byte lands, and the homeserver honours neither `Range` nor sends a
 * `Content-Length` (verified against tuwunel behind nginx: a ranged request
 * gets a plain 200 of the full file), so there's no shortcut there either.
 *
 * Instead, fetch with the token and feed the bytes into a MediaSource as they
 * arrive. MP4 (what nearly every phone and screen recorder produces) is
 * remuxed into fragments on the fly by mp4box.js, loaded on demand. A
 * faststart file (moov first) plays within the first chunks; one with moov
 * at the end can't be remuxed until it is fully downloaded, so it degrades to
 * blob timing. Anything else (WebM, no MediaSource at all) goes the blob way.
 * Seeking only reaches what has already downloaded: without ranges there is
 * no way to fetch ahead.
 */

/** True when this page has no service worker to authenticate `<video src>`. */
export function videoNeedsAuthedStream(): boolean {
    return (
        typeof navigator === "undefined" || !navigator.serviceWorker?.controller
    );
}

export interface AuthedVideoStreamOptions {
    /** Event mimetype, used only to label a blob fallback. */
    mimetype?: string | null;
    /** Called once if the media can't be fetched or fed to the element. */
    onError?: (err: unknown) => void;
}

export interface AuthedVideoStream {
    /** Stop downloading and release the element's source. Idempotent. */
    dispose(): void;
}

// Samples per generated fragment. Small enough that playback starts on the
// first couple of seconds of video, large enough not to drown MSE in appends.
const SAMPLES_PER_SEGMENT = 60;
// On QuotaExceeded, keep this many seconds behind the playhead and drop the rest.
const KEEP_BEHIND_SECONDS = 10;

function authHeaders(httpUrl: string): Record<string, string> {
    if (!matrixClient) throw new Error("Not logged in");
    // Same guard as fetchAttachmentBlob: the token never leaves the homeserver.
    if (!isSameOrigin(httpUrl, matrixClient.getHomeserverUrl())) {
        throw new Error("Refusing to fetch a non-homeserver URL with auth");
    }
    const token = matrixClient.getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

function isMp4(head: Uint8Array): boolean {
    // ISO BMFF opens with a box whose type sits at bytes 4..8: `ftyp` for any
    // normal file, `styp`/`moov` for oddly muxed ones mp4box still handles.
    if (head.length < 8) return false;
    const type = String.fromCharCode(head[4], head[5], head[6], head[7]);
    return type === "ftyp" || type === "styp" || type === "moov";
}

/** Copy a reader chunk into its own exactly-sized ArrayBuffer. */
function ownBuffer(chunk: Uint8Array): ArrayBuffer {
    return chunk.slice().buffer as ArrayBuffer;
}

interface QueuedAppend {
    buffer: ArrayBuffer;
    after?: () => void;
}

/**
 * Serialises appends into one SourceBuffer (it rejects a second append while
 * `updating`) and rides out QuotaExceeded by trimming what's already played.
 */
class AppendQueue {
    private queue: QueuedAppend[] = [];
    private waiters: Array<() => void> = [];
    private retryTimer: ReturnType<typeof setTimeout> | null = null;
    private current: QueuedAppend | null = null;

    constructor(
        private sb: SourceBuffer,
        private video: HTMLVideoElement,
        private fail: (err: unknown) => void,
    ) {
        sb.addEventListener("updateend", () => {
            const done = this.current;
            this.current = null;
            done?.after?.();
            this.pump();
        });
    }

    push(item: QueuedAppend) {
        this.queue.push(item);
        this.pump();
    }

    get idle(): boolean {
        return !this.current && !this.sb.updating && this.queue.length === 0;
    }

    /** Resolves once everything queued so far has been appended. */
    drained(): Promise<void> {
        if (this.idle) return Promise.resolve();
        return new Promise((resolve) => this.waiters.push(resolve));
    }

    dispose() {
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.queue = [];
        this.waiters = [];
    }

    private pump() {
        if (this.sb.updating || this.current || this.retryTimer) return;
        const next = this.queue[0];
        if (!next) {
            const waiters = this.waiters;
            this.waiters = [];
            for (const w of waiters) w();
            return;
        }
        try {
            this.sb.appendBuffer(next.buffer);
            this.queue.shift();
            this.current = next;
        } catch (err) {
            if ((err as DOMException)?.name !== "QuotaExceededError") {
                this.fail(err);
                return;
            }
            this.evictOrWait();
        }
    }

    private evictOrWait() {
        const cutoff = this.video.currentTime - KEEP_BEHIND_SECONDS;
        const buffered = this.sb.buffered;
        if (buffered.length && buffered.start(0) < cutoff) {
            // `updateend` from the removal re-runs pump with the same head item.
            this.sb.remove(buffered.start(0), cutoff);
            return;
        }
        // Everything buffered is still ahead of the playhead (e.g. paused on a
        // long clip): hold the rest in memory until playback frees some room.
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            this.pump();
        }, 1000);
    }
}

/**
 * Point `video` at an authenticated homeserver video, streaming it where the
 * container allows. The caller must not also set `video.src`.
 */
export function attachAuthedVideo(
    video: HTMLVideoElement,
    httpUrl: string,
    opts: AuthedVideoStreamOptions = {},
): AuthedVideoStream {
    const abort = new AbortController();
    const objectUrls: string[] = [];
    let mp4: ISOFile<AppendQueue, unknown> | null = null;
    const queues: AppendQueue[] = [];
    let disposed = false;
    let failed = false;

    function fail(err: unknown) {
        if (disposed || failed) return;
        failed = true;
        abort.abort();
        console.warn("Authed video stream failed", err);
        opts.onError?.(err);
    }

    function setSrc(url: string) {
        objectUrls.push(url);
        video.src = url;
    }

    async function readAll(
        reader: ReadableStreamDefaultReader<Uint8Array>,
        parts: BlobPart[],
    ) {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) return;
            parts.push(ownBuffer(value));
        }
    }

    async function playAsBlob(
        reader: ReadableStreamDefaultReader<Uint8Array> | null,
        parts: BlobPart[],
    ) {
        if (reader) await readAll(reader, parts);
        if (disposed) return;
        setSrc(
            URL.createObjectURL(
                new Blob(parts, {
                    type: safeAttachmentMimeType(opts.mimetype ?? undefined),
                }),
            ),
        );
    }

    async function run() {
        const resp = await fetch(httpUrl, {
            headers: authHeaders(httpUrl),
            signal: abort.signal,
        });
        if (!resp.ok) throw new Error(`Video fetch failed: ${resp.status}`);

        const reader = resp.body?.getReader() ?? null;
        if (!reader || typeof MediaSource === "undefined") {
            const parts: BlobPart[] = [];
            if (!reader) parts.push(await resp.blob());
            return playAsBlob(reader, parts);
        }

        // Everything read so far, kept until we commit to MSE so a fallback
        // to a blob loses nothing.
        const held: ArrayBuffer[] = [];
        let first = await reader.read();
        if (first.done) return playAsBlob(null, held);
        held.push(ownBuffer(first.value));
        if (!isMp4(first.value)) return playAsBlob(reader, held);

        const { createFile, MP4BoxBuffer } = await import("mp4box");
        // keepMdatData: v2 discards sample bytes by default, which silently
        // yields init segments and nothing else.
        const file = createFile(true) as ISOFile<AppendQueue, unknown>;
        mp4 = file;
        let info: Movie | null = null;
        let parseError: string | null = null;
        file.onReady = (i) => (info = i);
        file.onError = (_mod, msg) => (parseError = msg);

        let offset = 0;
        const feed = (buf: ArrayBuffer) => {
            file.appendBuffer(MP4BoxBuffer.fromArrayBuffer(buf, offset));
            offset += buf.byteLength;
        };
        feed(held[0]);

        // Read until the moov is parsed. For a faststart file that's the first
        // chunk or two; for moov-at-end it's the whole file.
        let ended = false;
        while (!info && !parseError) {
            const { done, value } = await reader.read();
            if (done) {
                ended = true;
                file.flush();
                break;
            }
            const buf = ownBuffer(value);
            held.push(buf);
            feed(buf);
        }
        if (disposed) return;

        const movie = info as Movie | null;
        const tracks =
            movie?.tracks.filter(
                (t) => t.type === "video" || t.type === "audio",
            ) ?? [];
        if (!movie || parseError || !tracks.some((t) => t.type === "video")) {
            // Not something mp4box can fragment: let the element try the bytes.
            file.stop();
            mp4 = null;
            return playAsBlob(ended ? null : reader, held);
        }
        const mimes = tracks.map((t) => `${t.type}/mp4; codecs="${t.codec}"`);
        if (!mimes.every((m) => MediaSource.isTypeSupported(m))) {
            // A codec the browser's MSE can't decode (e.g. HEVC on Firefox):
            // the element couldn't play the raw file either, so don't spend a
            // full download finding that out.
            throw new Error(`Unsupported video codecs: ${mimes.join(", ")}`);
        }
        held.length = 0;

        const ms = new MediaSource();
        const opened = new Promise<void>((resolve) =>
            ms.addEventListener("sourceopen", () => resolve(), { once: true }),
        );
        setSrc(URL.createObjectURL(ms));
        await opened;
        if (disposed) return;
        if (movie.duration > 0 && movie.timescale > 0) {
            ms.duration = movie.duration / movie.timescale;
        }

        tracks.forEach((track, i) => {
            const q = new AppendQueue(
                ms.addSourceBuffer(mimes[i]),
                video,
                fail,
            );
            queues.push(q);
            file.setSegmentOptions(track.id, q, {
                nbSamples: SAMPLES_PER_SEGMENT,
            });
        });
        file.onSegment = (id, q, buffer, nextSample) => {
            q.push({
                buffer,
                // Let mp4box drop the source samples once MSE has them, so a
                // long clip isn't held twice in memory.
                after: () => file.releaseUsedSamples(id, nextSample),
            });
        };
        for (const init of file.initializeSegmentation("per-track")) {
            init.user.push({ buffer: init.buffer });
        }
        file.start();

        if (!ended) {
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                feed(ownBuffer(value));
            }
            file.flush();
        }
        await Promise.all(queues.map((q) => q.drained()));
        if (!disposed && ms.readyState === "open") ms.endOfStream();
    }

    run().catch((err) => {
        if (!disposed) fail(err);
    });

    return {
        dispose() {
            if (disposed) return;
            disposed = true;
            abort.abort();
            mp4?.stop();
            for (const q of queues) q.dispose();
            // Detach before revoking so the element stops decoding.
            video.pause();
            video.removeAttribute("src");
            video.load();
            for (const url of objectUrls) URL.revokeObjectURL(url);
        },
    };
}
