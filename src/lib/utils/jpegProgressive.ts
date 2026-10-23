/**
 * Losslessly rewrite a baseline JPEG as a progressive one.
 *
 * A baseline JPEG stores the image top to bottom in full detail, so a
 * receiver sees nothing below the part that has arrived. A progressive one
 * stores it in passes: a blurry whole image first, then sharper passes. That is
 * what `jpegtran -progressive` produces, and this does the same thing: the
 * quantized DCT coefficients are decoded and written back out in progressive
 * scans, never touching pixels, so the image decodes to exactly the same
 * picture. Every scan gets its own optimal Huffman table, which usually makes
 * the file a few percent smaller too.
 *
 * The scan script is libjpeg's default (`jpeg_simple_progression`). Metadata
 * segments (EXIF, ICC profile, JFIF, Adobe, comments) are copied as they are.
 *
 * Like utils/mp4Faststart it is deliberately conservative: anything it does not
 * fully understand returns null and the caller sends the ORIGINAL file. That
 * covers arithmetic coding, 12-bit, already-progressive and lossless files,
 * corrupt entropy data, and files whose bytes something else points into: an
 * MPF image list or data after the end of the JPEG (multi-picture files,
 * motion photos), which a rewrite would leave pointing at the wrong place.
 */

/** Refuse images whose coefficients alone would need more memory than this. */
const MAX_COEFFICIENT_BYTES = 256 * 1024 * 1024;

const M_SOI = 0xd8;
const M_EOI = 0xd9;
const M_SOS = 0xda;
const M_DHT = 0xc4;
const M_DQT = 0xdb;
const M_DRI = 0xdd;
const M_COM = 0xfe;
const M_SOF0 = 0xc0;
const M_SOF1 = 0xc1;
const M_SOF2 = 0xc2;

class Unsupported extends Error {}

interface Component {
    id: number;
    h: number;
    v: number;
    tq: number;
    /** Blocks in this component's own grid (what a one-component scan covers). */
    blocksW: number;
    blocksH: number;
    /** Blocks in the MCU-padded grid (what an interleaved scan covers). */
    paddedW: number;
    paddedH: number;
    /** paddedW × paddedH blocks of 64 coefficients, in zigzag order. */
    coef: Int16Array;
    seen: boolean;
}

interface Frame {
    width: number;
    height: number;
    hmax: number;
    vmax: number;
    mcusX: number;
    mcusY: number;
    components: Component[];
}

interface HuffDecoder {
    lookup: Uint16Array;
    maxcode: Int32Array;
    valptr: Int32Array;
    mincode: Int32Array;
    values: Uint8Array;
}

// ── Reading ─────────────────────────────────────────────────────────────────

const LOOKAHEAD = 9;

function buildDecoder(counts: Uint8Array, values: Uint8Array): HuffDecoder {
    const lookup = new Uint16Array(1 << LOOKAHEAD);
    const maxcode = new Int32Array(18).fill(-1);
    const valptr = new Int32Array(17);
    const mincode = new Int32Array(17);
    let code = 0;
    let k = 0;
    for (let len = 1; len <= 16; len++) {
        const n = counts[len - 1];
        valptr[len] = k;
        mincode[len] = code;
        for (let i = 0; i < n; i++, k++, code++) {
            if (code >= 1 << len) throw new Unsupported("bad Huffman table");
            if (len <= LOOKAHEAD) {
                const shift = LOOKAHEAD - len;
                const base = code << shift;
                for (let j = 0; j < 1 << shift; j++) {
                    lookup[base + j] = (len << 8) | values[k];
                }
            }
        }
        maxcode[len] = n ? code - 1 : -1;
        code <<= 1;
    }
    maxcode[17] = 0x7fffffff;
    return { lookup, maxcode, valptr, mincode, values };
}

class BitReader {
    private buf = 0;
    private cnt = 0;
    /** Zero bytes fed in after hitting a marker or the end of the data. */
    private padded = 0;
    /** Set once a marker (or the end) has been reached. */
    atMarker = false;

