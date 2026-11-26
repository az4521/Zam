/**
 * Pieces of the to-device exchange that moves index blocks between a user's
 * own devices: which time ranges each room is still missing, and the blocks
 * that answer a request. Ranges are ms timestamps, both ends inclusive.
 *
 * Format negotiation: a request lists the block formats the asker reads
 * (`fmt`, currently [2]). Only those are answered. An answer's chunks carry
 * `fmt: 2` when they are format 2 blocks (indexBlock.ts); chunks without it
 * are legacy deflate JSON, which an older device sends and this one still
 * reads.
 *
 * SDK-free so it can be unit-tested; sending and storage live elsewhere.
 */
import {
    decodeIndexBlock,
    encodeIndexBlock,
    type CompactEntry,
} from "./indexBlock";
import {
    decodeLegacyBlock,
    entryKey,
    legacyToCompact,
    type LegacyIndexEntry,
} from "./eventIndex";

/** A time range in ms, both ends inclusive. */
export type Range = [from: number, to: number];

export const INDEX_SYNC_REQUEST = "moe.crafty.zam.index_sync.request";
export const INDEX_SYNC_BLOCK = "moe.crafty.zam.index_sync.block";

/** The block format this build writes and answers with. */
export const INDEX_SYNC_FORMAT = 2;

/** Asks a device for the entries it has in the given ranges, per room.
 *
 * `audit` carries how many entries the asker holds per UTC day, per room. A
 * hole the asker's coverage wrongly claims is covered (an index from before
 * coverage existed, a message it couldn't decrypt) never shows up in
 * `missing`; the counts let the other side spot it: a day where it holds
 * more entries is sent whole. Optional, so older senders still parse.
 *
 * `fmt` lists the block formats the asker reads. Optional: a request without
 * it comes from a device that only reads legacy blocks, and is not answered. */
export interface IndexSyncRequest {
    id: string;
    rooms: { roomId: string; missing: Range[] }[];
    audit?: { roomId: string; days: DayCount[] }[];
    fmt?: number[];
}

/** [UTC day number (ms / DAY_MS, floored), entries held that day]. */
export type DayCount = [day: number, count: number];

export const DAY_MS = 24 * 60 * 60_000;

/** One chunk of an answer. `data` is base64 of a format 2 chunk (varint
 *  metaLen, meta, body; see indexBlock.ts) when `fmt` is 2, otherwise base64
 *  of a legacy deflate-raw JSON array of entries. */
export interface IndexSyncBlock {
    id: string;
    roomId: string;
    range: Range;
    seq: number;
    total: number;
    data: string;
    fmt?: 2;
}

/** Limits the parse functions enforce on untrusted input. */
const MAX_TOTAL = 1000;
const MAX_DATA = 100_000;
const MAX_ROOMS = 200;
const MAX_RANGES = 50;
const MAX_FMT = 8;
/** Day counts one request may carry, across all its rooms. */
export const MAX_AUDIT_DAYS = 2500;

/** Whether a range has finite ends in order. */
function validRange(r: Range): boolean {
    return Number.isFinite(r[0]) && Number.isFinite(r[1]) && r[0] <= r[1];
}

/** A sorted, merged, non-overlapping copy. Ranges within 1 ms of each other
 *  merge, so [0, 4] and [5, 9] become [0, 9]. Invalid ranges are dropped. */
function normalize(ranges: readonly Range[]): Range[] {
    const sorted = ranges
        .filter(validRange)
        .map((r): Range => [r[0], r[1]])
        .sort((a, b) => a[0] - b[0]);
    const out: Range[] = [];
    for (const r of sorted) {
        const last = out[out.length - 1];
        if (last && r[0] <= last[1] + 1) {
            if (r[1] > last[1]) last[1] = r[1];
        } else {
            out.push(r);
        }
    }
    return out;
}

/** `ranges` with `r` added: sorted, merged, non-overlapping. Does not mutate. */
export function addRange(ranges: Range[], r: Range): Range[] {
    return normalize([...ranges, r]);
}

/** The parts of `want` that no range in `have` covers, sorted. */
export function subtractRanges(want: Range, have: Range[]): Range[] {
    if (!validRange(want)) return [];
    const out: Range[] = [];
    let cursor = want[0];
    for (const [from, to] of normalize(have)) {
        if (to < cursor) continue;
        if (from > want[1]) break;
        if (from - 1 >= cursor) out.push([cursor, from - 1]);
        cursor = to + 1;
        if (cursor > want[1]) return out;
    }
    if (cursor <= want[1]) out.push([cursor, want[1]]);
    return out;
}

