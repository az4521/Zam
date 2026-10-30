import { fragment, type RemuxHeader, type RemuxSegment } from "./mkvRemux";
import { isWav } from "./audioProbe";
import { STREAMINFO_LENGTH, crc16, crc8, flacHeader } from "./flacRemux";

/**
 * A `.wav` file to fragmented MP4, on the fly, for MediaSource.
 *
 * No browser has a PCM SourceBuffer, but all of them play FLAC inside MP4
 * (`audio/mp4; codecs="flac"`), and FLAC can hold raw PCM unchanged: a VERBATIM
 * subframe is the samples as they are, big-endian, behind a one-byte header.
 * So the PCM is cut into blocks, each wrapped in a FLAC frame (frame header
 * and CRC-8, one verbatim subframe per channel, CRC-16), and re-boxed exactly
 * as flacRemux.ts does. Nothing is compressed and nothing is lost; the FLAC
 * decoder hands back the same samples.
 *
 * 8, 16 and 24-bit integer PCM with 1 to 8 channels, plain or in a
 * WAVE_FORMAT_EXTENSIBLE header. Floats, 32-bit, ADPCM and the rest leave
 * `unsupported` set and the caller plays the file whole instead.
 *
 * Same interface as FlacRemuxer: push() bytes as they arrive, take() the
 * fragments, end() at the end of the file.
 */

/** Samples per FLAC frame: block size code 12. */
const BLOCK = 4096;
const BLOCK_CODE = 12;
/** A frame shorter than BLOCK, for the tail: block size code 7 follows the
 *  frame number as 16 bits holding size - 1. */
const SHORT_CODE = 7;
/** A fragment is cut once it holds this many seconds of audio, so playback
 *  starts on the first quarter second whatever the sample rate. */
const FRAGMENT_SECONDS = 0.25;
const WAVE_FORMAT_PCM = 1;
const WAVE_FORMAT_EXTENSIBLE = 0xfffe;

/** A frame number as FLAC writes it: UTF-8 style, up to 6 bytes. */
function utf8Number(n: number): number[] {
    if (n < 0x80) return [n];
    const extra =
        n < 0x800
            ? 1
            : n < 0x10000
              ? 2
              : n < 0x200000
                ? 3
                : n < 0x4000000
                  ? 4
                  : 5;
    const out: number[] = [];
    let rest = n;
    for (let i = 0; i < extra; i++) {
        out.unshift(0x80 | (rest % 64));
        rest = Math.floor(rest / 64);
    }
    out.unshift(((0xff << (7 - extra)) & 0xff) | rest);
    return out;
}

interface Format {
    channels: number;
    rate: number;
    bits: number;
    /** Bytes per sample frame (all channels). */
    align: number;
}

/** See the file header. */
export class WavRemuxer {
    header: RemuxHeader | null = null;
    unsupported: string | null = null;