    constructor(
        private data: Uint8Array,
        public pos: number,
    ) {}

    private fill(): void {
        while (this.cnt <= 24) {
            let b = 0;
            if (!this.atMarker) {
                if (this.pos >= this.data.length) {
                    this.atMarker = true;
                } else {
                    b = this.data[this.pos];
                    if (b === 0xff) {
                        const next = this.data[this.pos + 1];
                        if (next === 0) {
                            this.pos += 2;
                        } else {
                            this.atMarker = true;
                            b = 0;
                        }
                    } else {
                        this.pos++;
                    }
                }
            }
            if (this.atMarker) this.padded++;
            this.buf = ((this.buf << 8) | b) >>> 0;
            this.cnt += 8;
        }
    }

    bits(n: number): number {
        if (n === 0) return 0;
        if (this.cnt < n) this.fill();
        this.cnt -= n;
        return (this.buf >>> this.cnt) & ((1 << n) - 1);
    }

    decode(t: HuffDecoder): number {
        if (this.cnt < 16) this.fill();
        const e = t.lookup[(this.buf >>> (this.cnt - LOOKAHEAD)) & 0x1ff];
        if (e) {
            this.cnt -= e >> 8;
            return e & 0xff;
        }
        for (let len = LOOKAHEAD + 1; len <= 16; len++) {
            const code = (this.buf >>> (this.cnt - len)) & ((1 << len) - 1);
            if (code <= t.maxcode[len]) {
                this.cnt -= len;
                return t.values[t.valptr[len] + code - t.mincode[len]];
            }
        }
        throw new Unsupported("bad Huffman code");
    }

    /** Throws if the scan read into the zero padding past its data, i.e. the
     *  entropy data was truncated or corrupt. */
    checkNotOverrun(): void {
        if (this.cnt < this.padded * 8) throw new Unsupported("truncated scan");
    }

    /** Drop leftover bits and step over the RSTn marker that must come next. */
    restart(): void {
        this.checkNotOverrun();
        const m = this.data[this.pos + 1];
        if (this.data[this.pos] !== 0xff || m < 0xd0 || m > 0xd7) {
            throw new Unsupported("missing restart marker");
        }
        this.pos += 2;
        this.buf = 0;
        this.cnt = 0;
        this.padded = 0;
        this.atMarker = false;
    }

    /** Position of the marker that ends this scan. */
    endOfScan(): number {
        this.checkNotOverrun();
        let p = this.pos;
        // Normally we are already at it; skip any stray bytes to the next real
        // marker (not stuffing, not a restart).
        while (p + 1 < this.data.length) {
            if (this.data[p] === 0xff) {
                const m = this.data[p + 1];
                if (m !== 0 && m !== 0xff && (m < 0xd0 || m > 0xd7)) return p;
            }
            p++;
        }
        throw new Unsupported("scan runs to the end of the file");
    }
}

function extend(v: number, s: number): number {
    return v < 1 << (s - 1) ? v - (1 << s) + 1 : v;
}

