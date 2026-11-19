/**
 * Keeps an encrypted H.264 keyframe acceptable to the receiver's WebRTC.
 *
 * LiveKit's E2EE leaves only a slice's NAL header and the byte after it in
 * the clear. Chromium's receiver reads the IDR slice's pps_id before
 * decrypting (H264SpsPpsTracker) and drops the keyframe, asking for another,
 * when it names a PPS it hasn't seen. An encoder that writes slice_type 7
 * (Media Foundation, Zam's Windows helper) fills that byte with first_mb and
 * slice_type, so pps_id is read from ciphertext: a coin flip per keyframe. The
 * viewer freezes until one lands, seconds at a time after every layer switch.
 *
 * The fix rewrites the first IDR slice's header before encryption:
 * slice_type 5..9 becomes the same type minus 5 (an I slice is still an I
 * slice; the spec allows mixing the two forms in a picture), which is
 * shorter, so pps_id moves into the clear byte. The bits saved are given back
 * by a longer idr_pic_id (an injective mapping, so consecutive IDRs still
 * differ), so every bit after the header keeps its position and the slice
 * data is untouched, CAVLC or CABAC. Receivers need nothing.
 */

/** NAL start offsets (the header byte) in an Annex B access unit, up to and
 *  including the first slice: parameter sets come first, so this stays
 *  cheap on big frames. */
function nalsToFirstSlice(data: Uint8Array): { start: number; end: number }[] {
    const nals: { start: number; end: number }[] = [];
    let i = 0;
    let start = -1;
    const n = data.length;
    while (i + 2 < n) {
        if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1) {
            if (start >= 0) {
                let end = i;
                while (end > start && data[end - 1] === 0) end--;
                nals.push({ start, end });
                const t = data[start] & 0x1f;
                if (t === 1 || t === 5) return nals;
            }
            start = i + 3;
            i += 3;
        } else i++;
    }
    if (start >= 0 && start < n) nals.push({ start, end: n });
    return nals;
}

export function unescapeRbsp(nal: Uint8Array): Uint8Array {
    const out = new Uint8Array(nal.length);
    let o = 0;
    let zeros = 0;
    for (let i = 0; i < nal.length; i++) {
        const b = nal[i];
        if (zeros >= 2 && b === 3) {
            zeros = 0;
            continue;
        }
        out[o++] = b;
        zeros = b === 0 ? zeros + 1 : 0;
    }
    return out.subarray(0, o);
}

export function escapeRbsp(rbsp: Uint8Array): Uint8Array {
    const out = new Uint8Array(rbsp.length + (rbsp.length >> 1) + 2);
    let o = 0;
    let zeros = 0;
    for (let i = 0; i < rbsp.length; i++) {
        const b = rbsp[i];
        if (zeros >= 2 && b <= 3) {
            out[o++] = 3;
            zeros = 0;
        }
        out[o++] = b;
        zeros = b === 0 ? zeros + 1 : 0;
    }
    if (o > 0 && out[o - 1] === 0) out[o++] = 3;
    return out.subarray(0, o);
}

class BitReader {
    pos = 0;
    constructor(private readonly d: Uint8Array) {}
    bit(): number {
        const byte = this.pos >> 3;
        if (byte >= this.d.length) throw new RangeError("past the end");
        const b = (this.d[byte] >> (7 - (this.pos & 7))) & 1;
        this.pos++;
        return b;
    }
    bits(n: number): number {
        let v = 0;
        for (let k = 0; k < n; k++) v = v * 2 + this.bit();
        return v;
    }
    ue(): number {
        let zeros = 0;
        while (this.bit() === 0) {
            if (++zeros > 31) throw new RangeError("bad exp-golomb");
        }
        return 2 ** zeros - 1 + this.bits(zeros);
    }
    se(): number {
        const k = this.ue();
        return k & 1 ? (k + 1) / 2 : -(k / 2);
    }
}

class BitWriter {
    readonly bitsOut: number[] = [];
    bit(b: number): void {
        this.bitsOut.push(b & 1);
    }
    bits(v: number, n: number): void {
        for (let k = n - 1; k >= 0; k--) this.bit(Math.floor(v / 2 ** k) & 1);
    }
    ue(v: number): void {
        const len = Math.floor(Math.log2(v + 1));
        this.bits(0, len);
        this.bits(v + 1, len + 1);
    }
}

const HIGH_PROFILES = new Set([
    100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135,
]);

export interface SpsBits {
    separateColourPlane: boolean;
    log2MaxFrameNum: number;
    frameMbsOnly: boolean;
}

/** What a slice header parse needs from an SPS (RBSP after the NAL header
 *  byte), or null for one this doesn't handle (scaling matrices). */
