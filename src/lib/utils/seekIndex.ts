import { id3Size } from "./flacProbe";
import { readId, readSize } from "./webmProbe";

/**
 * Where to resume appending after a seek, for each kind of stream that
 * videoStream.ts feeds into a MediaSource.
 *
 * Browsers cap a SourceBuffer (Chromium: about 12 MB of audio, 150 MB of
 * video) and evict what has already played to stay under it, and a homeserver
 * download can't be re-fetched from the middle (no Range support). So
 * everything appended is also kept here, indexed by time, and a seek to a
 * stretch the browser threw away appends it again from there:
 *   - FragmentLog: fragmented MP4 (the FLAC, MKV and MP4 remuxes). Every
 *     fragment carries its own timestamps, so any of them can go back in.
 *   - WebmIndex: WebM appended as it downloads. Clusters carry timestamps,
 *     but the byte stream must restart at one, after the header.
 *   - Mp3Index: a bare MPEG audio frame stream. Its SourceBuffer stamps
 *     frames itself, so the restart says what time the first frame is.
 *
 * Each `from(t)` starts one step before the point that covers `t`, so a
 * little slack in the timing (an edit list, a cluster that doesn't open on a
 * keyframe) still leaves `t` buffered.
 */

/**
 * One piece of a refill: bytes already in memory, or bytes still in cold
 * storage, read when the SourceBuffer queue reaches them (see AppendQueue).
 */
export type RefillPart =
    { buffer: ArrayBuffer } | { read: () => Promise<ArrayBuffer> };

/** What to append to a SourceBuffer that was emptied, in order. */
export type Refill = Array<
    RefillPart | { reset: true; timestampOffset?: number }
>;

/**
 * Bytes a log keeps as ArrayBuffers in the JS heap. Past this, the oldest
 * chunks are batched into a Blob (Chromium spills large Blobs to disk), so a
 * long download costs a bounded amount of heap however much it is seeked.
 */
export const HOT_BYTES = 48 * 1024 * 1024;

/** A flush moves the oldest chunks until this much is hot again, so each
 *  batch is tens of MB rather than one chunk. */
const HOT_KEEP_BYTES = 24 * 1024 * 1024;

interface HotChunk {
    start: number;
    buffer: ArrayBuffer;
}

interface ColdBatch {
    /** Absolute offsets covered: [start, end). */
    start: number;
    end: number;
    blob: Blob;
}

/**
 * Every chunk of a byte stream, addressable by absolute offset. The newest
 * bytes stay in `hot` (ArrayBuffers, no copies); older ones sit in `cold`
 * (Blob batches, in order, all before `hot`). See HOT_BYTES.
 */
export class ByteLog {
    private cold: ColdBatch[] = [];
    private hot: HotChunk[] = [];
    private hotSize = 0;
    private released = false;
    length = 0;

    constructor(
        private hotCap = HOT_BYTES,
        private keepCap = Math.min(HOT_KEEP_BYTES, hotCap),
    ) {}

    /** Bytes currently held as ArrayBuffers. Never above the cap after a push. */
    get hotBytes(): number {
        return this.hotSize;
    }

    push(chunk: ArrayBuffer) {
        if (this.released) return;
        this.hot.push({ start: this.length, buffer: chunk });
        this.length += chunk.byteLength;
        this.hotSize += chunk.byteLength;
        if (this.hotSize > this.hotCap) this.flush();
    }

    /** Move the oldest hot chunks into one Blob, until `keepCap` is left. */
    private flush() {
        let remaining = this.hotSize;
        let n = 0;
        while (n < this.hot.length && remaining > this.keepCap) {
            remaining -= this.hot[n].buffer.byteLength;
            n++;
        }
        const moved = this.hot.splice(0, n);
        const start = moved[0].start;
        const end = start + (this.hotSize - remaining);
        // The Blob constructor copies the bytes now; the ArrayBuffers are
        // unreferenced from here on.
        this.cold.push({
            start,
            end,
            blob: new Blob(moved.map((c) => c.buffer)),
        });
        this.hotSize = remaining;
    }

    /**
     * What covers [from, to), in order, without reading cold storage: hot
     * pieces by reference (copies only where a chunk is cut), and one lazy
     * read per cold batch.
     */
    plan(from = 0, to = this.length): RefillPart[] {
        const out: RefillPart[] = [];
        for (const c of this.cold) {
            if (c.end <= from || c.start >= to) continue;
            const a = Math.max(from, c.start) - c.start;
            const b = Math.min(to, c.end) - c.start;
            const blob = c.blob;
            out.push({ read: () => blob.slice(a, b).arrayBuffer() });
        }
        for (const c of this.hot) {
            const end = c.start + c.buffer.byteLength;
            if (end <= from || c.start >= to) continue;
            if (c.start >= from && end <= to) out.push({ buffer: c.buffer });
            else
                out.push({
                    buffer: c.buffer.slice(
                        Math.max(from, c.start) - c.start,
                        Math.min(to, end) - c.start,
                    ),
                });
        }
        return out;
    }

