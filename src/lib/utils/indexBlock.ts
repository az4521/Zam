/**
 * Compact binary format for one block of the chat search index.
 *
 * A block holds up to MAX_COUNT messages. Each message is identified by a
 * 32-bit hash of its event id plus its timestamp, so full event ids are not
 * stored. The block is split into two parts:
 *
 * - `meta`: a fixed header followed by the (possibly compressed) columnar
 *   metadata payload: sender and msgtype tables, index columns, timestamps,
 *   hashes, flags, edit targets and gallery lists. Cheap to decode, so the
 *   keys of a block can be read without touching the bodies.
 * - `body`: the (possibly compressed) message bodies, each as UTF-8 followed
 *   by a 0x00 byte, in entry order.
 *
 * All integers are little endian. Unsigned values use LEB128 varints, signed
 * values zigzag varints. Every decode path is bounds-checked: untrusted input
 * either decodes or throws an Error.
 */
import { ppmdDecode, ppmdEncode } from "./ppmd";

/** One indexed message as the search layer sees it. */
export interface CompactEntry {
    /** eventIdHash of the event id. */
    h: number;
    /** Timestamp in ms since the epoch, a non-negative safe integer. */
    t: number;
    s: string;
    m: string;
    b: string;
    v?: 1;
    /** eventIdHash of the edited event id. */
    o?: number;
    /** origin_server_ts of the edited event. With `o` it names the original
     *  exactly (hash AND timestamp); absent when it could not be found. */
    ot?: number;
    g?: string[];
}

/**
 * Turns a raw payload into stored bytes plus the codec parameters needed to
 * reverse it. `decode` accepts every codec id this module writes, so a block
 * written with one codec decodes with any codec that understands its id.
 */
export interface BlockCodec {
    encode(
        raw: Uint8Array,
        kind: "meta" | "body",
    ): { data: Uint8Array; codec: number; p1: number; p2: number };
    decode(
        data: Uint8Array,
        rawSize: number,
        codec: number,
        p1: number,
        p2: number,
    ): Uint8Array;
}

export interface EncodedIndexBlock {
    meta: Uint8Array;
    body: Uint8Array;
}

export interface BlockKeys {
    count: number;
    h: Uint32Array;
    t: Float64Array;
    minTs: number;
    maxTs: number;
    bodyRaw: number;
    /** For each edit that names its original's timestamp, in entry order:
     *  eventIdHash of the original (`targets`) and its timestamp
     *  (`targetTs`). Lets a redaction check a block without decoding bodies. */
    targets: Uint32Array;
    targetTs: Float64Array;
}

const FORMAT_VERSION = 2;
const CODEC_STORED = 0;
const CODEC_PPMD = 1;
const MAX_COUNT = 200000;
const MAX_RAW_SIZE = 64 * 1024 * 1024;
/** Tables may hold up to count + TABLE_SLACK strings. */
const TABLE_SLACK = 64;
/** Largest varint the reader accepts; zigzag deltas of safe ints fit. */
const MAX_VARINT = 2 ** 54;
const FLAG_V = 1;
const FLAG_O = 2;
const FLAG_G = 4;
/** The entry has `ot`; its column follows the `o` column. */
const FLAG_T = 8;
const FLAG_MASK = FLAG_V | FLAG_O | FLAG_G | FLAG_T;

/* PPMd parameters. Tune here: meta is small and benefits from a short order,
 * bodies are text and get a longer context and a bigger model. */
const META_PPMD_ORDER = 4;
const META_PPMD_LOG2_MEM = 22;
const BODY_PPMD_ORDER = 8;
const BODY_PPMD_LOG2_MEM = 24;
/** Bounds on untrusted PPMd parameters, so a bad header cannot ask for a
 * huge model allocation. */
const PPMD_MIN_ORDER = 2;
const PPMD_MAX_ORDER = 64;
const PPMD_MIN_LOG2_MEM = 16;
const PPMD_MAX_LOG2_MEM = 26;

const encoder = new TextEncoder();
const strictDecoder = new TextDecoder("utf-8", { fatal: true });

function corrupt(message: string): Error {
    return new Error(`index block: ${message}`);
}

function decodeUtf8(bytes: Uint8Array): string {
    try {
        return strictDecoder.decode(bytes);
    } catch {
        throw corrupt("invalid UTF-8 string");
    }
}

