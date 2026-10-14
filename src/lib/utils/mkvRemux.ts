import { readId, readSize } from "./webmProbe";

/**
 * Matroska (MKV) to fragmented MP4, on the fly, for MediaSource.
 *
 * A WebM streams by appending its own bytes (webmProbe.ts), but MediaSource
 * only takes VP8/VP9/AV1 with Opus/Vorbis that way, and there is no Matroska
 * SourceBuffer at all. The usual MKV (an OBS recording, a rip) is H.264 or
 * HEVC with AAC, which only an MP4 SourceBuffer accepts. The frames inside are
 * already laid out the way MP4 wants them (length-prefixed NAL units, raw
 * AAC/Opus/FLAC frames), so this re-boxes rather than re-encodes: the blocks
 * are read out of the Clusters as they arrive and written back out as one
 * fMP4 stream per track, one init segment plus a moof/mdat per batch.
 *
 * What Matroska doesn't carry is a decode timestamp. Blocks come in decode
 * order stamped with presentation time, so with B-frames the DTS is rebuilt:
 * the k-th decode timestamp is the k-th smallest presentation timestamp, and
 * that is settled once REORDER_DEPTH later frames have arrived (no codec
 * reorders further than its DPB, which is at most 16 frames).
 *
 * The scan is flat, like probeWebm: the few containers that matter are
 * entered, the leaves that matter are read whole, and everything else
 * (SeekHead, Cues, Tags, attached fonts) is skipped by size without being
 * buffered. Anything this can't express (another codec, compressed or
 * encrypted tracks) leaves `unsupported` set before the first frame, and the
 * caller falls back to playing the file whole.
 */

const ID_SEGMENT = 0x18538067;
const ID_INFO = 0x1549a966;
const ID_TIMESTAMP_SCALE = 0x2ad7b1;
const ID_DURATION = 0x4489;
const ID_TRACKS = 0x1654ae6b;
const ID_TRACK_ENTRY = 0xae;
const ID_TRACK_NUMBER = 0xd7;
const ID_TRACK_TYPE = 0x83;
const ID_CODEC_ID = 0x86;
const ID_CODEC_PRIVATE = 0x63a2;
const ID_DEFAULT_DURATION = 0x23e383;
const ID_CONTENT_ENCODINGS = 0x6d80;
const ID_VIDEO = 0xe0;
const ID_PIXEL_WIDTH = 0xb0;
const ID_PIXEL_HEIGHT = 0xba;
const ID_AUDIO = 0xe1;
const ID_SAMPLING_FREQUENCY = 0xb5;
const ID_CHANNELS = 0x9f;
const ID_CLUSTER = 0x1f43b675;
const ID_CLUSTER_TIMESTAMP = 0xe7;
const ID_SIMPLE_BLOCK = 0xa3;
const ID_BLOCK_GROUP = 0xa0;
const ID_BLOCK = 0xa1;
const ID_REFERENCE_BLOCK = 0xfb;

const CONTAINERS = new Set([
    ID_SEGMENT,
    ID_INFO,
    ID_TRACKS,
    ID_TRACK_ENTRY,
    ID_VIDEO,
    ID_AUDIO,
    ID_CLUSTER,
    ID_BLOCK_GROUP,
]);
const LEAVES = new Set([
    ID_TIMESTAMP_SCALE,
    ID_DURATION,
    ID_TRACK_NUMBER,
    ID_TRACK_TYPE,
    ID_CODEC_ID,
    ID_CODEC_PRIVATE,
    ID_DEFAULT_DURATION,
    ID_CONTENT_ENCODINGS,
    ID_PIXEL_WIDTH,
    ID_PIXEL_HEIGHT,
    ID_SAMPLING_FREQUENCY,
    ID_CHANNELS,
    ID_CLUSTER_TIMESTAMP,
    ID_SIMPLE_BLOCK,
    ID_BLOCK,
    ID_REFERENCE_BLOCK,
]);

const TRACK_VIDEO = 1;
const TRACK_AUDIO = 2;

// Largest single element read whole. Nothing that size is one frame.
const MAX_LEAF = 64 * 1024 * 1024;
// Frames that must follow one before its decode timestamp is certain.
const REORDER_DEPTH = 16;
// Samples per written fragment: about half a second either way.
const VIDEO_BATCH = 15;
const AUDIO_BATCH = 24;
const VIDEO_TIMESCALE = 90000;