function readScan(
    data: Uint8Array,
    pos: number,
    frame: Frame,
    scanComps: { comp: Component; dc: HuffDecoder; ac: HuffDecoder }[],
    restartInterval: number,
): number {
    const r = new BitReader(data, pos);
    const preds = new Int32Array(scanComps.length);
    const single = scanComps.length === 1;
    const mcusX = single ? scanComps[0].comp.blocksW : frame.mcusX;
    const mcusY = single ? scanComps[0].comp.blocksH : frame.mcusY;
    const total = mcusX * mcusY;

    const readBlock = (
        c: Component,
        dc: HuffDecoder,
        ac: HuffDecoder,
        i: number,
        at: number,
    ) => {
        const coef = c.coef;
        const t = r.decode(dc);
        if (t > 11) throw new Unsupported("bad DC category");
        preds[i] += t ? extend(r.bits(t), t) : 0;
        coef[at] = preds[i];
        for (let k = 1; k < 64;) {
            const rs = r.decode(ac);
            const s = rs & 15;
            const run = rs >> 4;
            if (s) {
                if (s > 10) throw new Unsupported("bad AC category");
                k += run;
                if (k > 63) throw new Unsupported("AC run past block end");
                coef[at + k] = extend(r.bits(s), s);
                k++;
            } else if (run === 15) {
                k += 16;
            } else {
                break;
            }
        }
    };

    for (let m = 0; m < total; m++) {
        if (restartInterval && m > 0 && m % restartInterval === 0) {
            r.restart();
            preds.fill(0);
        }
        const mx = m % mcusX;
        const my = (m - mx) / mcusX;
        if (single) {
            const { comp, dc, ac } = scanComps[0];
            readBlock(comp, dc, ac, 0, (my * comp.paddedW + mx) * 64);
        } else {
            for (let i = 0; i < scanComps.length; i++) {
                const { comp, dc, ac } = scanComps[i];
                for (let v = 0; v < comp.v; v++) {
                    for (let h = 0; h < comp.h; h++) {
                        const by = my * comp.v + v;
                        const bx = mx * comp.h + h;
                        readBlock(
                            comp,
                            dc,
                            ac,
                            i,
                            (by * comp.paddedW + bx) * 64,
                        );
                    }
                }
            }
        }
    }
    return r.endOfScan();
}

// ── Writing ─────────────────────────────────────────────────────────────────

class ByteWriter {
    buf: Uint8Array;
    len = 0;
    constructor(size: number) {
        this.buf = new Uint8Array(Math.max(size, 1024));
    }
    private grow(n: number): void {
        if (this.len + n <= this.buf.length) return;
        let size = this.buf.length * 2;
        while (size < this.len + n) size *= 2;
        const next = new Uint8Array(size);
        next.set(this.buf.subarray(0, this.len));
        this.buf = next;
    }
    byte(b: number): void {
        this.grow(1);
        this.buf[this.len++] = b;
    }
    bytes(b: Uint8Array): void {
        this.grow(b.length);
        this.buf.set(b, this.len);
        this.len += b.length;
    }
    u16(v: number): void {
        this.byte(v >> 8);
        this.byte(v & 0xff);
    }
    marker(m: number): void {
        this.byte(0xff);
        this.byte(m);
    }
    result(): Uint8Array {
        return this.buf.subarray(0, this.len);
    }
}

/** Where a scan's symbols and bits go: counted (to build optimal tables) or
 *  written. */
interface Sink {
    symbol(table: number, sym: number): void;
    bits(value: number, n: number): void;
}

class CountingSink implements Sink {
    freqs: Int32Array[] = [];
    constructor(tables: number) {
        for (let i = 0; i < tables; i++) this.freqs.push(new Int32Array(257));
    }
    symbol(table: number, sym: number): void {
        this.freqs[table][sym]++;
    }
    bits(): void {}
}

class WritingSink implements Sink {
    private acc = 0;
    private cnt = 0;
    constructor(
        private out: ByteWriter,
        private codes: { code: Uint16Array; size: Uint8Array }[],
    ) {}
    symbol(table: number, sym: number): void {
        const t = this.codes[table];
        const size = t.size[sym];
        if (!size) throw new Error("symbol without a code");
        this.bits(t.code[sym], size);
    }
    bits(value: number, n: number): void {
        if (n === 0) return;
        this.acc = ((this.acc << n) | (value & ((1 << n) - 1))) >>> 0;
        this.cnt += n;
        while (this.cnt >= 8) {
            this.cnt -= 8;
            const b = (this.acc >>> this.cnt) & 0xff;
            this.out.byte(b);
            if (b === 0xff) this.out.byte(0);
        }
        this.acc &= (1 << this.cnt) - 1;
    }
    flush(): void {
        if (this.cnt > 0) this.bits(0x7f, 8 - this.cnt);
    }
}

