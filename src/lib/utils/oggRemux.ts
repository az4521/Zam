/**
 * Ogg Opus and Ogg Vorbis to WebM, on the fly, for MediaSource.
 *
 * No browser has an Ogg SourceBuffer, but Opus and Vorbis are both valid WebM
 * codecs, and the packets inside are the same bytes in either container. So
 * this walks the Ogg pages, pulls the packets out, and writes them again as a
 * WebM: an EBML header, a Segment of unknown size, Info, Tracks (the codec
 * private data built from the Ogg header packets), then one Cluster per Ogg
 * page of SimpleBlocks. The output is a plain WebM byte stream for the
 * SourceBuffer, indexed for seeking like any other (seekIndex.ts WebmIndex).
 *
 * Timestamps: an Opus packet says how long it is in its first byte, so those
 * are exact. A Vorbis packet does not without decoding the codec's setup, so
 * the packets finishing on a page share the span between that page's granule
 * position and the previous one's; players only need them to run in step with
 * the audio, which they do to within a packet.
 *
 * One logical audio stream per file. A chained or multiplexed Ogg (video
 * along with the audio, FLAC in Ogg, Speex) leaves `unsupported` set before
 * any output and the caller plays the file whole instead.
 *
 * Feed with push(), finish with end(), collect with take().
 */
import { isOgg } from "./audioProbe";

const OPUS_RATE = 48000;
/** Matroska's recommended pre-roll for Opus, in ns. */
const OPUS_SEEK_PRE_ROLL_NS = 80_000_000;
/** A Cluster's block times are 16-bit milliseconds from its own start. */
const MAX_CLUSTER_SPAN_MS = 30_000;
/** Pages are at most 255 * 255 + 282 bytes; no packet is worth more than a
 *  few. Past this a stream is not one we should hold in memory. */
const MAX_PENDING_BYTES = 8 * 1024 * 1024;

// ------------------------------------------------------------ EBML writing

type Bytes = number[] | Uint8Array;