export interface RemuxTrack {
    kind: "video" | "audio";
    /** For MediaSource.isTypeSupported / addSourceBuffer. */
    mime: string;
    /** ftyp+moov, appended before any fragment. */
    init: ArrayBuffer;
}

export interface RemuxHeader {
    tracks: RemuxTrack[];
    /** Seconds, when the file says. */
    duration: number | null;
}

export interface RemuxSegment {
    /** Index into `header.tracks`. */
    track: number;
    buffer: ArrayBuffer;
}

interface TrackEntry {
    number: number;
    type: number;
    codecId: string;
    codecPrivate: Uint8Array | null;
    defaultDuration: number | null;
    encoded: boolean;
    width: number;
    height: number;
    sampleRate: number;
    channels: number;
}

interface Sample {
    data: Uint8Array;
    /** Presentation time, ns. Null for a laced frame not yet placed. */
    pts: number | null;
    key: boolean;
    /** Video: decode time, ns, once settled. */
    dts?: number;
    /** Decode time in track ticks, once written or looked ahead at. */
    dtsT?: number;
}

interface OutTrack {
    kind: "video" | "audio";
    timescale: number;
    /** Duration of one frame, ns, when known up front. */
    frameNs: number | null;
    samples: Sample[];
    /** Video: presentation times not yet handed out as decode times. */
    pool: number[];
    /** Video: samples[0..assigned) have their dts. */
    assigned: number;
    started: boolean;
    firstPts: number | null;
    seq: number;
    lastDtsT: number;
    lastDur: number;
}

/** See the file header. Feed with push(), finish with end(). */
export class MkvRemuxer {
    /** Set at the first Cluster when every track can be remuxed. */
    header: RemuxHeader | null = null;
    /** Why the file can't be remuxed; set instead of `header`. */
    unsupported: string | null = null;

    private chunks: Uint8Array[] = [];
    private chunkBytes = 0;
    private buf = new Uint8Array(0);
    private pos = 0;
    /** File offset of buf[pos]. */
    private abs = 0;
    private skip = 0;
    private ended = false;

    private timestampScale = 1e6;
    private durationRaw: number | null = null;
    private entries: TrackEntry[] = [];
    private clusterTs = 0;
    private group: {
        end: number;
        block: Uint8Array | null;
        referenced: boolean;
    } | null = null;

    private outs: OutTrack[] = [];
    private byNumber = new Map<number, OutTrack>();
    private segments: RemuxSegment[] = [];
    /** Added to every timestamp so none is negative (see flush). */
    private offsetNs: number | null = null;
    private videoDelayNs = 0;

    /** Feed the next bytes of the file. Throws on a broken stream once
     *  `header` is out; before that, a failure sets `unsupported`. */
    push(chunk: Uint8Array) {
        if (this.unsupported || this.ended || chunk.length === 0) return;
        this.chunks.push(chunk);
        this.chunkBytes += chunk.length;
        this.run();
    }

    /** The file is complete: write out everything still held. */
    end() {
        if (this.unsupported || this.ended) return;
        this.ended = true;
        this.run();
        if (this.unsupported) return;
        this.closeGroup();
        if (!this.header) {
            this.unsupported = "No media in file";
            return;
        }
        this.flush(true);
    }

    /** Fragments written since the last call. */
    take(): RemuxSegment[] {
        const s = this.segments;
        this.segments = [];
        return s;
    }

    private run() {
        try {
            this.parse();
        } catch (err) {
            if (this.header) throw err;
            this.unsupported = err instanceof Error ? err.message : String(err);
        }
    }

    private available(): number {
        return this.buf.length - this.pos + this.chunkBytes;
    }

    /** Make `n` bytes contiguous at buf[pos], if that many have arrived. */
    private ensure(n: number): boolean {
        if (this.buf.length - this.pos >= n) return true;
        if (this.available() < n) return false;
        const next = new Uint8Array(this.available());
        next.set(this.buf.subarray(this.pos));
        let at = this.buf.length - this.pos;
        for (const c of this.chunks) {
            next.set(c, at);
            at += c.length;
        }
        this.buf = next;
        this.pos = 0;
        this.chunks = [];
        this.chunkBytes = 0;
        return true;
    }