/** libjpeg's jpeg_gen_optimal_table: code lengths (≤ 16) from frequencies. */
function optimalTable(freqIn: Int32Array): {
    counts: Uint8Array;
    values: Uint8Array;
} {
    const freq = Int32Array.from(freqIn);
    freq[256] = 1; // reserved, so no code is all ones
    const codesize = new Int32Array(257);
    const others = new Int32Array(257).fill(-1);
    for (;;) {
        let c1 = -1;
        let v = 0x7fffffff;
        for (let i = 0; i <= 256; i++) {
            if (freq[i] && freq[i] <= v) {
                v = freq[i];
                c1 = i;
            }
        }
        let c2 = -1;
        v = 0x7fffffff;
        for (let i = 0; i <= 256; i++) {
            if (freq[i] && freq[i] <= v && i !== c1) {
                v = freq[i];
                c2 = i;
            }
        }
        if (c2 < 0) break;
        freq[c1] += freq[c2];
        freq[c2] = 0;
        codesize[c1]++;
        while (others[c1] >= 0) {
            c1 = others[c1];
            codesize[c1]++;
        }
        others[c1] = c2;
        codesize[c2]++;
        while (others[c2] >= 0) {
            c2 = others[c2];
            codesize[c2]++;
        }
    }
    const bits = new Int32Array(33);
    for (let i = 0; i <= 256; i++) {
        if (codesize[i]) {
            if (codesize[i] > 32) throw new Error("code too long");
            bits[codesize[i]]++;
        }
    }
    for (let i = 32; i > 16; i--) {
        while (bits[i] > 0) {
            let j = i - 2;
            while (bits[j] === 0) j--;
            bits[i] -= 2;
            bits[i - 1]++;
            bits[j + 1] += 2;
            bits[j]--;
        }
    }
    let i = 16;
    while (i > 0 && bits[i] === 0) i--;
    if (i > 0) bits[i]--; // drop the reserved symbol's code
    const counts = new Uint8Array(16);
    for (let l = 1; l <= 16; l++) counts[l - 1] = bits[l];
    const values: number[] = [];
    for (let l = 1; l <= 32; l++) {
        for (let s = 0; s < 256; s++) if (codesize[s] === l) values.push(s);
    }
    // The reserved symbol (256) was the last one of the longest length, and
    // is not in `values` (it only ran to 255).
    return { counts, values: Uint8Array.from(values) };
}

function encoderCodes(t: { counts: Uint8Array; values: Uint8Array }) {
    const code = new Uint16Array(256);
    const size = new Uint8Array(256);
    let c = 0;
    let k = 0;
    for (let len = 1; len <= 16; len++) {
        for (let i = 0; i < t.counts[len - 1]; i++, k++, c++) {
            code[t.values[k]] = c;
            size[t.values[k]] = len;
        }
        c <<= 1;
    }
    return { code, size };
}

function bitLength(v: number): number {
    return v === 0 ? 0 : 32 - Math.clz32(v);
}

interface ScanSpec {
    comps: number[];
    ss: number;
    se: number;
    ah: number;
    al: number;
}

/** libjpeg's jpeg_simple_progression. */
function scanScript(frame: Frame): ScanSpec[] {
    const n = frame.components.length;
    const all = frame.components.map((_, i) => i);
    // An interleaved scan may hold at most 4 components and 10 blocks per MCU.
    const blocksPerMcu = frame.components.reduce((s, c) => s + c.h * c.v, 0);
    const dc = (ah: number, al: number): ScanSpec[] =>
        n <= 4 && blocksPerMcu <= 10
            ? [{ comps: all, ss: 0, se: 0, ah, al }]
            : all.map((c) => ({ comps: [c], ss: 0, se: 0, ah, al }));
    const ac = (c: number, ss: number, se: number, ah: number, al: number) => ({
        comps: [c],
        ss,
        se,
        ah,
        al,
    });
    if (n === 3) {
        return [
            ...dc(0, 1),
            ac(0, 1, 5, 0, 2),
            ac(2, 1, 63, 0, 1),
            ac(1, 1, 63, 0, 1),
            ac(0, 6, 63, 0, 2),
            ac(0, 1, 63, 2, 1),
            ...dc(1, 0),
            ac(2, 1, 63, 1, 0),
            ac(1, 1, 63, 1, 0),
            ac(0, 1, 63, 1, 0),
        ];
    }
    if (n === 1) {
        return [
            ...dc(0, 1),
            ac(0, 1, 5, 0, 2),
            ac(0, 6, 63, 0, 2),
            ac(0, 1, 63, 2, 1),
            ...dc(1, 0),
            ac(0, 1, 63, 1, 0),
        ];
    }
    return [
        ...dc(0, 1),
        ...all.map((c) => ac(c, 1, 63, 0, 1)),
        ...dc(1, 0),
        ...all.map((c) => ac(c, 1, 63, 1, 0)),
    ];
}