/** FNV-1a 32-bit over the UTF-16 code units of the id string, as uint32. */
export function eventIdHash(id: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < id.length; i++) {
        h ^= id.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

class ByteWriter {
    private buf = new Uint8Array(256);
    private len = 0;

    private reserve(n: number): void {
        if (this.len + n <= this.buf.length) return;
        let cap = this.buf.length * 2;
        while (cap < this.len + n) cap *= 2;
        const next = new Uint8Array(cap);
        next.set(this.buf.subarray(0, this.len));
        this.buf = next;
    }

    u8(v: number): void {
        this.reserve(1);
        this.buf[this.len++] = v;
    }

    u32(v: number): void {
        this.reserve(4);
        this.buf[this.len++] = v & 0xff;
        this.buf[this.len++] = (v >>> 8) & 0xff;
        this.buf[this.len++] = (v >>> 16) & 0xff;
        this.buf[this.len++] = (v >>> 24) & 0xff;
    }

    /** Unsigned LEB128 of a non-negative safe integer. */
    varint(v: number): void {
        let x = v;
        while (x >= 128) {
            this.u8((x % 128) + 128);
            x = Math.floor(x / 128);
        }
        this.u8(x);
    }

    bytes(b: Uint8Array): void {
        this.reserve(b.length);
        this.buf.set(b, this.len);
        this.len += b.length;
    }

    string(s: string): void {
        const b = encoder.encode(s);
        this.varint(b.length);
        this.bytes(b);
    }

    finish(): Uint8Array {
        return this.buf.slice(0, this.len);
    }
}

class ByteReader {
    readonly buf: Uint8Array;
    pos = 0;

    constructor(buf: Uint8Array) {
        this.buf = buf;
    }

    get remaining(): number {
        return this.buf.length - this.pos;
    }

    u8(): number {
        if (this.pos >= this.buf.length) throw corrupt("truncated");
        return this.buf[this.pos++];
    }

    u32(): number {
        const b = this.bytes(4);
        return b[0] + b[1] * 0x100 + b[2] * 0x10000 + b[3] * 0x1000000;
    }

    varint(): number {
        let value = 0;
        let mul = 1;
        for (let i = 0; i < 8; i++) {
            const b = this.u8();
            value += (b & 0x7f) * mul;
            if ((b & 0x80) === 0) {
                if (value > MAX_VARINT) throw corrupt("varint out of range");
                return value;
            }
            mul *= 128;
        }
        throw corrupt("varint too long");
    }

    bytes(n: number): Uint8Array {
        if (!Number.isInteger(n) || n < 0 || n > this.remaining) {
            throw corrupt("truncated");
        }
        const out = this.buf.subarray(this.pos, this.pos + n);
        this.pos += n;
        return out;
    }

    string(): string {
        const n = this.varint();
        return decodeUtf8(this.bytes(n));
    }
}

function storedEncode(raw: Uint8Array): {
    data: Uint8Array;
    codec: number;
    p1: number;
    p2: number;
} {
    return { data: raw, codec: CODEC_STORED, p1: 0, p2: 0 };
}

function storedDecode(data: Uint8Array, rawSize: number): Uint8Array {
    if (data.length !== rawSize) throw corrupt("stored size mismatch");
    return data;
}

/** Identity codec (codec 0 only), for tests and debugging. */
export const storedBlockCodec: BlockCodec = {
    encode(raw) {
        return storedEncode(raw);
    },
    decode(data, rawSize, codec) {
        if (codec !== CODEC_STORED) throw corrupt(`codec ${codec} unsupported`);
        return storedDecode(data, rawSize);
    },
};

/**
 * PPMd codec for production. Falls back to stored bytes for empty input or
 * when PPMd does not shrink the payload.
 */
export const ppmdBlockCodec: BlockCodec = {
    encode(raw, kind) {
        if (raw.length === 0) return storedEncode(raw);
        const order = kind === "meta" ? META_PPMD_ORDER : BODY_PPMD_ORDER;
        const log2 = kind === "meta" ? META_PPMD_LOG2_MEM : BODY_PPMD_LOG2_MEM;
        const data = ppmdEncode(raw, { order, memSize: 2 ** log2 });
        if (data.length >= raw.length) return storedEncode(raw);
        return { data, codec: CODEC_PPMD, p1: order, p2: log2 };
    },
    decode(data, rawSize, codec, p1, p2) {
        if (codec === CODEC_STORED) return storedDecode(data, rawSize);
        if (codec !== CODEC_PPMD) throw corrupt(`codec ${codec} unsupported`);
        if (
            p1 < PPMD_MIN_ORDER ||
            p1 > PPMD_MAX_ORDER ||
            p2 < PPMD_MIN_LOG2_MEM ||
            p2 > PPMD_MAX_LOG2_MEM
        ) {
            throw corrupt("PPMd parameters out of range");
        }
        const out = ppmdDecode(data, rawSize, { order: p1, memSize: 2 ** p2 });
        if (out.length !== rawSize) throw corrupt("PPMd size mismatch");
        return out;
    },
};

function checkEntry(e: CompactEntry): void {
    if (!Number.isSafeInteger(e.t) || e.t < 0) {
        throw new Error(
            "index block: timestamp must be a non-negative integer",
        );
    }
    if (!Number.isInteger(e.h) || e.h < 0 || e.h > 0xffffffff) {
        throw new Error("index block: hash must be a uint32");
    }
    if (typeof e.s !== "string" || typeof e.m !== "string") {
        throw new Error("index block: sender and msgtype must be strings");
    }
    if (typeof e.b !== "string")
        throw new Error("index block: body must be a string");
    if (
        e.o !== undefined &&
        (!Number.isInteger(e.o) || e.o < 0 || e.o > 0xffffffff)
    ) {
        throw new Error("index block: edit target must be a uint32");
    }
    if (e.ot !== undefined) {
        if (e.o === undefined) {
            throw new Error("index block: origin time without an edit target");
        }
        if (!Number.isSafeInteger(e.ot) || e.ot < 0) {
            throw new Error(
                "index block: origin time must be a non-negative integer",
            );
        }
    }
}

/** Zigzag of a signed safe integer, as an unsigned varint payload. */
function zigzag(d: number): number {
    return d >= 0 ? 2 * d : -2 * d - 1;
}

function unzigzag(z: number): number {
    return z % 2 === 0 ? z / 2 : -(z + 1) / 2;
}

/** Maps a string to its table index, appending it on first sight. */
function intern(
    map: Map<string, number>,
    list: string[],
    value: string,
): number {
    let i = map.get(value);
    if (i === undefined) {
        i = list.length;
        list.push(value);
        map.set(value, i);
    }
    return i;
}

function writeTable(w: ByteWriter, table: readonly string[]): void {
    w.varint(table.length);
    for (const s of table) w.string(s);
}

function writeIndexColumn(
    w: ByteWriter,
    indexes: readonly number[],
    tableSize: number,
): void {
    const narrow = tableSize <= 255;
    for (const i of indexes) {
        if (narrow) w.u8(i);
        else w.varint(i);
    }
}

/**
 * Encodes entries into one block. Entries are stably sorted by timestamp on
 * a copy; the caller's array is not modified. A U+0000 in a body is written
 * as U+FFFD, since bodies are NUL-terminated.
 */
export function encodeIndexBlock(
    entries: readonly CompactEntry[],
    codec: BlockCodec = ppmdBlockCodec,
): EncodedIndexBlock {
    const count = entries.length;
    if (count > MAX_COUNT) throw new Error("index block: too many entries");
    for (const e of entries) checkEntry(e);
    const sorted = entries.slice().sort((a, b) => a.t - b.t);

    const senderMap = new Map<string, number>();
    const senders: string[] = [];
    const msgMap = new Map<string, number>();
    const msgtypes: string[] = [];
    const senderIdx: number[] = [];
    const msgIdx: number[] = [];
    for (const e of sorted) {
        senderIdx.push(intern(senderMap, senders, e.s));
        msgIdx.push(intern(msgMap, msgtypes, e.m));
    }
    const gIdx: number[][] = [];
    for (const e of sorted) {
        if (e.g === undefined) continue;
        gIdx.push(e.g.map((g) => intern(msgMap, msgtypes, g)));
    }
    if (msgtypes.length > count + TABLE_SLACK) {
        throw new Error("index block: too many distinct msgtype strings");
    }

    const w = new ByteWriter();
    writeTable(w, senders);
    writeTable(w, msgtypes);
    writeIndexColumn(w, senderIdx, senders.length);
    writeIndexColumn(w, msgIdx, msgtypes.length);
    if (count > 0) {
        w.varint(sorted[0].t);
        for (let i = 1; i < count; i++) {
            // Sorted, so the delta is non-negative; zigzag of d >= 0 is 2d.
            w.varint(2 * (sorted[i].t - sorted[i - 1].t));
        }
    }
    for (const e of sorted) w.u32(e.h);
    for (const e of sorted) {
        w.u8(
            (e.v !== undefined ? FLAG_V : 0) |
                (e.o !== undefined ? FLAG_O : 0) |
                (e.g !== undefined ? FLAG_G : 0) |
                (e.ot !== undefined ? FLAG_T : 0),
        );
    }
    for (const e of sorted) {
        if (e.o !== undefined) w.u32(e.o);
    }
    for (const e of sorted) {
        // Signed difference from the entry's own time; usually small.
        if (e.ot !== undefined) w.varint(zigzag(e.t - e.ot));
    }
    let gi = 0;
    for (const e of sorted) {
        if (e.g === undefined) continue;
        const ids = gIdx[gi++];
        w.varint(ids.length);
        for (const id of ids) w.varint(id);
    }
    const rawMeta = w.finish();

    const bw = new ByteWriter();
    for (const e of sorted) {
        bw.bytes(encoder.encode(e.b.split("\u0000").join("�")));
        bw.u8(0);
    }
    const rawBody = bw.finish();
    if (rawBody.length > MAX_RAW_SIZE || rawMeta.length > MAX_RAW_SIZE) {
        throw new Error("index block: payload too large");
    }

    const mc = codec.encode(rawMeta, "meta");
    const bc = codec.encode(rawBody, "body");
    const hw = new ByteWriter();
    hw.u8(FORMAT_VERSION);
    hw.varint(count);
    hw.u8(mc.codec);
    hw.u8(mc.p1);
    hw.u8(mc.p2);
    hw.varint(rawMeta.length);
    hw.u8(bc.codec);
    hw.u8(bc.p1);
    hw.u8(bc.p2);
    hw.varint(rawBody.length);
    hw.bytes(mc.data);
    return { meta: hw.finish(), body: bc.data };
}

interface ParsedMeta {
    count: number;
    bodyRaw: number;
    bodyCodec: number;
    bodyP1: number;
    bodyP2: number;
    senders: string[];
    msgtypes: string[];
    senderIdx: number[];
    msgIdx: number[];
    t: Float64Array;
    h: Uint32Array;
    flags: Uint8Array;
    o: Uint32Array;
    ot: (number | undefined)[];
    g: (string[] | undefined)[];
}

function readTable(r: ByteReader, limit: number): string[] {
    const k = r.varint();
    if (k > limit) throw corrupt("table too large");
    const out: string[] = [];
    for (let i = 0; i < k; i++) out.push(r.string());
    return out;
}

function readIndexColumn(
    r: ByteReader,
    count: number,
    tableSize: number,
): number[] {
    const narrow = tableSize <= 255;
    const out: number[] = [];
    for (let i = 0; i < count; i++) {
        const v = narrow ? r.u8() : r.varint();
        if (v >= tableSize) throw corrupt("table index out of range");
        out.push(v);
    }
    return out;
}

function readTimestamps(r: ByteReader, count: number): Float64Array {
    const out = new Float64Array(count);
    if (count === 0) return out;
    let prev = r.varint();
    if (!Number.isSafeInteger(prev)) throw corrupt("timestamp out of range");
    out[0] = prev;
    for (let i = 1; i < count; i++) {
        const z = r.varint();
        // Encoder only writes non-negative deltas (zigzag even values).
        if (z % 2 !== 0) throw corrupt("negative timestamp delta");
        prev += z / 2;
        if (!Number.isSafeInteger(prev))
            throw corrupt("timestamp out of range");
        out[i] = prev;
    }
    return out;
}

function readHeaderAndMeta(meta: Uint8Array): {
    count: number;
    metaCodec: number;
    metaP1: number;
    metaP2: number;
    metaRaw: number;
    bodyRaw: number;
    bodyCodec: number;
    bodyP1: number;
    bodyP2: number;
    payload: Uint8Array;
} {
    const r = new ByteReader(meta);
    if (r.u8() !== FORMAT_VERSION) throw corrupt("unknown format version");
    const count = r.varint();
    if (count > MAX_COUNT) throw corrupt("count too large");
    const metaCodec = r.u8();
    const metaP1 = r.u8();
    const metaP2 = r.u8();
    const metaRaw = r.varint();
    if (metaRaw > MAX_RAW_SIZE) throw corrupt("meta size too large");
    const bodyCodec = r.u8();
    const bodyP1 = r.u8();
    const bodyP2 = r.u8();
    const bodyRaw = r.varint();
    if (bodyRaw > MAX_RAW_SIZE) throw corrupt("body size too large");
    return {
        count,
        metaCodec,
        metaP1,
        metaP2,
        metaRaw,
        bodyRaw,
        bodyCodec,
        bodyP1,
        bodyP2,
        payload: meta.subarray(r.pos),
    };
}

function parseMeta(meta: Uint8Array, codec: BlockCodec): ParsedMeta {
    const hdr = readHeaderAndMeta(meta);
    const raw = codec.decode(
        hdr.payload,
        hdr.metaRaw,
        hdr.metaCodec,
        hdr.metaP1,
        hdr.metaP2,
    );
    const count = hdr.count;
    const r = new ByteReader(raw);
    const senders = readTable(r, count + TABLE_SLACK);
    const msgtypes = readTable(r, count + TABLE_SLACK);
    const senderIdx = readIndexColumn(r, count, senders.length);
    const msgIdx = readIndexColumn(r, count, msgtypes.length);
    const t = readTimestamps(r, count);
    const h = new Uint32Array(count);
    for (let i = 0; i < count; i++) h[i] = r.u32();
    const flags = r.bytes(count);
    for (let i = 0; i < count; i++) {
        if ((flags[i] & ~FLAG_MASK) !== 0) throw corrupt("reserved flag bits");
    }
    const o = new Uint32Array(count);
    for (let i = 0; i < count; i++) {
        if (flags[i] & FLAG_O) o[i] = r.u32();
        else if (flags[i] & FLAG_T) throw corrupt("origin time without target");
    }
    const ot: (number | undefined)[] = new Array(count);
    for (let i = 0; i < count; i++) {
        if (!(flags[i] & FLAG_T)) continue;
        const v = t[i] - unzigzag(r.varint());
        if (!Number.isSafeInteger(v) || v < 0) {
            throw corrupt("origin time out of range");
        }
        ot[i] = v;
    }
    const g: (string[] | undefined)[] = new Array(count);
    for (let i = 0; i < count; i++) {
        if (!(flags[i] & FLAG_G)) continue;
        const n = r.varint();
        if (n > r.remaining) throw corrupt("gallery list too long");
        const list: string[] = [];
        for (let j = 0; j < n; j++) {
            const idx = r.varint();
            if (idx >= msgtypes.length)
                throw corrupt("table index out of range");
            list.push(msgtypes[idx]);
        }
        g[i] = list;
    }
    if (r.remaining !== 0) throw corrupt("trailing meta bytes");
    return {
        count,
        bodyRaw: hdr.bodyRaw,
        bodyCodec: hdr.bodyCodec,
        bodyP1: hdr.bodyP1,
        bodyP2: hdr.bodyP2,
        senders,
        msgtypes,
        senderIdx,
        msgIdx,
        t,
        h,
        flags,
        o,
        ot,
        g,
    };
}

/** Decodes only the meta part of a block; the body is never touched. */
export function decodeBlockKeys(
    block: EncodedIndexBlock,
    codec: BlockCodec = ppmdBlockCodec,
): BlockKeys {
    const p = parseMeta(block.meta, codec);
    const targetIdx: number[] = [];
    for (let i = 0; i < p.count; i++) {
        if (p.ot[i] !== undefined) targetIdx.push(i);
    }
    return {
        count: p.count,
        h: p.h,
        t: p.t,
        minTs: p.count > 0 ? p.t[0] : 0,
        maxTs: p.count > 0 ? p.t[p.count - 1] : 0,
        bodyRaw: p.bodyRaw,
        targets: Uint32Array.from(targetIdx.map((i) => p.o[i])),
        targetTs: Float64Array.from(targetIdx.map((i) => p.ot[i] as number)),
    };
}

/** Splits the raw body payload on its NUL terminators. */
function splitBodies(raw: Uint8Array, count: number): string[] {
    const out: string[] = [];
    let start = 0;
    for (;;) {
        const end = raw.indexOf(0, start);
        if (end < 0) break;
        if (out.length >= count) throw corrupt("too many body terminators");
        out.push(decodeUtf8(raw.subarray(start, end)));
        start = end + 1;
    }
    if (start !== raw.length || out.length !== count) {
        throw corrupt("body terminator count mismatch");
    }
    return out;
}

/** Decodes a full block, entries in ascending timestamp order. */
export function decodeIndexBlock(
    block: EncodedIndexBlock,
    codec: BlockCodec = ppmdBlockCodec,
): CompactEntry[] {
    const p = parseMeta(block.meta, codec);
    const rawBody = codec.decode(
        block.body,
        p.bodyRaw,
        p.bodyCodec,
        p.bodyP1,
        p.bodyP2,
    );
    const bodies = splitBodies(rawBody, p.count);
    const out: CompactEntry[] = [];
    for (let i = 0; i < p.count; i++) {
        const e: CompactEntry = {
            h: p.h[i],
            t: p.t[i],
            s: p.senders[p.senderIdx[i]],
            m: p.msgtypes[p.msgIdx[i]],
            b: bodies[i],
        };
        if (p.flags[i] & FLAG_V) e.v = 1;
        if (p.flags[i] & FLAG_O) e.o = p.o[i];
        if (p.ot[i] !== undefined) e.ot = p.ot[i];
        const g = p.g[i];
        if (g !== undefined) e.g = g;
        out.push(e);
    }
    return out;
}