/** The parts covered by both `a` and `b`, sorted. */
export function intersectRanges(a: Range[], b: Range[]): Range[] {
    const x = normalize(a);
    const y = normalize(b);
    const out: Range[] = [];
    let i = 0;
    let j = 0;
    while (i < x.length && j < y.length) {
        const from = Math.max(x[i][0], y[j][0]);
        const to = Math.min(x[i][1], y[j][1]);
        if (from <= to) out.push([from, to]);
        if (x[i][1] < y[j][1]) i++;
        else j++;
    }
    return out;
}

/** Whether `ranges` cover all of `r`. An invalid `r` is never covered. */
export function rangesCover(ranges: Range[], r: Range): boolean {
    if (!validRange(r)) return false;
    return subtractRanges(r, ranges).length === 0;
}

function toBase64(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
}

function fromBase64(s: string): Uint8Array {
    const binary = atob(s);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
}

/** The format 2 chunk for these entries: varint(meta length), meta, body. */
function packV2(meta: Uint8Array, body: Uint8Array): Uint8Array {
    const head: number[] = [];
    let n = meta.length;
    while (n >= 128) {
        head.push((n % 128) + 128);
        n = Math.floor(n / 128);
    }
    head.push(n);
    const out = new Uint8Array(head.length + meta.length + body.length);
    out.set(head, 0);
    out.set(meta, head.length);
    out.set(body, head.length + meta.length);
    return out;
}

/** Entries of a format 2 chunk. Throws on malformed input. */
function unpackV2(bytes: Uint8Array): CompactEntry[] {
    let pos = 0;
    let len = 0;
    let mul = 1;
    for (;;) {
        if (pos >= bytes.length || pos >= 5) {
            throw new Error("index sync: bad chunk header");
        }
        const b = bytes[pos++];
        len += (b & 0x7f) * mul;
        mul *= 128;
        if ((b & 0x80) === 0) break;
    }
    if (len > bytes.length - pos) throw new Error("index sync: bad chunk");
    return decodeIndexBlock({
        meta: bytes.subarray(pos, pos + len),
        body: bytes.subarray(pos + len),
    });
}

/** Base64 of the format 2 chunk for these entries. */
function encodeChunk(entries: CompactEntry[]): string {
    const block = encodeIndexBlock(entries);
    return toBase64(packV2(block.meta, block.body));
}

/**
 * Shorten the body of one entry until its encoded block fits. Each step keeps
 * a fraction of the body sized from the overshoot, so it converges quickly.
 */
function fitSingle(
    entry: CompactEntry,
    text: string,
    maxBytes: number,
): string {
    let body = entry.b;
    let fitted = text;
    while (fitted.length > maxBytes && body.length > 0) {
        const keep = Math.min(
            body.length - 1,
            Math.floor(body.length * (maxBytes / fitted.length) * 0.9),
        );
        body = body.slice(0, Math.max(0, keep));
        // Don't leave a lone high surrogate at the cut.
        if (/[\uD800-\uDBFF]$/.test(body)) body = body.slice(0, -1);
        fitted = encodeChunk([{ ...entry, b: body }]);
    }
    if (fitted.length > maxBytes) {
        throw new RangeError(
            `maxBytes ${maxBytes} is too small for one index entry`,
        );
    }
    return fitted;
}

/** Encoded chunks of `entries` (already sorted), each at most maxBytes long. */
function splitToFit(entries: CompactEntry[], maxBytes: number): string[] {
    const text = encodeChunk(entries);
    if (text.length <= maxBytes) return [text];
    if (entries.length === 0) {
        throw new RangeError(`maxBytes ${maxBytes} is too small for a block`);
    }
    if (entries.length === 1) return [fitSingle(entries[0], text, maxBytes)];
    const mid = Math.floor(entries.length / 2);
    return [
        ...splitToFit(entries.slice(0, mid), maxBytes),
        ...splitToFit(entries.slice(mid), maxBytes),
    ];
}

/**
 * Pack entries for one room and range into format 2 blocks whose `data` is at
 * most maxBytes (base64 length). Entries are sorted by timestamp and split in
 * halves until each block fits. An entry too big on its own has its body
 * shortened. Always returns at least one block, so an empty answer still
 * tells the requester that the range is covered.
 */
export function packEntries(
    roomId: string,
    requestId: string,
    range: Range,
    entries: CompactEntry[],
    maxBytes = 40_000,
): IndexSyncBlock[] {
    const sorted = [...entries].sort((a, b) => a.t - b.t);
    const chunks = splitToFit(sorted, maxBytes);
    return chunks.map((data, seq): IndexSyncBlock => ({
        id: requestId,
        roomId,
        range: [range[0], range[1]],
        seq,
        total: chunks.length,
        data,
        fmt: 2,
    }));
}