export function parseSps(rbsp: Uint8Array): SpsBits | null {
    try {
        const r = new BitReader(rbsp);
        const profile = r.bits(8);
        r.bits(16); // constraint flags, level
        r.ue(); // sps id
        let separateColourPlane = false;
        if (HIGH_PROFILES.has(profile)) {
            if (r.ue() === 3) separateColourPlane = r.bit() === 1;
            r.ue();
            r.ue();
            r.bit();
            if (r.bit()) return null; // seq_scaling_matrix_present
        }
        const log2MaxFrameNum = r.ue() + 4;
        const pocType = r.ue();
        if (pocType === 0) r.ue();
        else if (pocType === 1) {
            r.bit();
            r.se();
            r.se();
            const n = r.ue();
            for (let k = 0; k < n; k++) r.se();
        }
        r.ue(); // max_num_ref_frames
        r.bit();
        r.ue();
        r.ue();
        const frameMbsOnly = r.bit() === 1;
        return { separateColourPlane, log2MaxFrameNum, frameMbsOnly };
    } catch {
        return null;
    }
}

/** The IDR slice RBSP (after the NAL header byte) with pps_id inside its
 *  first byte, or null when it already is or can't be done. */
export function rewriteIdrSliceHeader(
    rbsp: Uint8Array,
    sps: SpsBits,
): Uint8Array | null {
    let firstMb: number, sliceType: number, ppsId: number;
    let ppsEnd: number, idrStart: number, idrEnd: number, idrPicId: number;
    try {
        const r = new BitReader(rbsp);
        firstMb = r.ue();
        sliceType = r.ue();
        ppsId = r.ue();
        ppsEnd = r.pos;
        if (sps.separateColourPlane) r.bits(2);
        r.bits(sps.log2MaxFrameNum);
        if (!sps.frameMbsOnly && r.bit()) r.bit();
        idrStart = r.pos;
        idrPicId = r.ue();
        idrEnd = r.pos;
    } catch {
        return null;
    }
    if (ppsEnd <= 8 || firstMb !== 0 || sliceType < 5 || sliceType > 9)
        return null;
    const ueLen = (v: number) => 2 * Math.floor(Math.log2(v + 1)) + 1;
    const shortType = sliceType - 5;
    const saved = ueLen(sliceType) - ueLen(shortType);
    if (ueLen(firstMb) + ueLen(shortType) + ueLen(ppsId) > 8) return null;
    // A longer idr_pic_id takes the saved bits back: ue lengths are odd, so
    // the saving is even, and (v + 1) << k is k*2 bits longer.
    const k = saved / 2;
    const newIdr = (idrPicId + 1) * 2 ** k - 1;
    if (!Number.isInteger(k) || newIdr > 65535) return null;
    const w = new BitWriter();
    w.ue(firstMb);
    w.ue(shortType);
    w.ue(ppsId);
    const r = new BitReader(rbsp);
    r.pos = ppsEnd;
    for (let p = ppsEnd; p < idrStart; p++) w.bit(r.bit());
    w.ue(newIdr);
    const bits = w.bitsOut;
    if (bits.length !== idrEnd) return null;
    const out = rbsp.slice();
    for (let p = 0; p < bits.length; p++) {
        const byte = p >> 3;
        const mask = 1 << (7 - (p & 7));
        out[byte] = bits[p] ? out[byte] | mask : out[byte] & ~mask;
    }
    return out;
}

/** An access unit whose first IDR slice has pps_id in the clear under
 *  LiveKit's E2EE, or null when nothing needs changing (not an IDR, already
 *  fine, or not something this parses). Needs the SPS in the same AU, as
 *  keyframes from Chromium's encoders and Zam's helper carry it. */
export function clearIdrPpsId(data: Uint8Array): Uint8Array | null {
    const nals = nalsToFirstSlice(data);
    const slice = nals[nals.length - 1];
    if (!slice || (data[slice.start] & 0x1f) !== 5) return null;
    const spsNal = nals.find((n) => (data[n.start] & 0x1f) === 7);
    if (!spsNal) return null;
    const sps = parseSps(
        unescapeRbsp(data.subarray(spsNal.start + 1, spsNal.end)),
    );
    if (!sps) return null;
    // The slice runs to the next start code (or the end): unescape all of it,
    // since re-escaping has to see the bytes after the rewritten header.
    let sliceEnd = data.length;
    for (let i = slice.start; i + 2 < data.length; i++) {
        if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1) {
            sliceEnd = i;
            while (sliceEnd > slice.start && data[sliceEnd - 1] === 0)
                sliceEnd--;
            break;
        }
    }
    const rbsp = unescapeRbsp(data.subarray(slice.start + 1, sliceEnd));
    const rewritten = rewriteIdrSliceHeader(rbsp, sps);
    if (!rewritten) return null;
    const payload = escapeRbsp(rewritten);
    const out = new Uint8Array(
        slice.start + 1 + payload.length + (data.length - sliceEnd),
    );
    out.set(data.subarray(0, slice.start + 1), 0);
    out.set(payload, slice.start + 1);
    out.set(data.subarray(sliceEnd), slice.start + 1 + payload.length);
    return out;
}
