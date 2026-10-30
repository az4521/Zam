import {
    audioEntry,
    flacBitsPerSample,
    fragment,
    fullBox,
    initSegment,
    type RemuxHeader,
    type RemuxSegment,
} from "./mkvRemux";
import { id3Size, isFlac } from "./flacProbe";

/**
 * Raw FLAC (a `.flac` file) to fragmented MP4, on the fly, for MediaSource.
 *
 * No browser has a FLAC SourceBuffer, but Chromium and Firefox both take
 * FLAC inside MP4 (`audio/mp4; codecs="flac"`). A FLAC file is the "fLaC"
 * marker, metadata blocks (STREAMINFO first), then frames back to back with
 * no index or length prefix, so the frames are found by their sync code. A
 * sync code can also turn up inside audio data, so a boundary only counts
 * when the header after it passes its CRC-8 and the frame before it passes
 * its CRC-16. The frames are then re-boxed unchanged, the STREAMINFO block
 * going into the init segment's dfLa box (ISO/IEC 14496-12 FLAC mapping).
 *
 * Same interface as MkvRemuxer: push() bytes as they arrive, take() the
 * fragments, end() at the end of the file. Anything this can't parse leaves
 * `unsupported` set before the first frame and the caller plays the file
 * whole instead.
 */

/** Frames per fragment: 8 frames of 4096 samples is about 0.75 s at 44.1 kHz,
 *  so playback can start on the first fragment. */
const FRAMES_PER_FRAGMENT = 8;
/** Never buffer more than this looking for a frame's end. Real frames are a
 *  few KB to a few tens of KB. */
const MAX_FRAME = 1024 * 1024;
const STREAMINFO_TYPE = 0;
export const STREAMINFO_LENGTH = 34;

const CRC8 = (() => {
    const t = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++)
            c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
        t[i] = c;
    }
    return t;
})();

const CRC16 = (() => {
    const t = new Uint16Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i << 8;
        for (let k = 0; k < 8; k++)
            c = c & 0x8000 ? ((c << 1) ^ 0x8005) & 0xffff : (c << 1) & 0xffff;
        t[i] = c;
    }
    return t;
})();

export function crc8(b: Uint8Array, from: number, to: number): number {
    let c = 0;
    for (let i = from; i < to; i++) c = CRC8[c ^ b[i]];
    return c;
}

/** CRC-16 of `b[from..to]`; of a whole frame with its own trailing CRC
 *  included it is 0 when the frame is intact. */
export function crc16(b: Uint8Array, from: number, to: number): number {
    let c = 0;
    for (let i = from; i < to; i++)
        c = ((c << 8) & 0xffff) ^ CRC16[(c >> 8) ^ b[i]];
    return c;
}

interface FrameHeader {
    /** Header length in bytes, CRC-8 included. */
    length: number;
    /** Samples in the frame. */
    blockSize: number;
}

/**
 * Parse the frame header at b[p]. Null when it isn't one (bad sync, reserved
 * values, CRC-8 mismatch); "short" when more bytes are needed to tell.
 */