    /** Step over `n` bytes, buffered or not. Returns how many are still owed. */
    private drop(n: number): number {
        const inBuf = Math.min(n, this.buf.length - this.pos);
        this.pos += inBuf;
        this.abs += inBuf;
        n -= inBuf;
        while (n > 0 && this.chunks.length) {
            const c = this.chunks[0];
            if (c.length <= n) {
                this.chunks.shift();
                this.chunkBytes -= c.length;
                this.abs += c.length;
                n -= c.length;
            } else {
                this.chunks[0] = c.subarray(n);
                this.chunkBytes -= n;
                this.abs += n;
                n = 0;
            }
        }
        return n;
    }

    private parse() {
        for (;;) {
            if (this.unsupported) return;
            if (this.skip > 0) {
                this.skip = this.drop(this.skip);
                if (this.skip > 0) return;
            }
            if (this.group && this.abs >= this.group.end) this.closeGroup();

            const avail = this.available();
            if (avail === 0) return;
            this.ensure(Math.min(12, avail));
            const id = readId(this.buf, this.pos);
            const size = id && readSize(this.buf, this.pos + id.length);
            if (!id || !size) {
                if (avail < 12 && !this.ended) return;
                // A truncated tail on a finished download: stop there.
                if (this.ended && this.header) return;
                throw new Error("Malformed Matroska");
            }
            const headerLen = id.length + size.length;

            if (CONTAINERS.has(id.id)) {
                const bodyStart = this.abs + headerLen;
                this.drop(headerLen);
                this.enter(id.id, size.size, bodyStart);
                continue;
            }
            if (size.size === null) {
                throw new Error("Unknown-size Matroska element");
            }
            if (LEAVES.has(id.id)) {
                if (size.size > MAX_LEAF) {
                    throw new Error("Oversized Matroska element");
                }
                if (!this.ensure(headerLen + size.size)) return;
                const start = this.pos + headerLen;
                this.leaf(id.id, this.buf.subarray(start, start + size.size));
                this.drop(headerLen + size.size);
                continue;
            }
            this.skip = headerLen + size.size;
        }
    }

    private enter(id: number, size: number | null, bodyStart: number) {
        if (id === ID_TRACK_ENTRY) {
            this.entries.push({
                number: 0,
                type: 0,
                codecId: "",
                codecPrivate: null,
                defaultDuration: null,
                encoded: false,
                width: 0,
                height: 0,
                sampleRate: 0,
                channels: 1,
            });
        } else if (id === ID_CLUSTER) {
            this.closeGroup();
            if (!this.header) this.finishHeader();
        } else if (id === ID_BLOCK_GROUP) {
            this.closeGroup();
            if (size === null) throw new Error("Unknown-size BlockGroup");
            this.group = {
                end: bodyStart + size,
                block: null,
                referenced: false,
            };
        }
    }

    private leaf(id: number, body: Uint8Array) {
        const entry = this.entries[this.entries.length - 1];
        switch (id) {
            case ID_TIMESTAMP_SCALE:
                this.timestampScale = readUint(body) || 1e6;
                return;
            case ID_DURATION:
                this.durationRaw = readFloat(body);
                return;
            case ID_CLUSTER_TIMESTAMP:
                this.clusterTs = readUint(body);
                return;
            case ID_SIMPLE_BLOCK:
                return this.block(body, body.length > 0 && hasKeyFlag(body));
            case ID_BLOCK:
                if (this.group) this.group.block = body.slice();
                return;
            case ID_REFERENCE_BLOCK:
                if (this.group) this.group.referenced = true;
                return;
        }
        if (!entry) return;
        switch (id) {
            case ID_TRACK_NUMBER:
                entry.number = readUint(body);
                break;
            case ID_TRACK_TYPE:
                entry.type = readUint(body);
                break;
            case ID_CODEC_ID:
                entry.codecId = new TextDecoder("latin1")
                    .decode(body)
                    .replace(/\0+$/, "");
                break;
            case ID_CODEC_PRIVATE:
                entry.codecPrivate = body.slice();
                break;
            case ID_DEFAULT_DURATION:
                entry.defaultDuration = readUint(body) || null;
                break;
            case ID_CONTENT_ENCODINGS:
                entry.encoded = true;
                break;
            case ID_PIXEL_WIDTH:
                entry.width = readUint(body);
                break;
            case ID_PIXEL_HEIGHT:
                entry.height = readUint(body);
                break;
            case ID_SAMPLING_FREQUENCY:
                entry.sampleRate = Math.round(readFloat(body));
                break;
            case ID_CHANNELS:
                entry.channels = readUint(body) || 1;
                break;
        }
    }

