import { describe, expect, it } from "vitest";
import { muxAnimatedWebp, type AwebpFrame } from "./awebp";

type Chunk = [fourcc: string, data: number[]];

function ascii(text: string): number[] {
    return Array.from(text, (ch) => ch.charCodeAt(0));
}

/** Builds a RIFF/WEBP file from chunks, padding odd-sized chunks. */
function riff(chunks: Chunk[]): Uint8Array {
    const body: number[] = [];
    for (const [fourcc, data] of chunks) {
        const size = data.length;
        body.push(...ascii(fourcc), ...le32(size), ...data);
        if (size & 1) body.push(0);
    }
    return Uint8Array.from([
        ...ascii("RIFF"),
        ...le32(4 + body.length),
        ...ascii("WEBP"),
        ...body,
    ]);
}

function le32(value: number): number[] {
    return [
        value & 0xff,
        (value >>> 8) & 0xff,
        (value >>> 16) & 0xff,
        value >>> 24,
    ];
}

function u24(value: number): number[] {
    return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff];
}

/** A simple-format still: one VP8L chunk with an odd-sized payload. */
const simpleLossless = riff([["VP8L", [0x2f, 1, 2, 3, 4]]]);

/** A VP8X still with alpha, an odd ALPH chunk, EXIF metadata and VP8. */
const extendedLossy = riff([
    ["VP8X", [0x10, 0, 0, 0, 3, 0, 0, 2, 0, 0]],
    ["ALPH", [0, 9, 9, 9, 9]],
    ["VP8 ", [0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a]],
    ["EXIF", [7, 7, 7]],
]);

interface ParsedChunk {
    fourcc: string;
    size: number;
    start: number;
    data: Uint8Array;
}

/** Walks the top-level chunks of an output file. */
function walk(bytes: Uint8Array, from: number, to: number): ParsedChunk[] {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const out: ParsedChunk[] = [];
    let pos = from;
    while (pos < to) {
        const fourcc = String.fromCharCode(...bytes.subarray(pos, pos + 4));
        const size = view.getUint32(pos + 4, true);
        out.push({
            fourcc,
            size,
            start: pos,
            data: bytes.subarray(pos + 8, pos + 8 + size),
        });
        pos += 8 + size + (size & 1);
    }
    expect(pos).toBe(to);
    return out;
}

