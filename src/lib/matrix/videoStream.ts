import { safeAttachmentMimeType } from "$lib/utils/attachmentMime";
import type { EncryptedFileInfo } from "$lib/utils/decryptAttachment";
import { isWebm, probeWebm } from "$lib/utils/webmProbe";
import { id3Size, isFlac } from "$lib/utils/flacProbe";
import { WebmInterleaver } from "$lib/utils/webmInterleave";
import type { DownloadProgress } from "$lib/utils/downloadProgress";
import { openAuthedReader, type ChunkReader } from "./mediaStream";
import type { ISOFile, Movie } from "mp4box";
import {
    FragmentLog,
    initTimescale,
    Mp3Index,
    WebmIndex,
    type Refill,
} from "$lib/utils/seekIndex";

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
 * blob timing. WebM needs no remuxing: once its Tracks header yields a codec
 * list (webmProbe.ts) the bytes are appended to the SourceBuffer as they come.
 * (one with several tracks a Cluster at a time, its blocks put in timestamp
 * order for Chromium: webmInterleave.ts).
 * A Matroska with codecs a WebM SourceBuffer refuses (the usual H.264/AAC
 * MKV) is remuxed to fragmented MP4 as it arrives instead (mkvRemux.ts).
 * Anything else (another container, an unknown codec, no MediaSource at all)
 * goes the blob way. Seeking only reaches what has already downloaded: without
 * ranges there is no way to fetch ahead.
 *
 * Encrypted attachments take the same route with a decrypt step on the byte
 * stream (`opts.decrypt`). AES-CTR decrypts chunk by chunk, but the SHA-256
 * that proves the ciphertext is untampered covers the whole file, so it can
 * only be checked once the last byte is in. The trade this makes explicit:
 *   - Anything that needs the finished file (a non-faststart MP4, a non-MP4,
 *     no MediaSource) is verified BEFORE it is handed to the element.
 *   - A faststart MP4 starts playing on unverified bytes, and if the hash then
 *     fails the stream is torn down and `onError` fires with the integrity
 *     error. Callers should therefore only opt in for files large enough to
 *     be worth it (see MessageVideo's STREAM_ENCRYPTED_MIN_BYTES).
 */

/**
 * Encrypted videos smaller than this are downloaded, verified and only then
 * played, exactly as before. Streaming plays unverified bytes until the hash
 * check at the end (see the file header), which is only worth risking when the
 * wait for the whole file would be long.
 */
export const STREAM_ENCRYPTED_MIN_BYTES = 4 * 1024 * 1024;

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
    /** `content.file` of an encrypted attachment: the download is decrypted on
     *  the fly and verified at the end (see the file header). */
    decrypt?: EncryptedFileInfo;
    /** Size from the event, for progress when the server sends no length. */
    expectedSize?: number | null;
    /** Bytes downloaded so far, for a progress indicator. */
    onProgress?: (p: DownloadProgress) => void;
    /** Skip MediaSource entirely: download (and verify) the whole file, then
     *  play it as a blob. What a failed stream falls back to. */
    forceBlob?: boolean;
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

/** An MP3 stream: an ID3v2 tag, or an MPEG audio frame header (11 sync bits
 *  and a layer that is not the reserved 00). */
export function isMp3(head: Uint8Array): boolean {
    if (head.length < 3) return false;
    if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) return true;
    return (
        head[0] === 0xff && (head[1] & 0xe0) === 0xe0 && (head[1] & 0x06) !== 0
    );
}

/** A FLAC stream: the "fLaC" marker, possibly behind an ID3v2 tag. A tag too
 *  big to see past in the first chunk (cover art) is taken on the event's
 *  mimetype, since an MP3 can open with one too. */
