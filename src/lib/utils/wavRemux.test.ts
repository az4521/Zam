import { describe, expect, it } from "vitest";
import { WavRemuxer } from "./wavRemux";
import { crc16, parseFrameHeader } from "./flacRemux";
import { isWav } from "./audioProbe";

function wav(opts: {
    channels: number;
    bits: 8 | 16 | 24;
    frames: number;
    rate?: number;
    streaming?: boolean;
    extra?: boolean;
}): { file: Uint8Array; pcm: Uint8Array } {
    const { channels, bits, frames, rate = 44100 } = opts;
    const align = channels * (bits / 8);
    const pcm = new Uint8Array(frames * align);
    for (let i = 0; i < pcm.length; i++) pcm[i] = (i * 7 + 3) & 0xff;
    const fmt = new Uint8Array(24);
    const v = new DataView(fmt.buffer);
    fmt.set([0x66, 0x6d, 0x74, 0x20]); // "fmt "
    v.setUint32(4, 16, true);
    v.setUint16(8, 1, true);
    v.setUint16(10, channels, true);
    v.setUint32(12, rate, true);
    v.setUint32(16, rate * align, true);
    v.setUint16(20, align, true);
    v.setUint16(22, bits, true);
    const list = opts.extra
        ? Uint8Array.from([0x4c, 0x49, 0x53, 0x54, 3, 0, 0, 0, 1, 2, 3, 0])
        : new Uint8Array(0);
    const head = new Uint8Array(8);
    head.set([0x64, 0x61, 0x74, 0x61]); // "data"
    new DataView(head.buffer).setUint32(
        4,
        opts.streaming ? 0xffffffff : pcm.length,
        true,
    );
    const riff = new Uint8Array(12);
    riff.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
    const parts = [riff, fmt, list, head, pcm];
    const file = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
        file.set(p, at);
        at += p.length;
    }
    return { file, pcm };
}

/** The samples of each FLAC frame in a moof+mdat, found by its trun. */
function frames(fragment: ArrayBuffer): Uint8Array[] {
    const b = new Uint8Array(fragment);
    const v = new DataView(fragment);
    let trun = -1;
    for (let i = 0; i + 4 < b.length; i++)
        if (
            b[i] === 0x74 &&
            b[i + 1] === 0x72 &&
            b[i + 2] === 0x75 &&
            b[i + 3] === 0x6e
        ) {
            trun = i;
            break;
        }
    expect(trun).toBeGreaterThan(0);
    const count = v.getUint32(trun + 8);
    const offset = v.getInt32(trun + 12);
    const out: Uint8Array[] = [];
    let at = offset; // from the start of the moof, which starts the fragment
    for (let i = 0; i < count; i++) {
        const size = v.getUint32(trun + 16 + i * 16 + 4);
        out.push(b.subarray(at, at + size));
        at += size;
    }
    return out;
}

/** Decode verbatim FLAC frames back to interleaved little-endian PCM. */
function decode(frame: Uint8Array, channels: number, bits: number): Uint8Array {
    expect(crc16(frame, 0, frame.length)).toBe(0);
    const h = parseFrameHeader(frame, 0, false);
    if (h === null || h === "short") throw new Error("bad frame header");
    const bytes = bits / 8;
    const out = new Uint8Array(h.blockSize * channels * bytes);
    let at = h.length;
    for (let c = 0; c < channels; c++) {
        expect(frame[at++]).toBe(0x02);
        for (let i = 0; i < h.blockSize; i++) {
            const dst = (i * channels + c) * bytes;
            if (bits === 8) out[dst] = frame[at++] ^ 0x80;
            else
                for (let k = bytes - 1; k >= 0; k--) out[dst + k] = frame[at++];
        }
    }
    return out;
}

function run(file: Uint8Array, chunk: number) {
    const remux = new WavRemuxer();
    const segs: ArrayBuffer[] = [];
    for (let i = 0; i < file.length; i += chunk) {
        remux.push(file.subarray(i, i + chunk));
        segs.push(...remux.take().map((s) => s.buffer));
    }
    remux.end();
    segs.push(...remux.take().map((s) => s.buffer));
    return { remux, segs };
}

describe("isWav", () => {
    it("needs RIFF and WAVE", () => {
        expect(isWav(wav({ channels: 1, bits: 16, frames: 4 }).file)).toBe(
            true,
        );
        expect(isWav(new Uint8Array(12))).toBe(false);
    });
});

describe("WavRemuxer", () => {
    it.each([
        [1, 16, 5000, 1500],
        [2, 16, 9000, 777],
        [2, 24, 4096, 64 * 1024],
        [1, 8, 4097, 5],
        [6, 16, 100, 100],
    ] as const)(
        "carries %i channel(s) of %i-bit PCM (%i frames, %i-byte chunks) unchanged",
        (channels, bits, count, chunk) => {
            const { file, pcm } = wav({ channels, bits, frames: count });
            const { remux, segs } = run(file, chunk);
            expect(remux.unsupported).toBeNull();
            expect(remux.header?.tracks[0].mime).toBe(
                'audio/mp4; codecs="flac"',
            );
            expect(remux.header?.duration).toBeCloseTo(count / 44100, 6);
            const decoded: Uint8Array[] = [];
            for (const seg of segs)
                for (const f of frames(seg))
                    decoded.push(decode(f, channels, bits));
            const all = new Uint8Array(
                decoded.reduce((n, d) => n + d.length, 0),
            );
            let at = 0;
            for (const d of decoded) {
                all.set(d, at);
                at += d.length;
            }
            expect(Array.from(all)).toEqual(Array.from(pcm));
        },
    );

    it("handles a streaming header, and chunks around the data", () => {
        const { file, pcm } = wav({
            channels: 2,
            bits: 16,
            frames: 6000,
            streaming: true,
            extra: true,
        });
        const { remux, segs } = run(file, 999);
        expect(remux.unsupported).toBeNull();
        expect(remux.header?.duration).toBeNull();
        let total = 0;
        for (const seg of segs)
            for (const f of frames(seg)) total += decode(f, 2, 16).length;
        expect(total).toBe(pcm.length);
    });

    it("gives up on anything but integer PCM", () => {
        const { file } = wav({ channels: 1, bits: 16, frames: 10 });
        const float = file.slice();
        new DataView(float.buffer).setUint16(12 + 8, 3, true); // IEEE float
        const r = new WavRemuxer();
        r.push(float);
        r.end();
        expect(r.unsupported).toMatch(/PCM/);
        expect(r.header).toBeNull();

        const text = new WavRemuxer();
        text.push(new TextEncoder().encode("not a wav file at all"));
        expect(text.unsupported).toMatch(/WAV/);
    });
});