function readU24(bytes: Uint8Array, offset: number): number {
    return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

describe("muxAnimatedWebp", () => {
    it("writes the RIFF, VP8X and ANIM header byte by byte", () => {
        const out = muxAnimatedWebp(
            [{ webp: simpleLossless, delayMs: 100 }],
            4,
            3,
            5,
        );
        const view = new DataView(out.buffer);
        expect(String.fromCharCode(...out.subarray(0, 4))).toBe("RIFF");
        expect(view.getUint32(4, true)).toBe(out.byteLength - 8);
        expect(String.fromCharCode(...out.subarray(8, 12))).toBe("WEBP");

        const top = walk(out, 12, out.byteLength);
        expect(top.map((c) => c.fourcc)).toEqual(["VP8X", "ANIM", "ANMF"]);

        const vp8x = top[0];
        expect(vp8x.size).toBe(10);
        expect(vp8x.data[0]).toBe(0x12); // alpha + animation
        expect(vp8x.data.subarray(1, 4)).toEqual(Uint8Array.from([0, 0, 0]));
        expect(readU24(vp8x.data, 4)).toBe(3); // width - 1
        expect(readU24(vp8x.data, 7)).toBe(2); // height - 1

        const anim = top[1];
        expect(anim.size).toBe(6);
        expect(Array.from(anim.data.subarray(0, 4))).toEqual([0, 0, 0, 0]);
        expect(
            new DataView(anim.data.buffer, anim.data.byteOffset).getUint16(
                4,
                true,
            ),
        ).toBe(5);
    });

    it("stores each frame as ANMF in order with durations and no-blend dispose flags", () => {
        const out = muxAnimatedWebp(
            [
                { webp: simpleLossless, delayMs: 100 },
                { webp: simpleLossless, delayMs: 33.4 },
                { webp: simpleLossless, delayMs: 0 },
            ],
            4,
            3,
        );
        const anmfs = walk(out, 12, out.byteLength).filter(
            (c) => c.fourcc === "ANMF",
        );
        expect(anmfs).toHaveLength(3);
        expect(anmfs.map((f) => readU24(f.data, 12))).toEqual([100, 33, 1]);
        for (const anmf of anmfs) {
            expect(readU24(anmf.data, 0)).toBe(0); // X / 2
            expect(readU24(anmf.data, 3)).toBe(0); // Y / 2
            expect(readU24(anmf.data, 6)).toBe(3); // width - 1
            expect(readU24(anmf.data, 9)).toBe(2); // height - 1
            expect(anmf.data[15]).toBe(0x03); // do not blend, dispose to background
        }
    });

    it("keeps a VP8L frame payload intact, including its odd-size pad byte", () => {
        const out = muxAnimatedWebp(
            [{ webp: simpleLossless, delayMs: 50 }],
            4,
            3,
        );
        const anmf = walk(out, 12, out.byteLength)[2];
        // 16 header bytes, then VP8L (8 + 5 bytes) padded to 14 bytes.
        expect(anmf.size).toBe(16 + 14);
        const payload = anmf.data.subarray(16);
        expect(String.fromCharCode(...payload.subarray(0, 4))).toBe("VP8L");
        expect(
            new DataView(payload.buffer, payload.byteOffset).getUint32(4, true),
        ).toBe(5);
        expect(Array.from(payload.subarray(8, 13))).toEqual([0x2f, 1, 2, 3, 4]);
        expect(payload[13]).toBe(0); // pad byte, not counted in the size field
        expect(out.byteLength % 2).toBe(0);
    });

    it("takes ALPH + VP8 from an extended still and drops VP8X and EXIF", () => {
        const out = muxAnimatedWebp(
            [{ webp: extendedLossy, delayMs: 40 }],
            4,
            3,
        );
        const anmf = walk(out, 12, out.byteLength)[2];
        const inner = walk(anmf.data, 16, anmf.data.length);
        expect(inner.map((c) => c.fourcc)).toEqual(["ALPH", "VP8 "]);
        expect(Array.from(inner[0].data)).toEqual([0, 9, 9, 9, 9]);
        expect(inner[0].size).toBe(5);
        expect(Array.from(inner[1].data)).toEqual([
            0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a,
        ]);
        // ALPH is 8 + 5 + 1 pad = 14 bytes, VP8 is 8 + 6 = 14 bytes.
        expect(anmf.size).toBe(16 + 14 + 14);
    });

    it("sizes the RIFF and ANMF chunks so padding is counted in the file only", () => {
        const out = muxAnimatedWebp(
            [
                { webp: simpleLossless, delayMs: 10 },
                { webp: extendedLossy, delayMs: 10 },
            ],
            4,
            3,
        );
        const view = new DataView(out.buffer);
        expect(view.getUint32(4, true)).toBe(out.byteLength - 8);
        const top = walk(out, 12, out.byteLength);
        expect(top[2].size).toBe(16 + 14);
        expect(top[3].size).toBe(16 + 14 + 14);
        expect(top[3].start).toBe(top[2].start + 8 + top[2].size);
    });

    it("rejects malformed or non-WebP input with a clear error", () => {
        const notRiff = Uint8Array.from([
            ...ascii("RIFX"),
            ...le32(4),
            ...ascii("WEBP"),
        ]);
        const notWebp = Uint8Array.from([
            ...ascii("RIFF"),
            ...le32(4),
            ...ascii("WAVE"),
        ]);
        const tooShort = Uint8Array.from([1, 2, 3]);
        const truncated = simpleLossless.subarray(0, simpleLossless.length - 2);
        const noBitstream = riff([["ALPH", [1, 2]]]);
        const badChunkSize = riff([["VP8L", [0x2f, 1]]]);
        new DataView(badChunkSize.buffer).setUint32(16, 99, true);

        expect(() =>
            muxAnimatedWebp([{ webp: notRiff, delayMs: 1 }], 4, 3),
        ).toThrow(/not a WebP file/);
        expect(() =>
            muxAnimatedWebp([{ webp: notWebp, delayMs: 1 }], 4, 3),
        ).toThrow(/not a WebP file/);
        expect(() =>
            muxAnimatedWebp([{ webp: tooShort, delayMs: 1 }], 4, 3),
        ).toThrow(/too short/);
        expect(() =>
            muxAnimatedWebp([{ webp: truncated, delayMs: 1 }], 4, 3),
        ).toThrow(/truncated|invalid/);
        expect(() =>
            muxAnimatedWebp([{ webp: noBitstream, delayMs: 1 }], 4, 3),
        ).toThrow(/no VP8 or VP8L/);
        expect(() =>
            muxAnimatedWebp([{ webp: badChunkSize, delayMs: 1 }], 4, 3),
        ).toThrow(/truncated/);
    });

    it("rejects empty frame lists and out-of-range canvas or loop values", () => {
        const frame: AwebpFrame = { webp: simpleLossless, delayMs: 1 };
        expect(() => muxAnimatedWebp([], 4, 3)).toThrow(/no frames/);
        expect(() => muxAnimatedWebp([frame], 0, 3)).toThrow(/width/);
        expect(() => muxAnimatedWebp([frame], 4, 1.5)).toThrow(/height/);
        expect(() => muxAnimatedWebp([frame], 4, 3, 65536)).toThrow(
            /loop count/,
        );
        expect(() => muxAnimatedWebp([frame], 4, 3, -1)).toThrow(/loop count/);
    });

    it("clamps durations to the 24-bit range", () => {
        const out = muxAnimatedWebp(
            [{ webp: simpleLossless, delayMs: 1e9 }],
            4,
            3,
        );
        const anmf = walk(out, 12, out.byteLength)[2];
        expect(readU24(anmf.data, 12)).toBe(0xffffff);
        expect(u24(0xffffff)).toEqual([0xff, 0xff, 0xff]);
    });
});

/*
 * The muxer as it was before the single-allocation rewrite (per-chunk and
 * per-frame buffers plus a concatenating copy of the whole file). Kept only as
 * the reference the new output must match byte for byte.
 */
function legacyFourcc(bytes: Uint8Array, offset: number): string {
    return String.fromCharCode(
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
    );
}

function legacyReadChunks(
    bytes: Uint8Array,
): { fourcc: string; data: Uint8Array }[] {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const riffSize = view.getUint32(4, true);
    const end = riffSize + 8;
    const chunks: { fourcc: string; data: Uint8Array }[] = [];
    let pos = 12;
    while (pos < end) {
        const size = view.getUint32(pos + 4, true);
        chunks.push({
            fourcc: legacyFourcc(bytes, pos),
            data: bytes.subarray(pos + 8, pos + 8 + size),
        });
        pos = pos + 8 + size + (size & 1);
    }
    return chunks;
}

function legacyImageChunks(webp: Uint8Array) {
    const skip = new Set(["VP8X", "EXIF", "XMP ", "ICCP"]);
    return legacyReadChunks(webp).filter((c) => !skip.has(c.fourcc));
}

function legacyMakeChunk(fourcc: string, data: Uint8Array): Uint8Array {
    const padded = data.byteLength & 1;
    const out = new Uint8Array(8 + data.byteLength + padded);
    for (let i = 0; i < 4; i++) out[i] = fourcc.charCodeAt(i);
    const view = new DataView(out.buffer);
    view.setUint32(4, data.byteLength, true);
    out.set(data, 8);
    return out;
}

function legacyConcat(parts: Uint8Array[]): Uint8Array {
    const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.byteLength;
    }
    return out;
}