    private closeGroup() {
        const g = this.group;
        this.group = null;
        if (g?.block) this.block(g.block, !g.referenced);
    }

    /** Pick the first video and first audio track and describe them as MP4. */
    private finishHeader() {
        const video = this.entries.find((e) => e.type === TRACK_VIDEO);
        const audio = this.entries.find((e) => e.type === TRACK_AUDIO);
        if (!video && !audio) {
            this.unsupported = "No audio or video track";
            return;
        }
        const tracks: RemuxTrack[] = [];
        for (const entry of [video, audio]) {
            if (!entry) continue;
            if (entry.encoded) {
                this.unsupported = "Compressed or encrypted track";
                return;
            }
            const plan = describeTrack(entry);
            if (!plan) {
                this.unsupported = `Unsupported codec ${entry.codecId}`;
                return;
            }
            const out: OutTrack = {
                kind: plan.kind,
                timescale: plan.timescale,
                frameNs: plan.frameNs,
                samples: [],
                pool: [],
                assigned: 0,
                started: false,
                firstPts: null,
                seq: 1,
                lastDtsT: -1,
                lastDur: 0,
            };
            this.outs.push(out);
            this.byNumber.set(entry.number, out);
            tracks.push({
                kind: plan.kind,
                mime: plan.mime,
                init: initSegment(plan, entry),
            });
        }
        this.header = {
            tracks,
            duration:
                this.durationRaw && this.durationRaw > 0
                    ? (this.durationRaw * this.timestampScale) / 1e9
                    : null,
        };
    }

    private block(body: Uint8Array, key: boolean) {
        if (!this.header) return;
        const num = readSize(body, 0);
        if (!num || num.size === null) throw new Error("Bad block header");
        const out = this.byNumber.get(num.size);
        if (!out) return;
        let p = num.length;
        if (body.length < p + 3) throw new Error("Short block");
        const rel = ((body[p] << 24) | (body[p + 1] << 16)) >> 16;
        const flags = body[p + 2];
        p += 3;
        const pts = (this.clusterTs + rel) * this.timestampScale;
        const frames = splitLaces(body, p, (flags >> 1) & 3);
        frames.forEach((f, i) => {
            this.addSample(
                out,
                f.slice(),
                i === 0
                    ? pts
                    : out.frameNs !== null
                      ? pts + i * out.frameNs
                      : null,
                key,
            );
        });
        this.flush(false);
    }

    private addSample(
        out: OutTrack,
        data: Uint8Array,
        pts: number | null,
        key: boolean,
    ) {
        if (out.kind === "video") {
            // MediaSource has to start a track on a keyframe.
            if (pts === null || (!out.started && !key)) return;
            out.started = true;
            out.firstPts ??= pts;
            out.samples.push({ data, pts, key });
            insertSorted(out.pool, pts);
            while (out.samples.length - out.assigned > REORDER_DEPTH) {
                out.samples[out.assigned++].dts = out.pool.shift()!;
            }
            return;
        }
        if (pts !== null) {
            out.firstPts ??= pts;
            placeLaced(out.samples, pts);
        }
        out.samples.push({ data, pts, key: true });
    }

    private flush(final: boolean) {
        const video = this.outs.find((t) => t.kind === "video");
        const audio = this.outs.find((t) => t.kind === "audio");
        if (final && video) {
            while (video.assigned < video.samples.length) {
                video.samples[video.assigned++].dts = video.pool.shift()!;
            }
        }
        if (this.offsetNs === null) {
            // Presentation is pushed back by the largest gap between when a
            // frame is decoded and when it is shown, so no frame is shown
            // before it is decoded; and the whole timeline shifts so the
            // earliest timestamp isn't negative. Both are fixed from the
            // first video batch: later fragments must agree with it.
            if (video) {
                if (!final && video.assigned < VIDEO_BATCH) return;
                let delay = 0;
                for (let i = 0; i < video.assigned; i++) {
                    const s = video.samples[i];
                    delay = Math.max(delay, s.dts! - s.pts!);
                }
                this.videoDelayNs = delay;
            } else if (!final && audio?.firstPts == null) {
                return;
            }
            const firsts = [video?.firstPts, audio?.firstPts].filter(
                (v): v is number => typeof v === "number",
            );
            const min = firsts.length ? Math.min(...firsts) : 0;
            this.offsetNs = this.videoDelayNs + Math.max(0, -min);
        }
        this.outs.forEach((t, i) => this.write(t, i, final));
    }