    /** The bytes in [from, to), reading cold storage as needed. */
    async range(from = 0, to = this.length): Promise<ArrayBuffer[]> {
        return Promise.all(
            this.plan(from, to).map((p) =>
                "buffer" in p ? p.buffer : p.read(),
            ),
        );
    }

    /** Drop every reference, hot and cold. The log stops accepting bytes. */
    release() {
        this.released = true;
        this.cold = [];
        this.hot = [];
        this.hotSize = 0;
    }
}

/** Index of the last entry whose time is at most `t`, one step earlier for
 *  slack; 0 when none is. */
function stepBefore(times: number[], t: number): number {
    let k = -1;
    for (let i = 0; i < times.length && times[i] <= t; i++) k = i;
    return Math.max(0, k - 1);
}

// ---------------------------------------------------------------- fMP4

function boxes(
    b: Uint8Array,
    from: number,
    to: number,
    visit: (type: string, body: number, end: number) => void,
) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let p = from;
    while (p + 8 <= to) {
        let size = dv.getUint32(p);
        let body = p + 8;
        if (size === 1) {
            if (p + 16 > to) return;
            size = dv.getUint32(p + 8) * 2 ** 32 + dv.getUint32(p + 12);
            body = p + 16;
        } else if (size === 0) size = to - p;
        if (size < body - p || p + size > to) return;
        const type = String.fromCharCode(
            b[p + 4],
            b[p + 5],
            b[p + 6],
            b[p + 7],
        );
        visit(type, body, p + size);
        p += size;
    }
}

/** The track timescale from an fMP4 init segment's mdhd, or null. */
export function initTimescale(init: Uint8Array): number | null {
    const dv = new DataView(init.buffer, init.byteOffset, init.byteLength);
    let found: number | null = null;
    const walk = (from: number, to: number) =>
        boxes(init, from, to, (type, body, end) => {
            if (found !== null) return;
            if (type === "moov" || type === "trak" || type === "mdia")
                walk(body, end);
            else if (type === "mdhd" && end - body >= 24) {
                // version 1 has 64-bit creation/modification times.
                found = dv.getUint32(body + (init[body] === 1 ? 20 : 12));
            }
        });
    walk(0, init.length);
    return found || null;
}

export interface FragmentTimes {
    /** Decode time of the first sample, seconds. */
    start: number;
    /** Presentation time of the first keyframe, seconds, or null if none. */
    sync: number | null;
}

/**
 * Read a fragment's timing: the first tfdt, plus trun durations, offsets and
 * sample flags to place the first keyframe. A sample whose flags aren't
 * written anywhere counts as a keyframe (that is what audio is).
 */
export function fragmentTimes(
    b: Uint8Array,
    timescale: number,
): FragmentTimes | null {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let start: number | null = null;
    let sync: number | null = null;
    const traf = (from: number, to: number) => {
        let dts: number | null = null;
        let defDuration = 0;
        let defFlags: number | null = null;
        boxes(b, from, to, (type, body, end) => {
            const flags = dv.getUint32(body) & 0xffffff;
            if (type === "tfhd") {
                let q = body + 8;
                if (flags & 0x01) q += 8;
                if (flags & 0x02) q += 4;
                if (flags & 0x08) defDuration = dv.getUint32(q);
                if (flags & 0x08) q += 4;
                if (flags & 0x10) q += 4;
                if (flags & 0x20 && q + 4 <= end) defFlags = dv.getUint32(q);
            } else if (type === "tfdt") {
                dts =
                    b[body] === 1
                        ? dv.getUint32(body + 4) * 2 ** 32 +
                          dv.getUint32(body + 8)
                        : dv.getUint32(body + 4);
                start ??= dts / timescale;
            } else if (type === "trun" && dts !== null && sync === null) {
                const count = dv.getUint32(body + 4);
                let q = body + 8;
                if (flags & 0x001) q += 4;
                let first: number | null = null;
                if (flags & 0x004) {
                    first = dv.getUint32(q);
                    q += 4;
                }
                for (let i = 0; i < count && q <= end; i++) {
                    let duration = defDuration;
                    let sampleFlags =
                        i === 0 && first !== null ? first : defFlags;
                    let cts = 0;
                    if (flags & 0x100) {
                        duration = dv.getUint32(q);
                        q += 4;
                    }
                    if (flags & 0x200) q += 4;
                    if (flags & 0x400) {
                        sampleFlags = dv.getUint32(q);
                        q += 4;
                    }
                    if (flags & 0x800) {
                        // Version 1 makes the offsets signed.
                        cts = b[body] === 1 ? dv.getInt32(q) : dv.getUint32(q);
                        q += 4;
                    }
                    // sample_is_non_sync_sample
                    if (sampleFlags === null || !(sampleFlags & 0x10000)) {
                        sync = (dts + cts) / timescale;
                        return;
                    }
                    dts += duration;
                }
            }
        });
    };
    boxes(b, 0, b.length, (type, body, end) => {
        if (type !== "moof") return;
        boxes(b, body, end, (type, body, end) => {
            if (type === "traf") traf(body, end);
        });
    });
    return start === null ? null : { start, sync };
}