    private buf = new Uint8Array(0);
    private ended = false;
    private stage: "riff" | "chunks" | "data" = "riff";
    private fmt: Format | null = null;
    /** Bytes of sample data still to come, when the file says. */
    private dataLeft = Infinity;
    /** Total samples per channel, 0 when the file does not say. */
    private total = 0;
    /** Bytes still to drop (a chunk we do not use). */
    private skip = 0;
    private frameNo = 0;
    private frames: { data: Uint8Array; blockSize: number }[] = [];
    private pendingSamples = 0;
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
            this.unsupported = "No audio data in WAV";
            return;
        }
        // The tail: whole sample frames short of a full block.
        const fmt = this.fmt!;
        const whole = this.buf.length - (this.buf.length % fmt.align);
        if (whole > 0) this.addFrame(this.buf.subarray(0, whole));
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
        if (this.stage === "riff") {
            if (this.buf.length < 12) {
                if (this.ended) throw new Error("Not a WAV file");
                return;
            }
            if (!isWav(this.buf)) throw new Error("Not a WAV file");
            this.consume(12);
            this.stage = "chunks";
        }
        while (this.stage === "chunks") {
            if (this.buf.length < 8) {
                if (this.ended) throw new Error("WAV has no audio data");
                return;
            }
            const id = String.fromCharCode(
                this.buf[0],
                this.buf[1],
                this.buf[2],
                this.buf[3],
            );
            const view = new DataView(
                this.buf.buffer,
                this.buf.byteOffset,
                this.buf.byteLength,
            );
            const size = view.getUint32(4, true);
            if (id === "fmt ") {
                if (size < 16 || size > 1024)
                    throw new Error("Bad WAV fmt chunk");
                if (this.buf.length < 8 + size) return;
                this.fmt = this.readFormat(view, size);
                // Chunks are padded to an even length.
                this.consume(8 + size + (size & 1));
            } else if (id === "data") {
                if (!this.fmt) throw new Error("WAV data before fmt");
                this.consume(8);
                // 0 and 0xFFFFFFFF are what a streaming encoder writes.
                const known = size > 0 && size !== 0xffffffff;
                this.dataLeft = known ? size : Infinity;
                this.total = known ? Math.floor(size / this.fmt.align) : 0;
                this.header = this.makeHeader();
                this.stage = "data";
            } else {
                this.consume(8 + size + (size & 1));
            }
        }
        if (this.stage === "data") this.cutBlocks();
    }

    private readFormat(view: DataView, size: number): Format {
        let tag = view.getUint16(8, true);
        if (tag === WAVE_FORMAT_EXTENSIBLE && size >= 26)
            tag = view.getUint16(8 + 24, true);
        if (tag !== WAVE_FORMAT_PCM) throw new Error("WAV is not integer PCM");
        const channels = view.getUint16(10, true);
        const rate = view.getUint32(12, true);
        const bits = view.getUint16(22, true);
        if (channels < 1 || channels > 8)
            throw new Error("WAV channel count unsupported");
        if (bits !== 8 && bits !== 16 && bits !== 24)
            throw new Error("WAV bit depth unsupported");
        if (rate < 1 || rate > 655350) throw new Error("WAV rate unsupported");
        return { channels, rate, bits, align: channels * (bits / 8) };
    }

    private makeHeader(): RemuxHeader {
        const { channels, rate, bits } = this.fmt!;
        // STREAMINFO (RFC 9639 8.2): block sizes, frame sizes (0 = unknown),
        // 20-bit rate, channels - 1, bits - 1, 36-bit total, MD5 (unset).
        const si = new Uint8Array(STREAMINFO_LENGTH);
        const v = new DataView(si.buffer);
        v.setUint16(0, 16);
        v.setUint16(2, BLOCK);
        v.setUint32(
            10,
            (rate << 12) | ((channels - 1) << 9) | ((bits - 1) << 4),
        );
        // The top 4 bits of the 36-bit total share a byte with bits - 1.
        v.setUint8(
            13,
            (v.getUint8(13) & 0xf0) | (Math.floor(this.total / 2 ** 32) & 0x0f),
        );
        v.setUint32(14, this.total >>> 0);
        return flacHeader(si);
    }

    private cutBlocks() {
        const fmt = this.fmt!;
        const blockBytes = BLOCK * fmt.align;
        for (;;) {
            if (this.dataLeft <= 0) {
                // Whatever follows the data chunk (tags) is not audio.
                this.buf = new Uint8Array(0);
                return;
            }
            const avail = Math.min(this.buf.length, this.dataLeft);
            if (avail < blockBytes) {
                // Not a full block yet; the file's end says whether more is
                // coming, otherwise wait.
                if (this.dataLeft < blockBytes && avail === this.dataLeft)
                    this.takeBlock(avail - (avail % fmt.align));
                return;
            }
            this.takeBlock(blockBytes);
        }
    }

    private takeBlock(bytes: number) {
        if (bytes <= 0) return;
        this.addFrame(this.buf.subarray(0, bytes));
        this.buf = this.buf.subarray(bytes);
        this.dataLeft -= bytes;
        if (this.pendingSamples >= this.fmt!.rate * FRAGMENT_SECONDS)
            this.flush();
    }

    /** One FLAC frame of verbatim subframes for these interleaved samples. */
    private addFrame(pcm: Uint8Array) {
        const { channels, bits, align } = this.fmt!;
        const n = pcm.length / align;
        const bytesPer = bits / 8;
        const full = n === BLOCK;
        const head: number[] = [
            0xff,
            0xf8,
            ((full ? BLOCK_CODE : SHORT_CODE) << 4) | 0, // rate from STREAMINFO
            ((channels - 1) << 4) |
                ((bits === 8 ? 1 : bits === 16 ? 4 : 6) << 1),
            ...utf8Number(this.frameNo++),
        ];
        if (!full) head.push((n - 1) >> 8, (n - 1) & 0xff);
        const headBytes = Uint8Array.from(head);
        const out = new Uint8Array(
            head.length + 1 + channels * (1 + n * bytesPer) + 2,
        );
        out.set(headBytes, 0);
        let at = head.length;
        out[at++] = crc8(headBytes, 0, headBytes.length);
        for (let c = 0; c < channels; c++) {
            out[at++] = 0x02; // VERBATIM, no wasted bits
            for (let i = 0; i < n; i++) {
                const src = i * align + c * bytesPer;
                if (bits === 8) {
                    out[at++] = pcm[src] ^ 0x80; // WAV 8-bit is unsigned
                } else if (bits === 16) {
                    out[at++] = pcm[src + 1];
                    out[at++] = pcm[src];
                } else {
                    out[at++] = pcm[src + 2];
                    out[at++] = pcm[src + 1];
                    out[at++] = pcm[src];
                }
            }
        }
        const crc = crc16(out, 0, at);
        out[at++] = crc >> 8;
        out[at++] = crc & 0xff;
        this.frames.push({ data: out, blockSize: n });
        this.pendingSamples += n;
    }

    private flush() {
        if (this.frames.length === 0) return;
        const frames = this.frames;
        this.frames = [];
        this.pendingSamples = 0;
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