function legacyWriteU24(view: DataView, offset: number, value: number): void {
    view.setUint8(offset, value & 0xff);
    view.setUint8(offset + 1, (value >>> 8) & 0xff);
    view.setUint8(offset + 2, (value >>> 16) & 0xff);
}

function legacyFrameChunk(
    webp: Uint8Array,
    delayMs: number,
    width: number,
    height: number,
): Uint8Array {
    const header = new Uint8Array(16);
    const view = new DataView(header.buffer);
    legacyWriteU24(view, 0, 0);
    legacyWriteU24(view, 3, 0);
    legacyWriteU24(view, 6, width - 1);
    legacyWriteU24(view, 9, height - 1);
    const duration = Number.isFinite(delayMs) ? Math.round(delayMs) : 0xffffff;
    legacyWriteU24(view, 12, Math.min(0xffffff, Math.max(1, duration)));
    header[15] = 0x02 | 0x01;
    const payload = legacyConcat(
        legacyImageChunks(webp).map((c) => legacyMakeChunk(c.fourcc, c.data)),
    );
    return legacyMakeChunk("ANMF", legacyConcat([header, payload]));
}

function legacyMuxAnimatedWebp(
    frames: AwebpFrame[],
    width: number,
    height: number,
    loopCount = 0,
): Uint8Array {
    const vp8x = new Uint8Array(10);
    const vp8xView = new DataView(vp8x.buffer);
    vp8x[0] = 0x10 | 0x02;
    legacyWriteU24(vp8xView, 4, width - 1);
    legacyWriteU24(vp8xView, 7, height - 1);
    const anim = new Uint8Array(6);
    new DataView(anim.buffer).setUint16(4, loopCount, true);
    const parts: Uint8Array[] = [
        legacyMakeChunk("VP8X", vp8x),
        legacyMakeChunk("ANIM", anim),
    ];
    for (const frame of frames) {
        parts.push(legacyFrameChunk(frame.webp, frame.delayMs, width, height));
    }
    const body = legacyConcat(parts);
    const out = new Uint8Array(12 + body.byteLength);
    for (let i = 0; i < 4; i++) {
        out[i] = "RIFF".charCodeAt(i);
        out[8 + i] = "WEBP".charCodeAt(i);
    }
    new DataView(out.buffer).setUint32(4, out.byteLength - 8, true);
    out.set(body, 12);
    return out;
}