function concat(parts: Bytes[]): Uint8Array {
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

/** An EBML data size: the shortest vint that holds `n`. */
function vint(n: number): number[] {
    for (let len = 1; len <= 8; len++) {
        if (n < 2 ** (7 * len) - 1) {
            const out: number[] = [];
            let rest = n;
            for (let i = 0; i < len; i++) {
                out.unshift(rest % 256);
                rest = Math.floor(rest / 256);
            }
            out[0] |= 0x80 >> (len - 1);
            return out;
        }
    }
    throw new Error("EBML size too large");
}

function idBytes(id: number): number[] {
    const out: number[] = [];
    for (let v = id; v > 0; v = Math.floor(v / 256)) out.unshift(v % 256);
    return out;
}

function element(id: number, ...body: Bytes[]): Uint8Array {
    const data = concat(body);
    return concat([idBytes(id), vint(data.length), data]);
}

function uint(id: number, value: number): Uint8Array {
    const out: number[] = [];
    let rest = value;
    do {
        out.unshift(rest % 256);
        rest = Math.floor(rest / 256);
    } while (rest > 0);
    return element(id, out);
}

function float64(id: number, value: number): Uint8Array {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setFloat64(0, value);
    return element(id, b);
}

function text(id: number, value: string): Uint8Array {
    return element(
        id,
        Array.from(value, (c) => c.charCodeAt(0)),
    );
}

const ID = {
    EBML: 0x1a45dfa3,
    VERSION: 0x4286,
    READ_VERSION: 0x42f7,
    MAX_ID: 0x42f2,
    MAX_SIZE: 0x42f3,
    DOC_TYPE: 0x4282,
    DOC_VERSION: 0x4287,
    DOC_READ_VERSION: 0x4285,
    SEGMENT: 0x18538067,
    INFO: 0x1549a966,
    TIMESTAMP_SCALE: 0x2ad7b1,
    MUXING_APP: 0x4d80,
    WRITING_APP: 0x5741,
    TRACKS: 0x1654ae6b,
    TRACK_ENTRY: 0xae,
    TRACK_NUMBER: 0xd7,
    TRACK_UID: 0x73c5,
    TRACK_TYPE: 0x83,
    CODEC_ID: 0x86,
    CODEC_PRIVATE: 0x63a2,
    CODEC_DELAY: 0x56aa,
    SEEK_PRE_ROLL: 0x56bb,
    AUDIO: 0xe1,
    SAMPLING_FREQUENCY: 0xb5,
    CHANNELS: 0x9f,
    CLUSTER: 0x1f43b675,
    CLUSTER_TIMESTAMP: 0xe7,
    SIMPLE_BLOCK: 0xa3,
};

interface Block {
    /** Milliseconds from the start of the stream. */
    ms: number;
    data: Uint8Array;
}

// -------------------------------------------------------------- Opus timing

/** Samples at 48 kHz in the Opus packet whose first byte is `toc` (RFC 6716
 *  section 3.1), counting the frames of a code 3 packet from its second. */
export function opusPacketSamples(packet: Uint8Array): number {
    if (packet.length === 0) return 0;
    const toc = packet[0];
    const config = toc >> 3;
    let frame: number; // samples at 48 kHz
    if (config < 12) frame = [480, 960, 1920, 2880][config & 3];
    else if (config < 16) frame = (config & 1) === 0 ? 480 : 960;
    else frame = [120, 240, 480, 960][config & 3];
    const code = toc & 3;
    let frames = 1;
    if (code === 1 || code === 2) frames = 2;
    else if (code === 3) {
        if (packet.length < 2) return 0;
        frames = packet[1] & 0x3f;
    }
    return frame * frames;
}

// ------------------------------------------------------------------ Remuxer

type Codec = "opus" | "vorbis";

/** See the file header. */
export class OggWebmRemuxer {
    /** The MediaSource MIME type, set once the codec headers are read. */
    mime: string | null = null;
    /** Why the file can't be remuxed; set instead of `mime`. */
    unsupported: string | null = null;

    private buf = new Uint8Array(0);
    private ended = false;
    private out: Uint8Array[] = [];
    /** Serial numbers of streams we looked at and are ignoring. */
    private foreign = new Set<number>();
    private serial: number | null = null;
    private codec: Codec | null = null;
    private headers: Uint8Array[] = [];
    private carry: number[] = [];
    private rate = OPUS_RATE;
    private channels = 0;
    private preSkip = 0;
    /** Packets awaiting a timestamp (Vorbis), or already stamped. */
    private pending: Uint8Array[] = [];
    private blocks: Block[] = [];
    /** Granule position of the last page that had one. */
    private lastGranule = 0;
    private samples = 0;
    private audioPackets = 0;
    private lastMs = 0;

    push(chunk: Uint8Array) {
        if (this.unsupported || this.ended || chunk.length === 0) return;
        const next = new Uint8Array(this.buf.length + chunk.length);
        next.set(this.buf);
        next.set(chunk, this.buf.length);
        this.buf = next;
        this.run();
    }

    end() {
        if (this.unsupported || this.ended) return;
        this.ended = true;
        this.run();
        if (this.unsupported) return;
        if (!this.mime) {
            this.unsupported = "No Ogg audio stream";
            return;
        }
        if (this.pending.length > 0) {
            // A truncated Vorbis stream: space the rest at the average packet
            // length so far.
            const avg = this.audioPackets
                ? Math.max(1, Math.round(this.samples / this.audioPackets))
                : 1024;
            const span = avg * this.pending.length;
            this.stamp(this.pending, this.lastGranule + span, span);
            this.pending = [];
        }
        this.emitCluster();
    }

    take(): Uint8Array[] {
        const o = this.out;
        this.out = [];
        return o;
    }

    private run() {
        try {
            this.parse();
        } catch (err) {
            if (this.mime) throw err;
            this.unsupported = err instanceof Error ? err.message : String(err);
        }
    }

    private parse() {
        for (;;) {
            const b = this.buf;
            if (b.length < 27) break;
            if (!isOgg(b)) throw new Error("Lost Ogg sync");
            const nSegs = b[26];
            if (b.length < 27 + nSegs) break;
            let bodyLen = 0;
            for (let i = 0; i < nSegs; i++) bodyLen += b[27 + i];
            const total = 27 + nSegs + bodyLen;
            if (b.length < total) {
                if (b.length > MAX_PENDING_BYTES)
                    throw new Error("Ogg page too large");
                break;
            }
            this.page(b.subarray(0, total), nSegs);
            this.buf = b.subarray(total);
        }
        if (this.ended && this.buf.length > 0 && !this.mime)
            throw new Error("Truncated Ogg file");
    }

    private page(p: Uint8Array, nSegs: number) {
        const view = new DataView(p.buffer, p.byteOffset, p.byteLength);
        const headerType = p[5];
        const lo = view.getUint32(6, true);
        const hi = view.getUint32(10, true);
        const granule =
            lo === 0xffffffff && hi === 0xffffffff ? -1 : hi * 2 ** 32 + lo;
        const serial = view.getUint32(14, true);
        const segStart = 27;
        let at = 27 + nSegs;
        const packets: Uint8Array[] = [];

        if (this.serial !== serial) {
            if (this.foreign.has(serial)) return;
            if (this.serial !== null) {
                // The audio stream is chosen; this is another one.
                this.foreign.add(serial);
                return;
            }
            if (!(headerType & 0x02)) throw new Error("Ogg has no start page");
            // First page of a logical stream: is it audio we know? A start
            // page holds just its one (short) first packet.
            const codec = this.identify(p.subarray(at, at + p[segStart]));
            if (!codec) {
                this.foreign.add(serial);
                return;
            }
            this.serial = serial;
            this.codec = codec;
        }

        for (let i = 0; i < nSegs; i++) {
            const len = p[segStart + i];
            for (let k = 0; k < len; k++) this.carry.push(p[at + k]);
            at += len;
            if (len < 255) {
                packets.push(Uint8Array.from(this.carry));
                this.carry = [];
            }
        }
        for (const packet of packets) this.packet(packet);
        if (this.mime && granule >= 0 && this.pending.length > 0) {
            this.stamp(this.pending, granule, granule - this.lastGranule);
            this.pending = [];
        }
        if (granule >= 0) this.lastGranule = granule;
        if (this.mime) this.emitCluster();
    }

    private identify(first: Uint8Array): Codec | null {
        const ascii = (from: number, to: number) =>
            String.fromCharCode(...first.subarray(from, to));
        if (first.length >= 19 && ascii(0, 8) === "OpusHead") return "opus";
        if (first.length >= 30 && first[0] === 1 && ascii(1, 7) === "vorbis")
            return "vorbis";
        return null;
    }

    private packet(packet: Uint8Array) {
        if (!this.mime) {
            this.headers.push(packet);
            const need = this.codec === "opus" ? 2 : 3;
            if (this.headers.length === need) this.start();
            return;
        }
        if (packet.length === 0) return;
        if (this.codec === "opus") {
            const dur = opusPacketSamples(packet);
            this.addBlock(this.samples, packet);
            this.samples += dur;
            this.audioPackets++;
        } else {
            this.pending.push(packet);
        }
    }

    /** Give each packet a time within `[granule - span, granule]`. */
    private stamp(packets: Uint8Array[], granule: number, span: number) {
        const from = Math.max(0, granule - Math.max(0, span));
        const n = packets.length;
        const width = Math.max(0, granule - from);
        for (let k = 0; k < n; k++) {
            this.addBlock(from + Math.floor((k * width) / n), packets[k]);
        }
        this.samples += width;
        this.audioPackets += n;
    }

    private addBlock(samples: number, data: Uint8Array) {
        const ms = Math.max(
            this.lastMs,
            Math.round((samples * 1000) / this.rate),
        );
        this.lastMs = ms;
        this.blocks.push({ ms, data });
    }

    /** The codec headers are in: write everything up to the first Cluster. */
    private start() {
        const [id, comment, setup] = this.headers;
        let codecPrivate: Uint8Array;
        let codecId: string;
        if (this.codec === "opus") {
            // OpusHead: version, channels, pre-skip, input rate, gain, mapping.
            if (id.length < 19) throw new Error("Bad OpusHead");
            this.channels = id[9];
            this.preSkip = id[10] | (id[11] << 8);
            this.rate = OPUS_RATE;
            codecPrivate = id;
            codecId = "A_OPUS";
            this.mime = 'audio/webm; codecs="opus"';
        } else {
            if (new DataView(id.buffer, id.byteOffset).getUint32(7, true) !== 0)
                throw new Error("Unknown Vorbis version");
            this.channels = id[11];
            this.rate = new DataView(id.buffer, id.byteOffset).getUint32(
                12,
                true,
            );
            if (!this.rate) throw new Error("Vorbis sample rate unknown");
            const lace = (n: number) => {
                const out: number[] = [];
                for (let r = n; r >= 255; r -= 255) out.push(255);
                out.push(n % 255);
                return out;
            };
            codecPrivate = concat([
                [2],
                lace(id.length),
                lace(comment.length),
                id,
                comment,
                setup,
            ]);
            codecId = "A_VORBIS";
            this.mime = 'audio/webm; codecs="vorbis"';
        }
        if (this.channels < 1) throw new Error("Ogg stream has no channels");
        const entry = element(
            ID.TRACK_ENTRY,
            uint(ID.TRACK_NUMBER, 1),
            uint(ID.TRACK_UID, 1),
            uint(ID.TRACK_TYPE, 2),
            text(ID.CODEC_ID, codecId),
            ...(this.codec === "opus"
                ? [
                      uint(
                          ID.CODEC_DELAY,
                          Math.round((this.preSkip * 1e9) / OPUS_RATE),
                      ),
                      uint(ID.SEEK_PRE_ROLL, OPUS_SEEK_PRE_ROLL_NS),
                  ]
                : []),
            element(ID.CODEC_PRIVATE, codecPrivate),
            element(
                ID.AUDIO,
                float64(ID.SAMPLING_FREQUENCY, this.rate),
                uint(ID.CHANNELS, this.channels),
            ),
        );
        this.out.push(
            element(
                ID.EBML,
                uint(ID.VERSION, 1),
                uint(ID.READ_VERSION, 1),
                uint(ID.MAX_ID, 4),
                uint(ID.MAX_SIZE, 8),
                text(ID.DOC_TYPE, "webm"),
                uint(ID.DOC_VERSION, 4),
                uint(ID.DOC_READ_VERSION, 2),
            ),
            // The Segment's size is unknown: eight bytes of 1s after the ID.
            concat([
                idBytes(ID.SEGMENT),
                [0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
            ]),
            element(
                ID.INFO,
                uint(ID.TIMESTAMP_SCALE, 1_000_000),
                text(ID.MUXING_APP, "zam"),
                text(ID.WRITING_APP, "zam"),
            ),
            element(ID.TRACKS, entry),
        );
        this.headers = [];
    }

    /** Write the blocks stamped so far as Clusters. */
    private emitCluster() {
        const blocks = this.blocks;
        this.blocks = [];
        let i = 0;
        while (i < blocks.length) {
            const start = blocks[i].ms;
            const parts: Uint8Array[] = [uint(ID.CLUSTER_TIMESTAMP, start)];
            for (
                ;
                i < blocks.length &&
                blocks[i].ms - start <= MAX_CLUSTER_SPAN_MS;
                i++
            ) {
                const rel = blocks[i].ms - start;
                parts.push(
                    element(
                        ID.SIMPLE_BLOCK,
                        [0x81, (rel >> 8) & 0xff, rel & 0xff, 0x80],
                        blocks[i].data,
                    ),
                );
            }
            this.out.push(element(ID.CLUSTER, ...parts));
        }
    }
}
