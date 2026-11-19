import { describe, it, expect } from "vitest";
import {
    clearIdrPpsId,
    escapeRbsp,
    parseSps,
    unescapeRbsp,
} from "./h264ClearPps";

/** Bits to bytes, padded with an RBSP stop bit and zeros. */
class Bits {
    b: number[] = [];
    u(v: number, n: number): this {
        for (let k = n - 1; k >= 0; k--)
            this.b.push(Math.floor(v / 2 ** k) & 1);
        return this;
    }
    ue(v: number): this {
        const len = Math.floor(Math.log2(v + 1));
        return this.u(0, len).u(v + 1, len + 1);
    }
    bytes(stop = true): Uint8Array {
        const b = [...this.b];
        if (stop) b.push(1);
        while (b.length % 8) b.push(0);
        const out = new Uint8Array(b.length / 8);
        b.forEach((bit, i) => {
            if (bit) out[i >> 3] |= 1 << (7 - (i & 7));
        });
        return out;
    }
}

/** A constrained-baseline SPS: frame_num in 4 + `log2MinusFour` bits. */
function sps(log2MinusFour = 0, frameMbsOnly = 1): Uint8Array {
    return new Bits()
        .u(66, 8)
        .u(0xc0, 8)
        .u(42, 8)
        .ue(0) // sps id
        .ue(log2MinusFour)
        .ue(2) // poc type 2
        .ue(1)
        .u(0, 1)
        .ue(59)
        .ue(33)
        .u(frameMbsOnly, 1)
        .bytes();
}

/** An IDR slice RBSP as Media Foundation writes it (slice_type 7), with
 *  `tail` arbitrary bits standing in for the rest of the slice. */
function idrSlice(opts: {
    sliceType?: number;
    frameNum?: number;
    log2MinusFour?: number;
    idrPicId?: number;
    tail: number[];
}): { rbsp: Uint8Array; headerBits: number } {
    const w = new Bits()
        .ue(0)
        .ue(opts.sliceType ?? 7)
        .ue(0)
        .u(opts.frameNum ?? 0, 4 + (opts.log2MinusFour ?? 0))
        .ue(opts.idrPicId ?? 0);
    const headerBits = w.b.length;
    for (const t of opts.tail) w.u(t, 8);
    return { rbsp: w.bytes(), headerBits };
}

const nal = (type: number, rbsp: Uint8Array) => [
    0,
    0,
    0,
    1,
    0x60 | type,
    ...escapeRbsp(rbsp),
];

function au(slice: Uint8Array, log2MinusFour = 0): Uint8Array {
    return new Uint8Array([
        ...[0, 0, 0, 1, 0x09, 0x10],
        ...nal(7, sps(log2MinusFour)),
        ...nal(8, new Bits().ue(0).ue(0).u(0, 1).bytes()),
        ...nal(5, slice),
    ]);
}

/** Reads ue(v)s and fixed fields back out of a slice RBSP. */
function readHeader(rbsp: Uint8Array, frameNumBits: number) {
    let pos = 0;
    const bit = () => (rbsp[pos >> 3] >> (7 - (pos++ & 7))) & 1;
    const bits = (n: number) => {
        let v = 0;
        for (let k = 0; k < n; k++) v = v * 2 + bit();
        return v;
    };
    const ue = () => {
        let z = 0;
        while (bit() === 0) z++;
        return 2 ** z - 1 + bits(z);
    };
    const firstMb = ue();
    const sliceType = ue();
    const ppsId = ue();
    const ppsEnd = pos;
    const frameNum = bits(frameNumBits);
    const idrPicId = ue();
    return { firstMb, sliceType, ppsId, ppsEnd, frameNum, idrPicId, end: pos };
}

function sliceOf(data: Uint8Array): Uint8Array {
    // The last NAL: after the last start code.
    let last = 0;
    for (let i = 0; i + 2 < data.length; i++)
        if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1)
            last = i + 3;
    return unescapeRbsp(data.subarray(last + 1));
}