const MAX_CORR_BITS = 1000;

/** Run one progressive scan's symbols and bits into `sink` (jcphuff.c). */
function encodeScan(frame: Frame, scan: ScanSpec, sink: Sink): void {
    const comps = scan.comps.map((i) => frame.components[i]);
    const { ss, se, ah, al } = scan;

    if (ss === 0) {
        // DC scan, interleaved when it has more than one component.
        const preds = new Int32Array(comps.length);
        const dcBlock = (ci: number, at: number) => {
            const coef = comps[ci].coef[at];
            if (ah) {
                sink.bits((coef >> al) & 1, 1);
                return;
            }
            const v = coef >> al;
            let diff = v - preds[ci];
            preds[ci] = v;
            let bitsVal = diff;
            if (diff < 0) {
                diff = -diff;
                bitsVal--;
            }
            const nbits = bitLength(diff);
            sink.symbol(ci, nbits);
            sink.bits(bitsVal, nbits);
        };
        if (comps.length === 1) {
            const c = comps[0];
            for (let by = 0; by < c.blocksH; by++) {
                for (let bx = 0; bx < c.blocksW; bx++) {
                    dcBlock(0, (by * c.paddedW + bx) * 64);
                }
            }
        } else {
            for (let my = 0; my < frame.mcusY; my++) {
                for (let mx = 0; mx < frame.mcusX; mx++) {
                    for (let ci = 0; ci < comps.length; ci++) {
                        const c = comps[ci];
                        for (let v = 0; v < c.v; v++) {
                            for (let h = 0; h < c.h; h++) {
                                const at =
                                    ((my * c.v + v) * c.paddedW +
                                        mx * c.h +
                                        h) *
                                    64;
                                dcBlock(ci, at);
                            }
                        }
                    }
                }
            }
        }
        return;
    }

    // AC scan: always one component.
    const c = comps[0];
    let eobrun = 0;
    const corr = new Uint8Array(MAX_CORR_BITS + 64);
    let be = 0;
    const emitEobrun = () => {
        if (eobrun > 0) {
            const nbits = bitLength(eobrun) - 1;
            sink.symbol(0, nbits << 4);
            sink.bits(eobrun, nbits);
            eobrun = 0;
            for (let i = 0; i < be; i++) sink.bits(corr[i], 1);
            be = 0;
        }
    };
    const abs = new Int32Array(64);

    for (let by = 0; by < c.blocksH; by++) {
        for (let bx = 0; bx < c.blocksW; bx++) {
            const at = (by * c.paddedW + bx) * 64;
            const coef = c.coef;
            if (ah === 0) {
                let r = 0;
                for (let k = ss; k <= se; k++) {
                    let t = coef[at + k];
                    if (t === 0) {
                        r++;
                        continue;
                    }
                    let t2: number;
                    if (t < 0) {
                        t = -t >> al;
                        t2 = ~t;
                    } else {
                        t >>= al;
                        t2 = t;
                    }
                    if (t === 0) {
                        r++;
                        continue;
                    }
                    emitEobrun();
                    while (r > 15) {
                        sink.symbol(0, 0xf0);
                        r -= 16;
                    }
                    const nbits = bitLength(t);
                    sink.symbol(0, (r << 4) + nbits);
                    sink.bits(t2, nbits);
                    r = 0;
                }
                if (r > 0) {
                    eobrun++;
                    if (eobrun === 0x7fff) emitEobrun();
                }
            } else {
                let eob = 0;
                for (let k = ss; k <= se; k++) {
                    let t = coef[at + k];
                    if (t < 0) t = -t;
                    t >>= al;
                    abs[k] = t;
                    if (t === 1) eob = k;
                }
                let r = 0;
                let br = 0;
                let brStart = be;
                for (let k = ss; k <= se; k++) {
                    const t = abs[k];
                    if (t === 0) {
                        r++;
                        continue;
                    }
                    while (r > 15 && k <= eob) {
                        emitEobrun();
                        sink.symbol(0, 0xf0);
                        r -= 16;
                        for (let i = 0; i < br; i++)
                            sink.bits(corr[brStart + i], 1);
                        brStart = 0;
                        br = 0;
                    }
                    if (t > 1) {
                        corr[brStart + br++] = t & 1;
                        continue;
                    }
                    emitEobrun();
                    sink.symbol(0, (r << 4) + 1);
                    sink.bits(coef[at + k] < 0 ? 0 : 1, 1);
                    for (let i = 0; i < br; i++)
                        sink.bits(corr[brStart + i], 1);
                    brStart = 0;
                    br = 0;
                    r = 0;
                }
                if (r > 0 || br > 0) {
                    eobrun++;
                    be += br;
                    if (eobrun === 0x7fff || be > MAX_CORR_BITS - 64 + 1) {
                        emitEobrun();
                    }
                }
            }
        }
    }
    emitEobrun();
}

