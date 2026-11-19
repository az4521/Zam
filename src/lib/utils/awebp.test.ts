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