    private write(t: OutTrack, index: number, final: boolean) {
        const offset = this.offsetNs!;
        const tick = (ns: number) =>
            Math.max(0, Math.round(((ns + offset) / 1e9) * t.timescale));
        const dtsOf = (s: Sample) => {
            if (s.dtsT === undefined) {
                let d = tick(
                    t.kind === "video" ? s.dts! - this.videoDelayNs : s.pts!,
                );
                if (d <= t.lastDtsT) d = t.lastDtsT + 1;
                s.dtsT = d;
                t.lastDtsT = d;
            }
            return s.dtsT;
        };

        let ready: number;
        if (t.kind === "video") {
            ready = t.assigned;
        } else {
            if (final) placeTrailing(t);
            ready = t.samples.findIndex((s) => s.pts === null);
            if (ready < 0) ready = t.samples.length;
        }
        // Each sample's duration runs to the next one's decode time, so the
        // last ready sample waits for its successor unless the file is over.
        const count = final ? ready : ready - 1;
        const batch = t.kind === "video" ? VIDEO_BATCH : AUDIO_BATCH;
        if (count <= 0 || (!final && count < batch)) return;

        const rows: TrunRow[] = [];
        let bytes = 0;
        for (let i = 0; i < count; i++) {
            const s = t.samples[i];
            const dts = dtsOf(s);
            const next = t.samples[i + 1];
            let dur: number;
            if (
                next &&
                (t.kind === "audio" ? next.pts !== null : i + 1 < ready)
            ) {
                dur = dtsOf(next) - dts;
            } else {
                dur =
                    t.lastDur ||
                    Math.round(((t.frameNs ?? 20e6) / 1e9) * t.timescale);
            }
            t.lastDur = dur;
            rows.push({
                duration: dur,
                size: s.data.length,
                flags: s.key ? 0x02000000 : 0x01010000,
                cts: t.kind === "video" ? tick(s.pts!) - dts : 0,
            });
            bytes += s.data.length;
        }
        const written = t.samples.splice(0, count);
        if (t.kind === "video") t.assigned -= count;
        this.segments.push({
            track: index,
            buffer: fragment(t.seq++, written[0].dtsT!, rows, written, bytes),
        });
    }
}

/** Give laced frames that arrived without a timestamp an even share of the
 *  time up to `pts`, the next frame that has one. */
function placeLaced(samples: Sample[], pts: number) {
    let i = samples.length;
    while (i > 0 && samples[i - 1].pts === null) i--;
    if (i === samples.length || i === 0) return;
    const from = samples[i - 1].pts!;
    const step = (pts - from) / (samples.length - i + 1);
    for (let k = i; k < samples.length; k++) {
        samples[k].pts = from + step * (k - i + 1);
    }
}

/** At the end of the file, place laced frames nothing followed. */
function placeTrailing(t: OutTrack) {
    const step = t.frameNs ?? 20e6;
    for (let i = 0; i < t.samples.length; i++) {
        const s = t.samples[i];
        if (s.pts === null) {
            s.pts = i > 0 ? t.samples[i - 1].pts! + step : 0;
        }
    }
}

function insertSorted(arr: number[], v: number) {
    let i = arr.length;
    while (i > 0 && arr[i - 1] > v) i--;
    arr.splice(i, 0, v);
}

function hasKeyFlag(body: Uint8Array): boolean {
    const num = readSize(body, 0);
    if (!num) return false;
    return (body[num.length + 2] & 0x80) !== 0;
}

/** The frames of one block: 0 none, 1 Xiph, 2 fixed, 3 EBML lacing. */
function splitLaces(b: Uint8Array, p: number, lacing: number): Uint8Array[] {
    if (lacing === 0) return [b.subarray(p)];
    if (p >= b.length) throw new Error("Bad lacing");
    const count = b[p++] + 1;
    const sizes: number[] = [];
    if (lacing === 1) {
        for (let i = 0; i < count - 1; i++) {
            let s = 0;
            let v: number;
            do {
                if (p >= b.length) throw new Error("Bad lacing");
                v = b[p++];
                s += v;
            } while (v === 255);
            sizes.push(s);
        }
    } else if (lacing === 3) {
        for (let i = 0; i < count - 1; i++) {
            const r = readSize(b, p);
            if (!r || r.size === null) throw new Error("Bad lacing");
            p += r.length;
            sizes.push(
                i === 0
                    ? r.size
                    : sizes[i - 1] + r.size - (2 ** (7 * r.length - 1) - 1),
            );
        }
    } else {
        const each = (b.length - p) / count;
        if (!Number.isInteger(each)) throw new Error("Bad lacing");
        for (let i = 0; i < count - 1; i++) sizes.push(each);
    }
    const used = sizes.reduce((a, s) => a + s, 0);
    if (sizes.some((s) => s < 0) || used > b.length - p) {
        throw new Error("Bad lacing");
    }
    sizes.push(b.length - p - used);
    return sizes.map((s) => {
        const f = b.subarray(p, p + s);
        p += s;
        return f;
    });
}