/** Whether a decoded legacy value has the shape of an entry. */
function isLegacyEntry(v: unknown): v is LegacyIndexEntry {
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    return (
        typeof o.e === "string" &&
        typeof o.s === "string" &&
        typeof o.t === "number" &&
        Number.isSafeInteger(o.t) &&
        o.t >= 0 &&
        typeof o.m === "string" &&
        typeof o.b === "string" &&
        (o.v === undefined || o.v === 1) &&
        (o.o === undefined || typeof o.o === "string")
    );
}

/** The entries in one chunk, in the compact form. A format 2 chunk that
 *  doesn't decode throws (the caller drops it); legacy items that don't have
 *  the right shape are dropped. Throws if the data isn't valid base64. */
export async function unpackBlock(b: IndexSyncBlock): Promise<CompactEntry[]> {
    return (await unpackBlockDetailed(b)).map((x) => x.entry);
}

/** One entry of a chunk. `original` is the full id of the event a legacy
 *  edit replaces: legacy chunks name it, so the receiver can look up its
 *  timestamp. A format 2 edit carries its timestamp (`entry.ot`) instead. */
export interface UnpackedEntry {
    entry: CompactEntry;
    original?: string;
}

/** The entries of one chunk with what the receiver needs to link them. */
export async function unpackBlockDetailed(
    b: IndexSyncBlock,
): Promise<UnpackedEntry[]> {
    const bytes = fromBase64(b.data);
    if (b.fmt === INDEX_SYNC_FORMAT) {
        return unpackV2(bytes).map((entry) => ({ entry }));
    }
    const decoded = await decodeLegacyBlock({ z: true, data: bytes });
    return decoded.filter(isLegacyEntry).map((e) => ({
        entry: legacyToCompact(e),
        original: e.o,
    }));
}

/** `incoming` without entries whose key is already known, and without repeats
 *  within itself (the first occurrence wins). */
export function dedupeEntries(
    incoming: CompactEntry[],
    knownKeys: ReadonlySet<string>,
): CompactEntry[] {
    const seen = new Set<string>();
    const out: CompactEntry[] = [];
    for (const entry of incoming) {
        const key = entryKey(entry);
        if (knownKeys.has(key) || seen.has(key)) continue;
        seen.add(key);
        out.push(entry);
    }
    return out;
}

/** The entries whose timestamp falls in any of the ranges. */
export function entriesInRange<T extends { t: number }>(
    entries: T[],
    ranges: Range[],
): T[] {
    const merged = normalize(ranges);
    return entries.filter((entry) =>
        merged.some(([from, to]) => entry.t >= from && entry.t <= to),
    );
}

function isInt(v: unknown): v is number {
    return typeof v === "number" && Number.isInteger(v);
}

function nonEmptyString(v: unknown): v is string {
    return typeof v === "string" && v.length > 0;
}

/** A range from untrusted input, or null if it isn't two finite numbers in
 *  order. */
function parseRange(v: unknown): Range | null {
    if (!Array.isArray(v) || v.length !== 2) return null;
    const [from, to] = v;
    if (typeof from !== "number" || typeof to !== "number") return null;
    if (!Number.isFinite(from) || !Number.isFinite(to) || from > to)
        return null;
    return [from, to];
}

/** A sync block from untrusted input, or null if it is malformed. */
export function parseSyncBlock(content: unknown): IndexSyncBlock | null {
    if (!content || typeof content !== "object") return null;
    const c = content as Record<string, unknown>;
    const { id, roomId, seq, total, data, fmt } = c;
    const range = parseRange(c.range);
    if (!nonEmptyString(id) || !nonEmptyString(roomId) || !range) return null;
    if (!isInt(total) || total < 1 || total > MAX_TOTAL) return null;
    if (!isInt(seq) || seq < 0 || seq >= total) return null;
    if (typeof data !== "string" || data.length === 0) return null;
    if (data.length > MAX_DATA) return null;
    if (fmt !== undefined && fmt !== INDEX_SYNC_FORMAT) return null;
    const block: IndexSyncBlock = { id, roomId, range, seq, total, data };
    if (fmt === INDEX_SYNC_FORMAT) block.fmt = INDEX_SYNC_FORMAT;
    return block;
}