export function parseFrameHeader(
    b: Uint8Array,
    p: number,
    variable: boolean,
): FrameHeader | null | "short" {
    if (b.length - p < 4) return "short";
    if (b[p] !== 0xff || b[p + 1] !== (variable ? 0xf9 : 0xf8)) return null;
    const bsCode = b[p + 2] >> 4;
    const srCode = b[p + 2] & 0x0f;
    const chan = b[p + 3] >> 4;
    const ssCode = (b[p + 3] >> 1) & 0x07;
    if (bsCode === 0 || srCode === 15 || chan > 10 || ssCode === 3) return null;
    if (b[p + 3] & 1) return null;
    let q = p + 4;
    // The frame/sample number, UTF-8 style: 1 to 7 bytes.
    if (q >= b.length) return "short";
    const lead = b[q];
    let extra: number;
    if (lead < 0x80) extra = 0;
    else if ((lead & 0xe0) === 0xc0) extra = 1;
    else if ((lead & 0xf0) === 0xe0) extra = 2;
    else if ((lead & 0xf8) === 0xf0) extra = 3;
    else if ((lead & 0xfc) === 0xf8) extra = 4;
    else if ((lead & 0xfe) === 0xfc) extra = 5;
    else if (lead === 0xfe) extra = 6;
    else return null;
    q++;
    if (q + extra > b.length) return "short";
    for (let i = 0; i < extra; i++) if ((b[q + i] & 0xc0) !== 0x80) return null;
    q += extra;
    let blockSize: number;
    if (bsCode === 1) blockSize = 192;
    else if (bsCode <= 5) blockSize = 576 << (bsCode - 2);
    else if (bsCode === 6) {
        if (q + 1 > b.length) return "short";
        blockSize = b[q] + 1;
        q += 1;
    } else if (bsCode === 7) {
        if (q + 2 > b.length) return "short";
        blockSize = ((b[q] << 8) | b[q + 1]) + 1;
        q += 2;
    } else blockSize = 256 << (bsCode - 8);
    if (srCode === 12) q += 1;
    else if (srCode === 13 || srCode === 14) q += 2;
    if (q + 1 > b.length) return "short";
    if (crc8(b, p, q) !== b[q]) return null;
    return { length: q + 1 - p, blockSize };
}

/** The init segment and duration for a FLAC stream with this STREAMINFO. */
export function flacHeader(si: Uint8Array): RemuxHeader {
    const rate = (si[10] << 12) | (si[11] << 4) | (si[12] >> 4);
    const channels = ((si[12] >> 1) & 0x07) + 1;
    const total =
        (si[13] & 0x0f) * 2 ** 32 +
        ((si[14] << 24) >>> 0) +
        (si[15] << 16) +
        (si[16] << 8) +
        si[17];
    if (!rate) throw new Error("FLAC sample rate unknown");
    // dfLa holds metadata blocks; STREAMINFO alone, flagged as the last.
    const dfLa = fullBox("dfLa", 0, 0, [0x80, 0, 0, STREAMINFO_LENGTH], si);
    const init = initSegment(
        {
            kind: "audio",
            mime: 'audio/mp4; codecs="flac"',
            timescale: rate,
            frameNs: null,
            entry: audioEntry(
                "fLaC",
                channels,
                rate,
                dfLa,
                flacBitsPerSample(si),
            ),
        },
        { width: 0, height: 0 },
    );
    return {
        tracks: [{ kind: "audio", mime: 'audio/mp4; codecs="flac"', init }],
        duration: total > 0 ? total / rate : null,
    };
}

/** See the file header. Feed with push(), finish with end(). */
export class FlacRemuxer {
    /** Set once STREAMINFO is read and the first frame is in sight. */
    header: RemuxHeader | null = null;
    /** Why the file can't be remuxed; set instead of `header`. */
    unsupported: string | null = null;

    private buf = new Uint8Array(0);
    private ended = false;
    /** Bytes still to drop (an ID3 tag, a big metadata block). */
    private skip = 0;
    private stage: "start" | "meta" | "frames" = "start";
    private streamInfo: Uint8Array | null = null;
    private variable = false;
    /** Where to resume the sync search inside the current frame. */
    private scanFrom = 0;
    private current: FrameHeader | null = null;
    private frames: { data: Uint8Array; blockSize: number }[] = [];
    private segments: RemuxSegment[] = [];
    private seq = 1;
    private dts = 0;

    push(chunk: Uint8Array) {
        if (this.unsupported || this.ended || chunk.length === 0) return;
        if (this.skip > 0) {
            const drop = Math.min(this.skip, chunk.length);
            this.skip -= drop;
            chunk = chunk.subarray(drop);
            if (chunk.length === 0) return;
        }
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
        if (!this.header) {
            this.unsupported = "No FLAC frames in file";
            return;
        }
        // Whatever is left is the last frame; keep it only if it is whole.
        if (
            this.current &&
            this.buf.length > this.current.length + 2 &&
            crc16(this.buf, 0, this.buf.length) === 0
        )
            this.frames.push({
                data: this.buf,
                blockSize: this.current.blockSize,
            });
        this.buf = new Uint8Array(0);
        this.flush();
    }

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