function readUint(b: Uint8Array): number {
    let v = 0;
    for (const x of b) v = v * 256 + x;
    return v;
}

function readFloat(b: Uint8Array): number {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    if (b.length === 4) return dv.getFloat32(0);
    if (b.length === 8) return dv.getFloat64(0);
    return 0;
}

// --- Track description -------------------------------------------------

interface TrackPlan {
    kind: "video" | "audio";
    mime: string;
    timescale: number;
    frameNs: number | null;
    /** The stsd sample entry. */
    entry: Uint8Array;
}

const hex2 = (n: number) => n.toString(16).padStart(2, "0");

function describeTrack(e: TrackEntry): TrackPlan | null {
    const cp = e.codecPrivate;
    if (e.type === TRACK_VIDEO) {
        let codec: string;
        let entry: Uint8Array;
        if (e.codecId === "V_MPEG4/ISO/AVC" && cp && cp.length >= 7) {
            codec = `avc1.${hex2(cp[1])}${hex2(cp[2])}${hex2(cp[3])}`;
            entry = visualEntry("avc1", e, box("avcC", cp));
        } else if (e.codecId === "V_MPEGH/ISO/HEVC" && cp && cp.length >= 23) {
            codec = hevcCodec(cp);
            entry = visualEntry("hvc1", e, box("hvcC", cp));
        } else if (e.codecId === "V_AV1" && cp && cp.length >= 4) {
            codec = av1Codec(cp);
            entry = visualEntry("av01", e, box("av1C", cp));
        } else {
            return null;
        }
        return {
            kind: "video",
            mime: `video/mp4; codecs="${codec}"`,
            timescale: VIDEO_TIMESCALE,
            frameNs: e.defaultDuration,
            entry,
        };
    }

    const rate = e.sampleRate > 0 ? e.sampleRate : 48000;
    let codec: string;
    let entry: Uint8Array;
    let timescale = rate;
    let frameNs = e.defaultDuration;
    if (e.codecId.startsWith("A_AAC")) {
        const asc =
            cp && cp.length >= 2 ? cp : aacConfig(e.codecId, rate, e.channels);
        if (!asc) return null;
        let aot = asc[0] >> 3;
        if (aot === 31) aot = 32 + (((asc[0] & 7) << 3) | (asc[1] >> 5));
        codec = `mp4a.40.${aot}`;
        entry = audioEntry("mp4a", e.channels, rate, esds(asc));
        frameNs ??= (1024 / rate) * 1e9;
    } else if (e.codecId === "A_OPUS" && cp && isOpusHead(cp)) {
        codec = "opus";
        timescale = 48000;
        entry = audioEntry("Opus", cp[9], 48000, dOps(cp));
    } else if (
        e.codecId === "A_FLAC" &&
        cp &&
        cp.length > 4 &&
        String.fromCharCode(cp[0], cp[1], cp[2], cp[3]) === "fLaC"
    ) {
        codec = "flac";
        entry = audioEntry(
            "fLaC",
            e.channels,
            rate,
            fullBox("dfLa", 0, 0, cp.subarray(4)),
        );
    } else {
        return null;
    }
    return {
        kind: "audio",
        mime: `audio/mp4; codecs="${codec}"`,
        timescale,
        frameNs,
        entry,
    };
}