// ── Top level ───────────────────────────────────────────────────────────────

/**
 * The progressive rewrite of `data`, or null when it is not a baseline JPEG
 * this can rewrite safely (send the original then).
 */
export function jpegToProgressive(data: Uint8Array): Uint8Array | null {
    try {
        return transcode(data);
    } catch (err) {
        if (err instanceof Unsupported || err instanceof RangeError)
            return null;
        throw err;
    }
}

function transcode(data: Uint8Array): Uint8Array | null {
    if (data.length < 4 || data[0] !== 0xff || data[1] !== M_SOI) return null;
    const u16 = (p: number) => {
        if (p + 1 >= data.length) throw new Unsupported("truncated");
        return (data[p] << 8) | data[p + 1];
    };

    /** Segments copied ahead of the new frame header, in order. */
    const keep: Uint8Array[] = [];
    const dqtIds = new Set<number>();
    const dcTables = new Map<number, HuffDecoder>();
    const acTables = new Map<number, HuffDecoder>();
    let frame: Frame | null = null;
    let sofPayload: Uint8Array | null = null;
    let restartInterval = 0;
    let scanned = false;
    let pos = 2;

    for (;;) {
        if (data[pos] !== 0xff) throw new Unsupported("expected a marker");
        while (data[pos + 1] === 0xff) pos++; // fill bytes
        const m = data[pos + 1];
        pos += 2;
        if (m === M_EOI) {
            // Anything after the image belongs to something else (motion
            // photo video, a second picture) that may index into this file.
            if (pos < data.length) return null;
            break;
        }
        if (m >= 0xd0 && m <= 0xd7) throw new Unsupported("stray RST");
        const len = u16(pos);
        if (len < 2 || pos + len > data.length)
            throw new Unsupported("bad length");
        const seg = data.subarray(pos + 2, pos + len);
        const whole = data.subarray(pos - 2, pos + len);
        pos += len;

        if (m === M_SOF0 || m === M_SOF1) {
            if (frame) throw new Unsupported("two frames");
            frame = parseFrame(seg);
            sofPayload = seg;
        } else if (m >= M_SOF2 && m <= 0xcf && m !== M_DHT) {
            // Progressive, lossless, hierarchical or arithmetic-coded.
            return null;
        } else if (m === M_DHT) {
            parseDht(seg, dcTables, acTables);
        } else if (m === M_DQT) {
            if (scanned) throw new Unsupported("DQT between scans");
            for (const id of dqtIdsOf(seg)) {
                if (dqtIds.has(id)) throw new Unsupported("DQT redefined");
                dqtIds.add(id);
            }
            keep.push(whole);
        } else if (m === M_DRI) {
            if (seg.length < 2) throw new Unsupported("bad DRI");
            restartInterval = (seg[0] << 8) | seg[1];
        } else if (m === M_SOS) {
            if (!frame) throw new Unsupported("scan before frame");
            pos = readScanHeaderAndData(
                data,
                seg,
                pos,
                frame,
                dcTables,
                acTables,
                restartInterval,
            );
            scanned = true;
        } else if ((m >= 0xe0 && m <= 0xef) || m === M_COM) {
            if (scanned) {
                // Metadata after the image data: rare, and nothing needs it.
                if (m !== M_COM) throw new Unsupported("APP after scans");
                continue;
            }
            if (m === 0xe2 && isMpf(seg)) return null;
            keep.push(whole);
        } else if (m === 0xdc) {
            throw new Unsupported("DNL");
        } else {
            throw new Unsupported("unknown marker");
        }
        if (pos >= data.length) throw new Unsupported("no EOI");
    }

    if (!frame || !sofPayload || !scanned) return null;
    if (frame.components.some((c) => !c.seen)) return null;

    const out = new ByteWriter(data.length);
    out.marker(M_SOI);
    for (const seg of keep) out.bytes(seg);
    out.marker(M_SOF2);
    out.u16(sofPayload.length + 2);
    out.bytes(sofPayload);

    for (const scan of scanScript(frame)) writeScan(out, frame, scan);
    out.marker(M_EOI);
    return out.result();
}