/** A sync request from untrusted input, or null if it is malformed. */
export function parseSyncRequest(content: unknown): IndexSyncRequest | null {
    if (!content || typeof content !== "object") return null;
    const c = content as Record<string, unknown>;
    const id = c.id;
    const rooms = c.rooms;
    if (!nonEmptyString(id) || !Array.isArray(rooms)) return null;
    if (rooms.length > MAX_ROOMS) return null;
    const out: IndexSyncRequest["rooms"] = [];
    for (const room of rooms) {
        if (!room || typeof room !== "object") return null;
        const r = room as Record<string, unknown>;
        const roomId = r.roomId;
        const missing = r.missing;
        if (!nonEmptyString(roomId) || !Array.isArray(missing)) return null;
        if (missing.length > MAX_RANGES) return null;
        const ranges: Range[] = [];
        for (const m of missing) {
            const range = parseRange(m);
            if (!range) return null;
            ranges.push(range);
        }
        out.push({ roomId, missing: ranges });
    }
    const request: IndexSyncRequest = { id, rooms: out };
    if (c.fmt !== undefined) {
        if (
            !Array.isArray(c.fmt) ||
            c.fmt.length > MAX_FMT ||
            !c.fmt.every(isInt)
        )
            return null;
        request.fmt = c.fmt as number[];
    }
    if (c.audit === undefined) return request;
    const audit = parseAudit(c.audit);
    if (!audit) return null;
    request.audit = audit;
    return request;
}

function parseAudit(v: unknown): IndexSyncRequest["audit"] | null {
    if (!Array.isArray(v) || v.length > MAX_ROOMS) return null;
    const out: NonNullable<IndexSyncRequest["audit"]> = [];
    let total = 0;
    for (const room of v) {
        if (!room || typeof room !== "object") return null;
        const r = room as Record<string, unknown>;
        if (!nonEmptyString(r.roomId) || !Array.isArray(r.days)) return null;
        total += r.days.length;
        if (total > MAX_AUDIT_DAYS) return null;
        const days: DayCount[] = [];
        for (const d of r.days) {
            if (!Array.isArray(d) || d.length !== 2) return null;
            const [day, count] = d;
            if (!isInt(day) || !isInt(count) || day < 0 || count < 0)
                return null;
            days.push([day, count]);
        }
        out.push({ roomId: r.roomId, days });
    }
    return out;
}

/** Entries per UTC day, oldest day first, only days with entries. */
export function dayCounts(entries: { t: number }[]): DayCount[] {
    const counts = new Map<number, number>();
    for (const e of entries) {
        const day = Math.floor(e.t / DAY_MS);
        counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => a[0] - b[0]);
}

/** Days on which `mine` holds more entries than `theirs` (a day they don't
 *  list counts as zero), newest first: what the other side is missing. */
export function daysTheyLack(mine: DayCount[], theirs: DayCount[]): number[] {
    const have = new Map(theirs);
    return mine
        .filter(([day, count]) => count > (have.get(day) ?? 0))
        .map(([day]) => day)
        .sort((a, b) => b - a);
}

/** Fit per-room day counts into one request: rooms in the order given, each
 *  keeping its newest days, until MAX_AUDIT_DAYS is used up. */
export function capAudit(
    rooms: { roomId: string; days: DayCount[] }[],
    max = MAX_AUDIT_DAYS,
): { roomId: string; days: DayCount[] }[] {
    const out: { roomId: string; days: DayCount[] }[] = [];
    let left = max;
    for (const { roomId, days } of rooms) {
        if (left <= 0) break;
        const kept = days.slice(Math.max(0, days.length - left));
        left -= kept.length;
        out.push({ roomId, days: kept });
    }
    return out;
}

/**
 * Split a range into windows of at most `size` entries that tile it exactly
 * (every moment in exactly one), newest first. A window boundary never falls
 * between two entries with the same timestamp.
 */
export function windowRanges(
    entries: { t: number }[],
    range: Range,
    size: number,
): Range[] {
    const ts = entries.map((e) => e.t).sort((a, b) => a - b);
    const starts: number[] = [range[0]];
    for (let i = size; i < ts.length; i += size) {
        let j = i;
        while (j < ts.length && ts[j] === ts[j - 1]) j++;
        if (j >= ts.length) break;
        if (ts[j] > starts[starts.length - 1]) starts.push(ts[j]);
    }
    const out: Range[] = starts.map((lo, i) => [
        lo,
        i + 1 < starts.length ? starts[i + 1] - 1 : range[1],
    ]);
    return out.reverse();
}

/** Why a to-device message from a session isn't one we act on, or null. */
export function peerRefusal(input: {
    encrypted: boolean;
    fromUser: string | undefined;
    ownUserId: string;
    fromDevice: string | undefined;
    ownDeviceId: string;
    verified: boolean;
    allowed: boolean;
}): string | null {
    if (!input.encrypted) return "not Olm-encrypted";
    if (input.fromUser !== input.ownUserId) return "not our own account";
    if (!input.fromDevice) return "unknown device";
    if (input.fromDevice === input.ownDeviceId) return "from this session";
    if (!input.verified) return "session is not verified";
    if (!input.allowed) return "session excluded by our settings";
    return null;
}
