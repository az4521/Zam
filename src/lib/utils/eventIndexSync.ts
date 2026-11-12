/**
 * Pieces of the to-device exchange that moves index blocks between a user's
 * own devices: which time ranges each room is still missing, and the blocks
 * that answer a request. Ranges are ms timestamps, both ends inclusive.
 *
 * SDK-free so it can be unit-tested; sending and storage live elsewhere.
 */
import { decodeBlock, encodeBlock, type IndexEntry } from "./eventIndex";

/** A time range in ms, both ends inclusive. */
export type Range = [from: number, to: number];

export const INDEX_SYNC_REQUEST = "moe.crafty.zam.index_sync.request";
export const INDEX_SYNC_BLOCK = "moe.crafty.zam.index_sync.block";

/** Asks a device for the entries it has in the given ranges, per room. */
export interface IndexSyncRequest {
    id: string;
    rooms: { roomId: string; missing: Range[] }[];
}

/** One chunk of an answer. `data` is base64 of a deflate-raw JSON array of
 *  IndexEntry, the same bytes encodeBlock produces. */
export interface IndexSyncBlock {
    id: string;
    roomId: string;
    range: Range;
    seq: number;
    total: number;
    data: string;
}

/** Limits the parse functions enforce on untrusted input. */
const MAX_TOTAL = 1000;
const MAX_DATA = 100_000;
const MAX_ROOMS = 200;
const MAX_RANGES = 50;

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

/** Base64 of the encoded block for these entries. */
async function encodeChunk(entries: IndexEntry[]): Promise<string> {
    const { data } = await encodeBlock(entries);
    return toBase64(data);
}

/**
 * Shorten the body of one entry until its encoded block fits. Each step keeps
 * a fraction of the body sized from the overshoot, so it converges quickly.
 */
async function fitSingle(
    entry: IndexEntry,
    text: string,
    maxBytes: number,
): Promise<string> {
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
        fitted = await encodeChunk([{ ...entry, b: body }]);
    }
    if (fitted.length > maxBytes) {
        throw new RangeError(
            `maxBytes ${maxBytes} is too small for one index entry`,
        );
    }
    return fitted;
}

/** Encoded chunks of `entries` (already sorted), each at most maxBytes long. */
async function splitToFit(
    entries: IndexEntry[],
    maxBytes: number,
): Promise<string[]> {
    const text = await encodeChunk(entries);
    if (text.length <= maxBytes) return [text];
    if (entries.length === 0) {
        throw new RangeError(`maxBytes ${maxBytes} is too small for a block`);
    }
    if (entries.length === 1)
        return [await fitSingle(entries[0], text, maxBytes)];
    const mid = Math.floor(entries.length / 2);
    return [
        ...(await splitToFit(entries.slice(0, mid), maxBytes)),
        ...(await splitToFit(entries.slice(mid), maxBytes)),
    ];
}

/**
 * Pack entries for one room and range into blocks whose `data` is at most
 * maxBytes (base64 length). Entries are sorted by timestamp and split in
 * halves until each block fits. An entry too big on its own has its body
 * shortened. Always returns at least one block, so an empty answer still
 * tells the requester that the range is covered.
 */
export async function packEntries(
    roomId: string,
    requestId: string,
    range: Range,
    entries: IndexEntry[],
    maxBytes = 40_000,
): Promise<IndexSyncBlock[]> {
    const sorted = [...entries].sort((a, b) => a.t - b.t);
    const chunks = await splitToFit(sorted, maxBytes);
    return chunks.map((data, seq): IndexSyncBlock => ({
        id: requestId,
        roomId,
        range: [range[0], range[1]],
        seq,
        total: chunks.length,
        data,
    }));
}

/** Whether a decoded value has the shape of an IndexEntry. */
function isIndexEntry(v: unknown): v is IndexEntry {
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    return (
        typeof o.e === "string" &&
        typeof o.s === "string" &&
        typeof o.t === "number" &&
        Number.isFinite(o.t) &&
        typeof o.m === "string" &&
        typeof o.b === "string" &&
        (o.v === undefined || o.v === 1) &&
        (o.o === undefined || typeof o.o === "string")
    );
}

/** The entries in one block. Malformed items are dropped. Throws if the data
 *  isn't valid base64 or deflate. */
export async function unpackBlock(b: IndexSyncBlock): Promise<IndexEntry[]> {
    const decoded = await decodeBlock({ z: true, data: fromBase64(b.data) });
    return decoded.filter(isIndexEntry);
}

/** `incoming` without ids already known, and without repeats within itself
 *  (the first occurrence wins). */
export function dedupeEntries(
    incoming: IndexEntry[],
    knownIds: ReadonlySet<string>,
): IndexEntry[] {
    const seen = new Set<string>();
    const out: IndexEntry[] = [];
    for (const entry of incoming) {
        if (knownIds.has(entry.e) || seen.has(entry.e)) continue;
        seen.add(entry.e);
        out.push(entry);
    }
    return out;
}

/** The entries whose timestamp falls in any of the ranges. */
export function entriesInRange(
    entries: IndexEntry[],
    ranges: Range[],
): IndexEntry[] {
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
    const { id, roomId, seq, total, data } = c;
    const range = parseRange(c.range);
    if (!nonEmptyString(id) || !nonEmptyString(roomId) || !range) return null;
    if (!isInt(total) || total < 1 || total > MAX_TOTAL) return null;
    if (!isInt(seq) || seq < 0 || seq >= total) return null;
    if (typeof data !== "string" || data.length === 0) return null;
    if (data.length > MAX_DATA) return null;
    return { id, roomId, range, seq, total, data };
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
    return { id, rooms: out };
}

/**
 * Split a range into windows of at most `size` entries that tile it exactly
 * (every moment in exactly one), newest first. A window boundary never falls
 * between two entries with the same timestamp.
 */
export function windowRanges(
    entries: IndexEntry[],
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