    private consume(n: number) {
        if (n >= this.buf.length) {
            this.skip += n - this.buf.length;
            this.buf = new Uint8Array(0);
        } else this.buf = this.buf.subarray(n);
    }

    private parse() {
        if (this.stage === "start") {
            if (this.buf.length < 10) {
                if (this.ended) throw new Error("Not a FLAC file");
                return;
            }
            const tag = id3Size(this.buf);
            if (tag > 0) {
                this.consume(tag);
                if (this.buf.length < 4) return;
            }
            if (!isFlac(this.buf)) throw new Error("Not a FLAC file");
            this.consume(4);
            this.stage = "meta";
        }
        while (this.stage === "meta") {
            if (this.buf.length < 4) return;
            const last = (this.buf[0] & 0x80) !== 0;
            const type = this.buf[0] & 0x7f;
            const len = (this.buf[1] << 16) | (this.buf[2] << 8) | this.buf[3];
            if (type === STREAMINFO_TYPE) {
                if (len !== STREAMINFO_LENGTH)
                    throw new Error("Bad FLAC STREAMINFO");
                if (this.buf.length < 4 + len) return;
                this.streamInfo = this.buf.slice(4, 4 + len);
            } else if (!this.streamInfo) {
                throw new Error("FLAC STREAMINFO missing");
            }
            // Anything else (cover art, tags) is dropped, even before it
            // has all arrived.
            this.consume(4 + len);
            if (last) this.stage = "frames";
        }
        if (!this.header) {
            if (this.buf.length < 2) return;
            if (this.buf[0] !== 0xff || (this.buf[1] & 0xfe) !== 0xf8)
                throw new Error("No FLAC frame after metadata");
            this.variable = this.buf[1] === 0xf9;
            this.header = this.makeHeader();
        }
        this.scanFrames();
    }

    private makeHeader(): RemuxHeader {
        return flacHeader(this.streamInfo!);
    }

    private scanFrames() {
        for (;;) {
            if (!this.current) {
                const h = parseFrameHeader(this.buf, 0, this.variable);
                if (h === "short") return;
                if (h === null) throw new Error("Lost FLAC frame sync");
                this.current = h;
                this.scanFrom = h.length;
            }
            const buf = this.buf;
            let found = -1;
            let p = this.scanFrom;
            for (; p + 1 < buf.length; p++) {
                if (buf[p] !== 0xff || (buf[p + 1] & 0xfe) !== 0xf8) continue;
                const h = parseFrameHeader(buf, p, this.variable);
                if (h === "short") break;
                if (h === null) continue;
                if (crc16(buf, 0, p) !== 0) continue;
                found = p;
                break;
            }
            if (found < 0) {
                this.scanFrom = Math.max(this.current.length, p);
                if (buf.length > MAX_FRAME)
                    throw new Error("FLAC frame too large");
                return;
            }
            this.frames.push({
                data: buf.slice(0, found),
                blockSize: this.current.blockSize,
            });
            this.buf = buf.subarray(found);
            this.current = null;
            if (this.frames.length >= FRAMES_PER_FRAGMENT) this.flush();
        }
    }

    private flush() {
        if (this.frames.length === 0) return;
        const frames = this.frames;
        this.frames = [];
        let bytes = 0;
        for (const f of frames) bytes += f.data.length;
        const rows = frames.map((f) => ({
            duration: f.blockSize,
            size: f.data.length,
            flags: 0x02000000,
            cts: 0,
        }));
        this.segments.push({
            track: 0,
            buffer: fragment(this.seq++, this.dts, rows, frames, bytes),
        });
        for (const f of frames) this.dts += f.blockSize;
    }
}