/** `hvc1.<profile>.<compat>.<tier><level>.<constraints>` (ISO 14496-15 E.3). */
function hevcCodec(cp: Uint8Array): string {
    const space = cp[1] >> 6;
    const tier = (cp[1] >> 5) & 1;
    const profile = cp[1] & 0x1f;
    const compat = ((cp[2] << 24) | (cp[3] << 16) | (cp[4] << 8) | cp[5]) >>> 0;
    let reversed = 0;
    for (let i = 0; i < 32; i++)
        reversed = (reversed << 1) | ((compat >>> i) & 1);
    const constraints = Array.from(cp.subarray(6, 12));
    while (constraints.length && constraints[constraints.length - 1] === 0) {
        constraints.pop();
    }
    return [
        `hvc1.${["", "A", "B", "C"][space]}${profile}`,
        (reversed >>> 0).toString(16),
        `${tier ? "H" : "L"}${cp[12]}`,
        ...constraints.map((c) => c.toString(16)),
    ].join(".");
}

/** `av01.<profile>.<level><tier>.<bitdepth>` from an av1C record. */
function av1Codec(cp: Uint8Array): string {
    const profile = cp[1] >> 5;
    const level = cp[1] & 0x1f;
    const tier = cp[2] >> 7;
    const high = (cp[2] >> 6) & 1;
    const twelve = (cp[2] >> 5) & 1;
    const depth = high ? (twelve ? 12 : 10) : 8;
    return `av01.${profile}.${String(level).padStart(2, "0")}${tier ? "H" : "M"}.${String(depth).padStart(2, "0")}`;
}

const AAC_RATES = [
    96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025,
    8000, 7350,
];

/** An AudioSpecificConfig for old-style `A_AAC/MPEG4/LC` tracks that carry
 *  no CodecPrivate. */
function aacConfig(
    codecId: string,
    rate: number,
    channels: number,
): Uint8Array | null {
    const index = AAC_RATES.indexOf(rate);
    if (index < 0) return null;
    const aot = codecId.endsWith("/MAIN") ? 1 : 2;
    const v = (aot << 11) | (index << 7) | (channels << 3);
    return new Uint8Array([v >> 8, v & 0xff]);
}

function isOpusHead(cp: Uint8Array): boolean {
    return (
        cp.length >= 19 &&
        new TextDecoder("latin1").decode(cp.subarray(0, 8)) === "OpusHead"
    );
}

/** OpusHead (little-endian, Ogg) to dOps (big-endian, MP4). */
function dOps(cp: Uint8Array): Uint8Array {
    const channels = cp[9];
    const family = cp[18];
    return box(
        "dOps",
        [0, channels, cp[11], cp[10], cp[15], cp[14], cp[13], cp[12]],
        [cp[17], cp[16], family],
        family !== 0 ? cp.subarray(19, 21 + channels) : [],
    );
}

// --- Box writing -------------------------------------------------------

type Part = Uint8Array | number[];

const u16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const u32 = (n: number) => [
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff,
];
const u64 = (n: number) => [...u32(Math.floor(n / 2 ** 32)), ...u32(n >>> 0)];
const zeros = (n: number) => new Array<number>(n).fill(0);
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

function concat(parts: Part[]): Uint8Array {
    let n = 0;
    for (const p of parts) n += p.length;
    const out = new Uint8Array(n);
    let at = 0;
    for (const p of parts) {
        out.set(p, at);
        at += p.length;
    }
    return out;
}

function box(type: string, ...parts: Part[]): Uint8Array {
    const body = concat(parts);
    return concat([u32(body.length + 8), ascii(type), body]);
}

function fullBox(
    type: string,
    version: number,
    flags: number,
    ...parts: Part[]
): Uint8Array {
    return box(type, [version, ...u32(flags).slice(1)], ...parts);
}

const MATRIX = [0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000].flatMap(u32);

function visualEntry(type: string, e: TrackEntry, config: Uint8Array) {
    return box(
        type,
        zeros(6),
        u16(1),
        zeros(16),
        u16(e.width),
        u16(e.height),
        u32(0x00480000),
        u32(0x00480000),
        u32(0),
        u16(1),
        zeros(32),
        u16(0x18),
        u16(0xffff),
        config,
    );
}

function audioEntry(
    type: string,
    channels: number,
    rate: number,
    config: Uint8Array,
) {
    return box(
        type,
        zeros(6),
        u16(1),
        zeros(8),
        u16(channels),
        u16(16),
        zeros(4),
        u32(rate < 65536 ? rate * 65536 : 0),
        config,
    );
}

function descriptor(tag: number, body: Part[]): number[] {
    const b = concat(body);
    const n = b.length;
    return [
        tag,
        0x80 | ((n >> 21) & 0x7f),
        0x80 | ((n >> 14) & 0x7f),
        0x80 | ((n >> 7) & 0x7f),
        n & 0x7f,
        ...b,
    ];
}