function looksLikeFlac(head: Uint8Array, mimetype?: string | null): boolean {
    if (isFlac(head)) return true;
    const tag = id3Size(head);
    if (tag === 0) return false;
    if (head.length >= tag + 4) return isFlac(head.subarray(tag));
    return /flac/i.test(mimetype ?? "");
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

/** `held`, then the rest of `reader` unless `ended`, run through a
 *  WebmInterleaver (webmInterleave.ts). */
function interleaved(
    reader: ChunkReader,
    held: ArrayBuffer[],
    ended: boolean,
): ChunkReader {
    const sorter = new WebmInterleaver();
    const ready: Uint8Array[] = [];
    let done = false;
    return {
        async read() {
            while (!ready.length && !done) {
                const next = held.shift();
                if (next) {
                    ready.push(...sorter.push(new Uint8Array(next)));
                    continue;
                }
                const r = ended
                    ? { done: true as const, value: undefined }
                    : await reader.read();
                if (r.done) {
                    done = true;
                    ready.push(...sorter.end());
                } else ready.push(...sorter.push(r.value));
            }
            const value = ready.shift();
            return value
                ? { done: false, value }
                : { done: true, value: undefined };
        },
    };
}

type QueuedAppend =
    | { buffer: ArrayBuffer; after?: () => void }
    /** Empty the SourceBuffer (see AppendQueue.restart). */
    | { removeAll: true }
    /** Reset the parser, and say where the next generated timestamps start. */
    | { reset: true; timestampOffset?: number };

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
        private video: HTMLMediaElement,
        private fail: (err: unknown) => void,
    ) {
        sb.addEventListener("updateend", () => {
            const done = this.current;
            this.current = null;
            if (done && "after" in done) done.after?.();
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

    /** Drop everything buffered or still queued, then append `items`.
     *  Waiters on drained() carry over to the new queue. */
    restart(items: QueuedAppend[]) {
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.retryTimer = null;
        this.queue = [{ removeAll: true }, ...items];
        this.pump();
    }

    dispose() {
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.queue = [];
        this.waiters = [];
    }

    private pump() {
        if (this.sb.updating || this.current || this.retryTimer) return;
        let next = this.queue[0];
        // A reset completes at once, with no updateend to wait for.
        while (next && "reset" in next) {
            try {
                this.sb.abort();
                if (next.timestampOffset !== undefined)
                    this.sb.timestampOffset = next.timestampOffset;
            } catch (err) {
                this.fail(err);
                return;
            }
            this.queue.shift();
            next = this.queue[0];
        }
        if (!next) {
            const waiters = this.waiters;
            this.waiters = [];
            for (const w of waiters) w();
            return;
        }
        try {
            if ("buffer" in next) this.sb.appendBuffer(next.buffer);
            else this.sb.remove(0, Infinity);
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
    video: HTMLMediaElement,
    httpUrl: string,
    opts: AuthedVideoStreamOptions = {},
): AuthedVideoStream {
    const abort = new AbortController();
    const objectUrls: string[] = [];
    let mp4: ISOFile<AppendQueue, unknown> | null = null;
    const queues: AppendQueue[] = [];
    const cleanups: Array<() => void> = [];
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

    /**
     * The browser evicts what has played once a SourceBuffer reaches its cap
     * (Chromium: about 12 MB of audio, 150 MB of video), and nothing can be
     * re-fetched. So on a seek to a time a SourceBuffer no longer holds, it is
     * emptied and refilled from `refill` (seekIndex.ts). Returns the stream's
     * ending, to await once everything has been queued.
     */
    function refillOnSeek(
        ms: MediaSource,
        tracks: Array<{
            sb: SourceBuffer;
            q: AppendQueue;
            refill: (t: number) => Refill | null;
        }>,
    ) {
        let finished = false;
        const end = async () => {
            await Promise.all(tracks.map((t) => t.q.drained()));
            if (!disposed && ms.readyState === "open") ms.endOfStream();
        };
        const onSeeking = () => {
            if (disposed || ms.readyState === "closed") return;
            const t = video.currentTime;
            let restarted = false;
            for (const track of tracks) {
                const b = track.sb.buffered;
                let held = false;
                for (let i = 0; i < b.length && !held; i++)
                    held = b.start(i) <= t && t < b.end(i);
                if (held) continue;
                const items = track.refill(t);
                if (!items) continue;
                track.q.restart(items);
                restarted = true;
            }
            // Emptying a SourceBuffer reopened the ended MediaSource.
            if (restarted && finished) void end();
        };
        video.addEventListener("seeking", onSeeking);
        cleanups.push(() => video.removeEventListener("seeking", onSeeking));
        return async () => {
            await end();
            finished = true;
        };
    }

    async function readAll(reader: ChunkReader, parts: BlobPart[]) {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) return;
            parts.push(ownBuffer(value));
        }
    }

    async function playAsBlob(reader: ChunkReader | null, parts: BlobPart[]) {
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

    // How much of the head of a WebM to read while looking for its Tracks.
    // Real files put them in the first few KB; past this it is not worth it.
    const WEBM_PROBE_LIMIT = 2 * 1024 * 1024;

    /**
     * WebM needs no remuxing: once the codecs are known the bytes go into a
     * SourceBuffer exactly as they arrive. Anything the probe can't vouch for
     * (an unusual codec, no Tracks near the start, a MIME type this browser's
     * MediaSource refuses) is downloaded in full and handed to the element
     * as a blob instead, as before.
     */
    async function streamWebm(reader: ChunkReader, held: ArrayBuffer[]) {
        let mime: string | null = null;
        let ended = false;
        let size = held.reduce((n, b) => n + b.byteLength, 0);
        for (;;) {
            const head = new Uint8Array(size);
            let at = 0;
            for (const b of held) {
                head.set(new Uint8Array(b), at);
                at += b.byteLength;
            }
            const probe = probeWebm(head);
            if (probe.status === "ok") {
                mime = probe.mime;
                break;
            }
            if (probe.status === "unsupported" || size > WEBM_PROBE_LIMIT)
                break;
            const { done, value } = await reader.read();
            if (done) {
                ended = true;
                break;
            }
            const buf = ownBuffer(value);
            held.push(buf);
            size += buf.byteLength;
        }
        if (!mime || !MediaSource.isTypeSupported(mime)) {
            return streamMatroska(reader, held, ended);
        }
        if (!mime.includes(",")) {
            return streamBytes(reader, held, mime, ended, new WebmIndex());
        }
        // Several tracks: their blocks may need putting in order first.
        const sorted = interleaved(reader, held, ended);
        return streamBytes(sorted, [], mime, false, new WebmIndex());
    }

    /**
     * A Matroska the WebM route can't take (H.264/HEVC/AAC: an MKV from OBS
     * or a rip) is remuxed to fragmented MP4 as it arrives (mkvRemux.ts).
     * Anything the remuxer or the browser can't handle plays as a blob.
     */
    async function streamMatroska(
        reader: ChunkReader,
        held: ArrayBuffer[],
        ended: boolean,
    ) {
        const { MkvRemuxer } = await import("$lib/utils/mkvRemux");
        const remux = new MkvRemuxer();
        for (const buf of held) remux.push(new Uint8Array(buf));
        while (!remux.header && !remux.unsupported) {
            if (ended) {
                remux.end();
                break;
            }
            const { done, value } = await reader.read();
            if (done) {
                ended = true;
                continue;
            }
            const buf = ownBuffer(value);
            held.push(buf);
            remux.push(new Uint8Array(buf));
        }
        if (disposed) return;
        const header = remux.header;
        if (
            !header ||
            !header.tracks.every((t) => MediaSource.isTypeSupported(t.mime))
        ) {
            return playAsBlob(ended ? null : reader, held);
        }
        held.length = 0;

        const ms = new MediaSource();
        const opened = new Promise<void>((resolve) =>
            ms.addEventListener("sourceopen", () => resolve(), { once: true }),
        );
        setSrc(URL.createObjectURL(ms));
        await opened;
        if (disposed) return;
        if (header.duration) ms.duration = header.duration;

        const tracks = header.tracks.map((t) => {
            const sb = ms.addSourceBuffer(t.mime);
            const q = new AppendQueue(sb, video, fail);
            queues.push(q);
            q.push({ buffer: t.init });
            const log = new FragmentLog(
                initTimescale(new Uint8Array(t.init)) ?? 1,
            );
            return { sb, q, log, refill: (at: number) => log.from(at) };
        });
        const finish = refillOnSeek(ms, tracks);
        const pump = () => {
            for (const seg of remux.take()) {
                tracks[seg.track].log.add(seg.buffer);
                tracks[seg.track].q.push({ buffer: seg.buffer });
            }
        };
        pump();
        if (!ended) {
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                remux.push(value);
                pump();
            }
            remux.end();
            pump();
        }
        await finish();
    }

    /**
     * Raw FLAC has no SourceBuffer of its own: it is re-boxed into fragmented
     * MP4 as it arrives (flacRemux.ts). Plays as a blob if that fails.
     */
    async function streamFlac(reader: ChunkReader, held: ArrayBuffer[]) {
        const { FlacRemuxer } = await import("$lib/utils/flacRemux");
        const remux = new FlacRemuxer();
        let ended = false;
        for (const buf of held) remux.push(new Uint8Array(buf));
        while (!remux.header && !remux.unsupported) {
            const { done, value } = await reader.read();
            if (done) {
                ended = true;
                remux.end();
                break;
            }
            const buf = ownBuffer(value);
            held.push(buf);
            remux.push(new Uint8Array(buf));
        }
        if (disposed) return;
        const header = remux.header;
        const track = header?.tracks[0];
        if (!header || !track || !MediaSource.isTypeSupported(track.mime)) {
            return playAsBlob(ended ? null : reader, held);
        }
        held.length = 0;

        const ms = new MediaSource();
        const opened = new Promise<void>((resolve) =>
            ms.addEventListener("sourceopen", () => resolve(), { once: true }),
        );
        setSrc(URL.createObjectURL(ms));
        await opened;
        if (disposed) return;
        if (header.duration) ms.duration = header.duration;
        const sb = ms.addSourceBuffer(track.mime);
        const q = new AppendQueue(sb, video, fail);
        queues.push(q);
        q.push({ buffer: track.init });
        const log = new FragmentLog(
            initTimescale(new Uint8Array(track.init)) ?? 1,
        );
        const finish = refillOnSeek(ms, [
            { sb, q, refill: (t) => log.from(t) },
        ]);
        const pump = () => {
            for (const seg of remux.take()) {
                log.add(seg.buffer);
                q.push({ buffer: seg.buffer });
            }
        };
        pump();
        if (!ended) {
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                remux.push(value);
                pump();
            }
            remux.end();
            pump();
        }
        await finish();
    }

    /**
     * Append the bytes to a SourceBuffer of type `mime` as they arrive, or, when
     * there is no usable `mime`, download everything and play it as a blob.
     * `held` is what has been read so far, `ended` whether the reader is spent.
     * `index` keeps the bytes for refilling after a seek (seekIndex.ts).
     */
    async function streamBytes(
        reader: ChunkReader,
        held: ArrayBuffer[],
        mime: string | null,
        ended: boolean,
        index: { push(b: ArrayBuffer): void; from(t: number): Refill | null },
    ) {
        if (disposed) return;
        if (!mime || !MediaSource.isTypeSupported(mime)) {
            return playAsBlob(ended ? null : reader, held);
        }

        const ms = new MediaSource();
        const opened = new Promise<void>((resolve) =>
            ms.addEventListener("sourceopen", () => resolve(), { once: true }),
        );
        setSrc(URL.createObjectURL(ms));
        await opened;
        if (disposed) return;

        const sb = ms.addSourceBuffer(mime);
        const q = new AppendQueue(sb, video, fail);
        queues.push(q);
        const finish = refillOnSeek(ms, [
            { sb, q, refill: (t) => index.from(t) },
        ]);
        const append = (buffer: ArrayBuffer) => {
            index.push(buffer);
            q.push({ buffer });
        };
        for (const buffer of held) append(buffer);
        held.length = 0;
        if (!ended) {
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                append(ownBuffer(value));
            }
        }
        await finish();
    }

    async function run() {
        const reader = await openAuthedReader(httpUrl, {
            decrypt: opts.decrypt,
            expectedSize: opts.expectedSize,
            onProgress: opts.onProgress,
            signal: abort.signal,
        });
        if (opts.forceBlob || typeof MediaSource === "undefined") {
            return playAsBlob(reader, []);
        }

        // Everything read so far, kept until we commit to MSE so a fallback
        // to a blob loses nothing.
        const held: ArrayBuffer[] = [];
        let first = await reader.read();
        if (first.done) return playAsBlob(null, held);
        held.push(ownBuffer(first.value));
        if (!isMp4(first.value)) {
            if (isWebm(first.value)) return streamWebm(reader, held);
            if (looksLikeFlac(first.value, opts.mimetype))
                return streamFlac(reader, held);
            // MP3 is a bare frame stream: no header to parse, no remuxing.
            if (isMp3(first.value)) {
                return streamBytes(
                    reader,
                    held,
                    "audio/mpeg",
                    false,
                    new Mp3Index(),
                );
            }
            return playAsBlob(reader, held);
        }

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
        if (!movie || parseError || tracks.length === 0) {
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

        const logs = new Map<AppendQueue, FragmentLog>();
        const refillable = tracks.map((track, i) => {
            const sb = ms.addSourceBuffer(mimes[i]);
            const q = new AppendQueue(sb, video, fail);
            queues.push(q);
            const log = new FragmentLog(track.timescale);
            logs.set(q, log);
            file.setSegmentOptions(track.id, q, {
                nbSamples: SAMPLES_PER_SEGMENT,
            });
            return { sb, q, refill: (t: number) => log.from(t) };
        });
        const finish = refillOnSeek(ms, refillable);
        file.onSegment = (id, q, buffer, nextSample) => {
            logs.get(q)?.add(buffer);
            q.push({
                buffer,
                // Let mp4box drop the source samples once MSE has them: the
                // fragment log already holds them once.
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
        await finish();
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
            for (const cleanup of cleanups) cleanup();
            // Detach before revoking so the element stops decoding.
            video.pause();
            video.removeAttribute("src");
            video.load();
            for (const url of objectUrls) URL.revokeObjectURL(url);
        },
    };
}