/** Fragments of one fMP4 track, as appended. See the file header. */
export class FragmentLog {
    private log: ByteLog;
    /** Where each fragment starts in `log`. */
    private starts: number[] = [];
    /** When playback can start from each fragment: its first keyframe, or
     *  Infinity when it has none (it can only follow its predecessor). */
    private entries: number[] = [];

    constructor(
        private timescale: number,
        hotCap?: number,
    ) {
        this.log = new ByteLog(hotCap);
    }

    add(buffer: ArrayBuffer) {
        const times = fragmentTimes(new Uint8Array(buffer), this.timescale);
        this.starts.push(this.log.length);
        this.log.push(buffer);
        this.entries.push(times?.sync ?? Infinity);
    }

    from(t: number): Refill | null {
        if (!this.entries.length) return null;
        let k = -1;
        for (let i = 0; i < this.entries.length; i++)
            if (this.entries[i] <= t) k = i;
        // Appending begins one fragment early; anything before its keyframe
        // the browser skips by itself.
        k = Math.max(0, k - 1);
        return this.log.plan(this.starts[k]);
    }

    release() {
        this.log.release();
        this.starts = [];
        this.entries = [];
    }
}

// ---------------------------------------------------------------- WebM

const ID_SEGMENT = 0x18538067;
const ID_INFO = 0x1549a966;
const ID_TIMESTAMP_SCALE = 0x2ad7b1;
const ID_CLUSTER = 0x1f43b675;
const ID_CLUSTER_TIMESTAMP = 0xe7;
/** Entered rather than skipped: their children are what is indexed. */
const ENTER = new Set([ID_SEGMENT, ID_INFO, ID_CLUSTER]);
/** Small values read whole. */
const READ = new Set([ID_TIMESTAMP_SCALE, ID_CLUSTER_TIMESTAMP]);

/** Cluster offsets and times of a WebM, built as its bytes arrive. Gives up
 *  (and `from` returns null) on anything it can't walk. */
export class WebmIndex {
    private log = new ByteLog();
    /** Unscanned bytes, starting at absolute offset `pos`. */
    private tail = new Uint8Array(0);
    private pos = 0;
    private skip = 0;
    private broken = false;
    private scale = 1e6;
    /** Where the first Cluster starts: everything before it is the header. */
    private headerEnd: number | null = null;
    private offsets: number[] = [];
    private times: number[] = [];
    private pendingCluster: number | null = null;

    push(chunk: ArrayBuffer) {
        this.log.push(chunk);
        if (this.broken) return;
        let bytes = new Uint8Array(chunk);
        if (this.skip > 0) {
            const drop = Math.min(this.skip, bytes.length);
            this.skip -= drop;
            this.pos += drop;
            bytes = bytes.subarray(drop);
        }
        const next = new Uint8Array(this.tail.length + bytes.length);
        next.set(this.tail);
        next.set(bytes, this.tail.length);
        this.tail = next;
        this.scan();
    }

    from(t: number): Refill | null {
        if (this.broken || this.headerEnd === null || !this.times.length)
            return null;
        const k = stepBefore(this.times, t);
        return [
            // The parser may be mid-element from the last append.
            { reset: true },
            ...this.log.plan(0, this.headerEnd),
            ...this.log.plan(this.offsets[k]),
        ];
    }

    release() {
        this.broken = true;
        this.log.release();
    }

    private scan() {
        const b = this.tail;
        let p = 0;
        for (;;) {
            const id = readId(b, p);
            if (!id) break;
            const size = readSize(b, p + id.length);
            if (!size) break;
            const body = p + id.length + size.length;
            if (id.id === ID_CLUSTER) {
                this.headerEnd ??= this.pos + p;
                this.pendingCluster = this.pos + p;
            }
            if (ENTER.has(id.id)) {
                p = body;
                continue;
            }
            if (size.size === null) {
                this.broken = true;
                return;
            }
            if (READ.has(id.id)) {
                if (body + size.size > b.length) break;
                let v = 0;
                for (let i = 0; i < size.size; i++) v = v * 256 + b[body + i];
                if (id.id === ID_TIMESTAMP_SCALE) this.scale = v || 1e6;
                else if (this.pendingCluster !== null) {
                    this.offsets.push(this.pendingCluster);
                    this.times.push((v * this.scale) / 1e9);
                    this.pendingCluster = null;
                }
                p = body + size.size;
                continue;
            }
            // Skipped, possibly past what has arrived.
            const end = body + size.size;
            if (end > b.length) {
                this.skip = end - b.length;
                this.pos += b.length;
                this.tail = new Uint8Array(0);
                return;
            }
            p = end;
        }
        this.pos += p;
        this.tail = b.slice(p);
    }
}