describe("clearIdrPpsId", () => {
    const tail = [0x9a, 0x00, 0x00, 0x01, 0x37, 0xff, 0x00, 0x00, 0x00, 0x42];

    it("moves pps_id into the clear byte and keeps every later bit in place", () => {
        const { rbsp, headerBits } = idrSlice({ frameNum: 5, tail });
        const before = readHeader(rbsp, 4);
        expect(before.sliceType).toBe(7);
        expect(before.ppsEnd).toBeGreaterThan(8);

        const out = clearIdrPpsId(au(rbsp));
        expect(out).not.toBeNull();
        const after = sliceOf(out!);
        const h = readHeader(after, 4);
        expect(h.firstMb).toBe(0);
        expect(h.sliceType).toBe(2);
        expect(h.ppsId).toBe(0);
        expect(h.ppsEnd).toBeLessThanOrEqual(8);
        expect(h.frameNum).toBe(5);
        expect(h.end).toBe(headerBits);
        // Consecutive IDRs keep distinct ids: the mapping is injective.
        expect(h.idrPicId).toBe(3);
        // Everything after the header, byte for byte.
        expect([...after.subarray(Math.ceil(headerBits / 8))]).toEqual([
            ...rbsp.subarray(Math.ceil(headerBits / 8)),
        ]);
        expect(after.length).toBe(rbsp.length);
    });

    it("maps distinct idr_pic_ids to distinct ones", () => {
        const ids = new Set<number>();
        for (const id of [0, 1, 2, 7, 100]) {
            const { rbsp } = idrSlice({ idrPicId: id, tail });
            const h = readHeader(sliceOf(clearIdrPpsId(au(rbsp))!), 4);
            ids.add(h.idrPicId);
        }
        expect(ids.size).toBe(5);
    });

    it("handles a longer frame_num", () => {
        const { rbsp, headerBits } = idrSlice({
            frameNum: 300,
            log2MinusFour: 5,
            tail,
        });
        const h = readHeader(sliceOf(clearIdrPpsId(au(rbsp, 5))!), 9);
        expect(h.sliceType).toBe(2);
        expect(h.frameNum).toBe(300);
        expect(h.end).toBe(headerBits);
    });

    it("leaves a keyframe whose pps_id is already in the clear", () => {
        const { rbsp } = idrSlice({ sliceType: 2, tail });
        expect(clearIdrPpsId(au(rbsp))).toBeNull();
    });

    it("leaves delta frames and AUs without an SPS", () => {
        const p = new Uint8Array([0, 0, 0, 1, 0x41, 0x9a, 0x22, 0x01]);
        expect(clearIdrPpsId(p)).toBeNull();
        const { rbsp } = idrSlice({ tail });
        expect(clearIdrPpsId(new Uint8Array(nal(5, rbsp)))).toBeNull();
    });

    it("rejects garbage without throwing", () => {
        expect(clearIdrPpsId(new Uint8Array([1, 2, 3]))).toBeNull();
        expect(
            clearIdrPpsId(new Uint8Array([0, 0, 1, 0x67, 0, 0, 1, 0x65])),
        ).toBeNull();
    });
});

describe("RBSP escaping", () => {
    it("round-trips emulation prevention", () => {
        const raw = new Uint8Array([0, 0, 1, 0, 0, 0, 0, 0, 3, 5, 0, 0]);
        const esc = escapeRbsp(raw);
        expect([...esc]).toEqual([
            0, 0, 3, 1, 0, 0, 3, 0, 0, 3, 0, 3, 5, 0, 0, 3,
        ]);
        expect([...unescapeRbsp(esc)]).toEqual([...raw]);
    });

    it("parses the SPS fields a slice header needs", () => {
        expect(parseSps(sps(5))).toEqual({
            separateColourPlane: false,
            log2MaxFrameNum: 9,
            frameMbsOnly: true,
        });
    });
});