function isMpf(seg: Uint8Array): boolean {
    return (
        seg.length >= 4 &&
        seg[0] === 0x4d &&
        seg[1] === 0x50 &&
        seg[2] === 0x46 &&
        seg[3] === 0
    );
}

function dqtIdsOf(seg: Uint8Array): number[] {
    const ids: number[] = [];
    let p = 0;
    while (p < seg.length) {
        const pq = seg[p] >> 4;
        const id = seg[p] & 15;
        if (pq > 1 || id > 3) throw new Unsupported("bad DQT");
        ids.push(id);
        p += 1 + 64 * (pq + 1);
    }
    if (p !== seg.length) throw new Unsupported("bad DQT length");
    return ids;
}

function parseFrame(seg: Uint8Array): Frame {
    if (seg.length < 6) throw new Unsupported("bad SOF");
    if (seg[0] !== 8) throw new Unsupported("not 8-bit");
    const height = (seg[1] << 8) | seg[2];
    const width = (seg[3] << 8) | seg[4];
    const n = seg[5];
    if (!width || !height) throw new Unsupported("no size");
    if (n < 1 || n > 4 || seg.length !== 6 + 3 * n) {
        throw new Unsupported("bad component count");
    }
    const raw = [];
    for (let i = 0; i < n; i++) {
        const p = 6 + 3 * i;
        const h = seg[p + 1] >> 4;
        const v = seg[p + 1] & 15;
        if (h < 1 || h > 4 || v < 1 || v > 4)
            throw new Unsupported("bad sampling");
        raw.push({ id: seg[p], h, v, tq: seg[p + 2] });
    }
    if (new Set(raw.map((c) => c.id)).size !== n) {
        throw new Unsupported("duplicate component id");
    }
    const hmax = Math.max(...raw.map((c) => c.h));
    const vmax = Math.max(...raw.map((c) => c.v));
    const mcusX = Math.ceil(width / (8 * hmax));
    const mcusY = Math.ceil(height / (8 * vmax));
    let bytes = 0;
    const components: Component[] = raw.map((c) => {
        const paddedW = mcusX * c.h;
        const paddedH = mcusY * c.v;
        bytes += paddedW * paddedH * 128;
        return {
            ...c,
            blocksW: Math.ceil(Math.ceil((width * c.h) / hmax) / 8),
            blocksH: Math.ceil(Math.ceil((height * c.v) / vmax) / 8),
            paddedW,
            paddedH,
            coef: new Int16Array(0),
            seen: false,
        };
    });
    if (bytes > MAX_COEFFICIENT_BYTES) throw new Unsupported("too big");
    for (const c of components)
        c.coef = new Int16Array(c.paddedW * c.paddedH * 64);
    return { width, height, hmax, vmax, mcusX, mcusY, components };
}