/** Deterministic pseudo-random bytes, so failures reproduce. */
function noise(length: number, seed: number): Uint8Array {
    const out = new Uint8Array(length);
    let x = seed | 0 || 1;
    for (let i = 0; i < length; i++) {
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        out[i] = x & 0xff;
    }
    return out;
}

/** A simple VP8L still whose payload is `size` bytes (odd sizes pad). */
function stillVp8l(size: number, seed: number): Uint8Array {
    return riff([["VP8L", Array.from(noise(size, seed))]]);
}

/** An extended still: VP8X + ALPH + VP8 + EXIF, so the filter path runs. */
function stillExtended(size: number, seed: number): Uint8Array {
    return riff([
        ["VP8X", [0x10, 0, 0, 0, 3, 0, 0, 2, 0, 0]],
        ["ALPH", Array.from(noise((size % 7) + 1, seed))],
        ["VP8 ", Array.from(noise(size, seed + 1))],
        ["EXIF", [1, 2, 3]],
    ]);
}

describe("muxAnimatedWebp output is byte-identical to the previous muxer", () => {
    const cases: {
        name: string;
        frames: AwebpFrame[];
        w: number;
        h: number;
        loop?: number;
    }[] = [
        {
            name: "one simple frame",
            frames: [{ webp: simpleLossless, delayMs: 100 }],
            w: 4,
            h: 3,
        },
        {
            name: "mixed simple and extended stills with odd payloads",
            frames: [
                { webp: stillVp8l(1, 1), delayMs: 10 },
                { webp: stillExtended(5, 2), delayMs: 33.4 },
                { webp: stillVp8l(2, 3), delayMs: 0 },
                { webp: stillVp8l(17, 4), delayMs: 1e9 },
                { webp: stillExtended(64, 5), delayMs: NaN },
            ],
            w: 640,
            h: 480,
            loop: 7,
        },
        {
            name: "many frames of realistic size",
            frames: Array.from({ length: 40 }, (_, i) => ({
                webp: stillVp8l(4096 + (i % 3), 100 + i),
                delayMs: 40 + i,
            })),
            w: 1280,
            h: 720,
            loop: 65535,
        },
        {
            name: "single pixel canvas with a non-finite delay",
            frames: [{ webp: simpleLossless, delayMs: Infinity }],
            w: 1,
            h: 1,
        },
    ];

    it.each(cases)("$name", ({ frames, w, h, loop }) => {
        const expected = legacyMuxAnimatedWebp(frames, w, h, loop ?? 0);
        const actual = muxAnimatedWebp(frames, w, h, loop ?? 0);
        expect(actual.byteLength).toBe(expected.byteLength);
        expect(Array.from(actual)).toEqual(Array.from(expected));
    });

    it("keeps the output's input views untouched", () => {
        const frame = stillVp8l(9, 42);
        const before = Array.from(frame);
        muxAnimatedWebp([{ webp: frame, delayMs: 5 }], 4, 3);
        expect(Array.from(frame)).toEqual(before);
    });
});