// ---------------------------------------------------------------- MP3

// Bitrates in kbit/s by [MPEG-1?][layer 1..3][index].
const BITRATES = [
    [
        [],
        [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
        [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
        [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
    ],
    [
        [],
        [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
        [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
        [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
    ],
];
const SAMPLE_RATES = [44100, 48000, 32000];

/** Length and duration of the MPEG audio frame at b[p], or null. */
export function mp3Frame(
    b: Uint8Array,
    p: number,
): { length: number; seconds: number } | null {
    if (p + 4 > b.length) return null;
    if (b[p] !== 0xff || (b[p + 1] & 0xe0) !== 0xe0) return null;
    const version = (b[p + 1] >> 3) & 3; // 0: 2.5, 2: 2, 3: 1
    const layer = 4 - ((b[p + 1] >> 1) & 3); // 1..3, 4 is reserved
    const brIndex = b[p + 2] >> 4;
    const srIndex = (b[p + 2] >> 2) & 3;
    const pad = (b[p + 2] >> 1) & 1;
    if (version === 1 || layer === 4 || brIndex === 0 || brIndex === 15)
        return null;
    if (srIndex === 3) return null;
    const mpeg1 = version === 3;
    const rate = SAMPLE_RATES[srIndex] / (mpeg1 ? 1 : version === 2 ? 2 : 4);
    const bitrate = BITRATES[mpeg1 ? 1 : 0][layer][brIndex] * 1000;
    let length: number;
    let samples: number;
    if (layer === 1) {
        length = (Math.floor((12 * bitrate) / rate) + pad) * 4;
        samples = 384;
    } else {
        samples = layer === 3 && !mpeg1 ? 576 : 1152;
        length = Math.floor(((samples / 8) * bitrate) / rate) + pad;
    }
    return { length, seconds: samples / rate };
}

/** Frame offsets and times of an MP3, every half second or so, built as its
 *  bytes arrive. */
export class Mp3Index {
    private log = new ByteLog();
    private tail = new Uint8Array(0);
    /** Absolute offset of tail[0]. */
    private pos = 0;
    private skip = 0;
    private started = false;
    private time = 0;
    private offsets: number[] = [];
    private times: number[] = [];
    private released = false;

    push(chunk: ArrayBuffer) {
        this.log.push(chunk);
        if (this.released) return;
        let bytes = new Uint8Array(chunk);
        if (this.skip > 0) {
            const drop = Math.min(this.skip, bytes.length);
            this.skip -= drop;
            this.pos += drop;
            bytes = bytes.subarray(drop);
        }
        const next = new Uint8Array(this.tail.length + bytes.length);
        next.set(this.tail);
        next.set(bytes, this.tail.length);
        this.tail = next;
        this.scan();
    }

    from(t: number): Refill | null {
        if (!this.times.length) return null;
        const k = stepBefore(this.times, t);
        return [
            // The SourceBuffer numbers frames from where it is told to.
            { reset: true, timestampOffset: this.times[k] },
            ...this.log.plan(this.offsets[k]),
        ];
    }

    release() {
        this.released = true;
        this.times = [];
        this.offsets = [];
        this.log.release();
    }

    private scan() {
        const b = this.tail;
        let p = 0;
        if (!this.started) {
            if (b.length < 10) return;
            this.started = true;
            const tag = id3Size(b);
            if (tag > b.length) {
                this.skip = tag - b.length;
                this.pos += b.length;
                this.tail = new Uint8Array(0);
                return;
            }
            p = tag;
        }
        while (p + 4 <= b.length) {
            const f = mp3Frame(b, p);
            // Not a frame here (junk, a trailing tag): look for the next one.
            if (!f) {
                p++;
                continue;
            }
            const at = this.pos + p;
            const last = this.times[this.times.length - 1];
            if (last === undefined || this.time - last >= 0.5) {
                this.offsets.push(at);
                this.times.push(this.time);
            }
            this.time += f.seconds;
            if (p + f.length > b.length) {
                this.skip = p + f.length - b.length;
                this.pos += b.length;
                this.tail = new Uint8Array(0);
                return;
            }
            p += f.length;
        }
        this.pos += p;
        this.tail = b.slice(p);
    }
}