function parseDht(
    seg: Uint8Array,
    dc: Map<number, HuffDecoder>,
    ac: Map<number, HuffDecoder>,
): void {
    let p = 0;
    while (p < seg.length) {
        if (p + 17 > seg.length) throw new Unsupported("bad DHT");
        const tc = seg[p] >> 4;
        const th = seg[p] & 15;
        if (tc > 1 || th > 3) throw new Unsupported("bad DHT class/id");
        const counts = seg.subarray(p + 1, p + 17);
        let total = 0;
        for (let i = 0; i < 16; i++) total += counts[i];
        if (total > 256 || p + 17 + total > seg.length) {
            throw new Unsupported("bad DHT counts");
        }
        const values = seg.subarray(p + 17, p + 17 + total);
        (tc === 0 ? dc : ac).set(th, buildDecoder(counts, values));
        p += 17 + total;
    }
}

function readScanHeaderAndData(
    data: Uint8Array,
    seg: Uint8Array,
    pos: number,
    frame: Frame,
    dcTables: Map<number, HuffDecoder>,
    acTables: Map<number, HuffDecoder>,
    restartInterval: number,
): number {
    const ns = seg[0];
    if (ns < 1 || ns > 4 || seg.length !== 4 + 2 * ns) {
        throw new Unsupported("bad SOS");
    }
    const scanComps = [];
    for (let i = 0; i < ns; i++) {
        const id = seg[1 + 2 * i];
        const tables = seg[2 + 2 * i];
        const comp = frame.components.find((c) => c.id === id);
        if (!comp || comp.seen) throw new Unsupported("bad scan component");
        comp.seen = true;
        const dc = dcTables.get(tables >> 4);
        const ac = acTables.get(tables & 15);
        if (!dc || !ac) throw new Unsupported("missing Huffman table");
        scanComps.push({ comp, dc, ac });
    }
    const ss = seg[1 + 2 * ns];
    const se = seg[2 + 2 * ns];
    const a = seg[3 + 2 * ns];
    if (ss !== 0 || se !== 63 || a !== 0)
        throw new Unsupported("not sequential");
    if (ns > 1 && scanComps.reduce((s, c) => s + c.comp.h * c.comp.v, 0) > 10) {
        throw new Unsupported("MCU too big");
    }
    return readScan(data, pos, frame, scanComps, restartInterval);
}

function writeScan(out: ByteWriter, frame: Frame, scan: ScanSpec): void {
    const isDc = scan.ss === 0;
    const refineDc = isDc && scan.ah > 0;
    const tableCount = refineDc ? 0 : isDc ? scan.comps.length : 1;

    let codes: { code: Uint16Array; size: Uint8Array }[] = [];
    if (tableCount) {
        const counter = new CountingSink(tableCount);
        encodeScan(frame, scan, counter);
        const tables = counter.freqs.map(optimalTable);
        codes = tables.map(encoderCodes);
        out.marker(M_DHT);
        out.u16(2 + tables.reduce((s, t) => s + 17 + t.values.length, 0));
        tables.forEach((t, i) => {
            out.byte(((isDc ? 0 : 1) << 4) | i);
            out.bytes(t.counts);
            out.bytes(t.values);
        });
    }

    out.marker(M_SOS);
    out.u16(6 + 2 * scan.comps.length);
    out.byte(scan.comps.length);
    scan.comps.forEach((ci, i) => {
        out.byte(frame.components[ci].id);
        out.byte(isDc && !refineDc ? i << 4 : 0);
    });
    out.byte(scan.ss);
    out.byte(scan.se);
    out.byte((scan.ah << 4) | scan.al);

    const writer = new WritingSink(out, codes);
    encodeScan(frame, scan, writer);
    writer.flush();
}