/** An AAC esds: object type 0x40 (MPEG-4 audio), the ASC as its config. */
function esds(asc: Uint8Array): Uint8Array {
    const decoder = descriptor(0x04, [
        [0x40, 0x15, 0, 0, 0],
        u32(0),
        u32(0),
        descriptor(0x05, [asc]),
    ]);
    return fullBox(
        "esds",
        0,
        0,
        descriptor(0x03, [u16(1), [0], decoder, descriptor(0x06, [[0x02]])]),
    );
}

function initSegment(plan: TrackPlan, e: TrackEntry): ArrayBuffer {
    const isVideo = plan.kind === "video";
    const moov = box(
        "moov",
        fullBox(
            "mvhd",
            0,
            0,
            u32(0),
            u32(0),
            u32(1000),
            u32(0),
            u32(0x10000),
            u16(0x100),
            zeros(10),
            MATRIX,
            zeros(24),
            u32(2),
        ),
        box(
            "trak",
            fullBox(
                "tkhd",
                0,
                3,
                u32(0),
                u32(0),
                u32(1),
                u32(0),
                u32(0),
                zeros(8),
                u16(0),
                u16(0),
                u16(isVideo ? 0 : 0x100),
                u16(0),
                MATRIX,
                u32(isVideo ? e.width * 65536 : 0),
                u32(isVideo ? e.height * 65536 : 0),
            ),
            box(
                "mdia",
                fullBox(
                    "mdhd",
                    0,
                    0,
                    u32(0),
                    u32(0),
                    u32(plan.timescale),
                    u32(0),
                    u16(0x55c4), // "und"
                    u16(0),
                ),
                fullBox(
                    "hdlr",
                    0,
                    0,
                    u32(0),
                    ascii(isVideo ? "vide" : "soun"),
                    zeros(12),
                    ascii(isVideo ? "VideoHandler" : "SoundHandler"),
                    [0],
                ),
                box(
                    "minf",
                    isVideo
                        ? fullBox("vmhd", 0, 1, zeros(8))
                        : fullBox("smhd", 0, 0, zeros(4)),
                    box(
                        "dinf",
                        fullBox("dref", 0, 0, u32(1), fullBox("url ", 0, 1)),
                    ),
                    box(
                        "stbl",
                        fullBox("stsd", 0, 0, u32(1), plan.entry),
                        fullBox("stts", 0, 0, u32(0)),
                        fullBox("stsc", 0, 0, u32(0)),
                        fullBox("stsz", 0, 0, u32(0), u32(0)),
                        fullBox("stco", 0, 0, u32(0)),
                    ),
                ),
            ),
        ),
        box("mvex", fullBox("trex", 0, 0, u32(1), u32(1), zeros(12))),
    );
    const ftyp = box(
        "ftyp",
        ascii("isom"),
        u32(0x200),
        ascii("isom"),
        ascii("iso6"),
        ascii("mp41"),
    );
    return concat([ftyp, moov]).buffer as ArrayBuffer;
}

interface TrunRow {
    duration: number;
    size: number;
    flags: number;
    cts: number;
}

/** moof+mdat for one run of samples of one track. */
function fragment(
    seq: number,
    baseDts: number,
    rows: TrunRow[],
    samples: Sample[],
    bytes: number,
): ArrayBuffer {
    const moof = (dataOffset: number) =>
        box(
            "moof",
            fullBox("mfhd", 0, 0, u32(seq)),
            box(
                "traf",
                // default-base-is-moof: data_offset counts from the moof.
                fullBox("tfhd", 0, 0x020000, u32(1)),
                fullBox("tfdt", 1, 0, u64(baseDts)),
                // version 1: signed composition offsets.
                fullBox(
                    "trun",
                    1,
                    0x000f01,
                    u32(rows.length),
                    u32(dataOffset),
                    rows.flatMap((r) => [
                        ...u32(r.duration),
                        ...u32(r.size),
                        ...u32(r.flags),
                        ...u32(r.cts),
                    ]),
                ),
            ),
        );
    const head = moof(moof(0).length + 8);
    const out = new Uint8Array(head.length + 8 + bytes);
    out.set(head, 0);
    out.set([...u32(bytes + 8), ...ascii("mdat")], head.length);
    let at = head.length + 8;
    for (const s of samples) {
        out.set(s.data, at);
        at += s.data.length;
    }
    return out.buffer;
}
