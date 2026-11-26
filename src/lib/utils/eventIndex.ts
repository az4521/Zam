/**
 * The local message index for encrypted rooms: the server can't search or
 * filter what it can't read, so decrypted messages are kept on the device.
 *
 * Messages are stored in compressed blocks of a few hundred per room, with no
 * word index: chat lines are too short to compress one at a time, and a word
 * index is usually bigger than the text it points into. A search decompresses
 * a room's blocks and scans them, which is quick at chat scale and matches
 * partial words and scripts without spaces (CJK) for free.
 *
 * An entry identifies its event by a 32-bit hash of the event id plus its
 * timestamp (see indexBlock.ts for the block format). Full event ids are not
 * stored, so a search hit is a placeholder id until jumpTo resolves it through
 * the server (see resolveIndexedEventId in matrix/eventIndex.ts).
 *
 * SDK-free so it can be unit-tested; storage lives in matrix/eventIndex.ts.
 */
import {
    matchesParsedQuery,
    type ParsedSearchQuery,
} from "$lib/utils/messageSearch";
import { galleryItems, isGalleryContent } from "$lib/utils/gallery";
import { eventIdHash, type CompactEntry } from "./indexBlock";

export type { CompactEntry } from "./indexBlock";

/** The minimum an event has to expose: raw JSON or an unwrapped MatrixEvent. */
export interface IndexSourceEvent {
    eventId: string | null | undefined;
    sender: string | null | undefined;
    ts: number;
    /** The cleartext type (after decryption). */
    type: string;
    content: Record<string, unknown> | null | undefined;
    redacted?: boolean;
}

/** The searchable entry for an event, or null for anything that isn't a
 *  message with text (state, reactions, undecryptable, redacted). */
/**
 * `originTs` is the origin_server_ts of an edit's original, when the caller
 * found it: the edit is then linked by (hash, timestamp). Without it an edit
 * is stored unlinked.
 */
export function entryFromEvent(
    ev: IndexSourceEvent,
    originTs?: number,
): CompactEntry | null {
    if (ev.type !== "m.room.message" || ev.redacted) return null;
    const eventId = ev.eventId;
    const sender = ev.sender;
    const content = ev.content;
    if (!eventId || !sender || !content) return null;
    const rel = content["m.relates_to"] as
        { rel_type?: unknown; event_id?: unknown } | undefined;
    const isEdit =
        rel?.rel_type === "m.replace" && typeof rel.event_id === "string";
    const source = isEdit
        ? (content["m.new_content"] as Record<string, unknown> | undefined)
        : content;
    if (!source || typeof source.body !== "string") return null;
    const msgtype = typeof source.msgtype === "string" ? source.msgtype : "";
    const entry: CompactEntry = {
        h: eventIdHash(eventId),
        s: sender,
        t: ev.ts,
        m: msgtype,
        b: source.body,
    };
    if ("org.matrix.msc3245.voice" in source || "m.voice" in source)
        entry.v = 1;
    if (isEdit) {
        entry.o = eventIdHash(rel!.event_id as string);
        if (originTs !== undefined) entry.ot = originTs;
    }
    if (isGalleryContent(source!)) {
        const g = galleryItems(source!).map((i) => i.msgtype);
        if (g.length) entry.g = g;
    }
    return entry;
}

/** Messages per block: big enough to compress well, small enough that
 *  appending to a room doesn't rewrite much. */
export const BLOCK_SIZE = 250;

/** The identity of a stored message: its event hash and timestamp. Two
 *  entries with the same key are the same message. */
export function entryKey(e: { h: number; t: number }): string {
    return e.h + ":" + e.t;
}

/* ── Legacy (format 1) ─────────────────────────────────────────────────────
 * Before format 2, blocks were deflated JSON of full-id entries. They are only
 * read, for migration and for peers that still send them. */

/** One message in the legacy JSON form. */
export interface LegacyIndexEntry {
    /** Event id. For an edit, the id of the edit event itself. */
    e: string;
    s: string;
    t: number;
    m: string;
    b: string;
    v?: 1;
    /** For an edit: the event it replaces. */
    o?: string;
    g?: string[];
}

/** A legacy stored block: `z` says whether `data` is deflated. */
export interface EncodedBlock {
    z: boolean;
    data: Uint8Array;
}

let compressionOk: boolean | null = null;

/** DecompressionStream with the "deflate-raw" format. The constructor alone
 *  isn't enough: Chrome 80-102 have it but reject that format. */
const hasDecompression = (): boolean => {
    if (compressionOk === null) {
        try {
            new DecompressionStream("deflate-raw");
            compressionOk = true;
        } catch {
            compressionOk = false;
        }
    }
    return compressionOk;
};

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
    const stream = new DecompressionStream("deflate-raw");
    const writer = stream.writable.getWriter();
    void writer.write(bytes as BufferSource).then(() => writer.close());
    return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

/** Legacy block to its entries. Throws on malformed data. */
export async function decodeLegacyBlock(
    block: EncodedBlock,
): Promise<LegacyIndexEntry[]> {
    if (block.z && !hasDecompression()) {
        throw new Error("deflate-raw decompression unavailable");
    }
    const bytes = block.z ? await inflate(block.data) : block.data;
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return Array.isArray(parsed) ? (parsed as LegacyIndexEntry[]) : [];
}

/** A legacy entry in the compact form. */
export function legacyToCompact(
    entry: LegacyIndexEntry,
    originTs?: number,
): CompactEntry {
    const out: CompactEntry = {
        h: eventIdHash(entry.e),
        t: entry.t,
        s: entry.s,
        m: entry.m,
        b: entry.b,
    };
    if (entry.v !== undefined) out.v = 1;
    if (entry.o !== undefined) out.o = eventIdHash(entry.o);
    if (entry.o !== undefined && originTs !== undefined) out.ot = originTs;
    if (entry.g !== undefined) out.g = entry.g;
    return out;
}

/* ── Placeholder ids ───────────────────────────────────────────────────────
 * A search hit has no real event id. It carries a placeholder that is
 * recognisable (it can never be a server id: it starts with "$zamidx_") and
 * holds the hash and timestamp that identify the message. */

const PLACEHOLDER = /^\$zamidx_([0-9a-f]{8})_(0|[1-9][0-9]{0,15})$/;

/** The placeholder event id for a message. */
export function indexPlaceholderId(h: number, t: number): string {
    return `$zamidx_${(h >>> 0).toString(16).padStart(8, "0")}_${t}`;
}

/** The hash and timestamp in a placeholder id, or null for anything else. */
export function parseIndexPlaceholderId(
    id: string,
): { h: number; t: number } | null {
    const m = PLACEHOLDER.exec(id);
    if (!m) return null;
    const t = Number(m[2]);
    if (!Number.isSafeInteger(t)) return null;
    return { h: parseInt(m[1], 16), t };
}

export function isIndexPlaceholderId(id: string): boolean {
    return parseIndexPlaceholderId(id) !== null;
}

/**
 * The real event id for a placeholder, given what the server returned: the
 * timestamp lookup's event and the events around it. The anchor wins when its
 * hash matches; otherwise the context event whose hash and timestamp both
 * match. Null when none does.
 */
export function pickResolvedEventId(
    h: number,
    t: number,
    anchor: { eventId: string; ts: number } | null,
    context: readonly { eventId: string; ts: number }[],
): string | null {
    if (anchor && anchor.ts === t && eventIdHash(anchor.eventId) === h) {
        return anchor.eventId;
    }
    for (const c of context) {
        if (c.ts === t && eventIdHash(c.eventId) === h) return c.eventId;
    }
    return null;
}

/**
 * Whether a redaction applies, by (hash, timestamp): the keys are `entryKey`
 * form ("h:t") of redacted events. A hash alone never matches, so two events
 * with the same 32-bit hash are told apart by their timestamps.
 */
export function redactionKeyOf(eventHash: number, ts: number): string {
    return entryKey({ h: eventHash, t: ts });
}

/** The key of the original an edit names: its hash and timestamp. An edit
 *  without `ot` names no original (undefined). */
function editTargetKey(e: CompactEntry): string | undefined {
    if (e.o === undefined || e.ot === undefined) return undefined;
    return redactionKeyOf(e.o, e.ot);
}

/**
 * The entries left once the redacted events are gone: the event itself (its
 * key), and any edit of it (the edit's target key). An edit without `ot` is
 * never removed by a redaction. The same array comes back when nothing
 * matches, so callers can skip rewriting a block.
 */
export function dropRedactedEntries(
    entries: CompactEntry[],
    redacted: ReadonlySet<string>,
): CompactEntry[] {
    if (redacted.size === 0) return entries;
    const kept = entries.filter((e) => {
        if (redacted.has(entryKey(e))) return false;
        const target = editTargetKey(e);
        return target === undefined || !redacted.has(target);
    });
    return kept.length === entries.length ? entries : kept;
}

/** Case- and accent-insensitive form for matching. */
export function normalizeForSearch(s: string): string {
    return s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * Resolve edits and drop redactions: each original message appears once,
 * with its latest edit's text. An edit is linked to the original whose key
 * (hash and timestamp) it names; an edit whose original isn't indexed stands
 * in for it, under the original's id and time. An edit without `ot` (its
 * original's time could not be found) is linked to nothing and stands alone
 * as its own hit. Order is newest first.
 */
export function resolveEntries(
    entries: Iterable<CompactEntry>,
    redacted: ReadonlySet<string>,
): CompactEntry[] {
    const originals = new Map<string, CompactEntry>();
    const latestEdit = new Map<string, CompactEntry>();
    const standalone: CompactEntry[] = [];
    for (const entry of entries) {
        if (redacted.has(entryKey(entry))) continue;
        if (entry.o === undefined) {
            originals.set(entryKey(entry), entry);
            continue;
        }
        const target = editTargetKey(entry);
        if (target === undefined) {
            standalone.push({ ...entry, o: undefined });
            continue;
        }
        if (redacted.has(target)) continue;
        const prev = latestEdit.get(target);
        if (!prev || prev.t < entry.t) latestEdit.set(target, entry);
    }
    const out: CompactEntry[] = [...standalone];
    for (const [key, original] of originals) {
        const edit = latestEdit.get(key);
        if (!edit) {
            out.push(original);
        } else {
            // The edit's msgtype wins when it has one, and then its gallery
            // item types go with it (a gallery edited to plain text, or the
            // reverse, must not keep the other kind's `g`).
            const useEdit = !!edit.m;
            const merged: CompactEntry = {
                ...original,
                b: edit.b,
                m: useEdit ? edit.m : original.m,
            };
            const g = useEdit ? edit.g : original.g;
            if (g) merged.g = g;
            else delete merged.g;
            out.push(merged);
        }
        latestEdit.delete(key);
    }
    // Edits whose original isn't indexed: they stand in for it, which keeps the
    // original's id and time so that a jump still resolves to it.
    for (const edit of latestEdit.values()) {
        out.push({
            ...edit,
            h: edit.o as number,
            t: edit.ot as number,
            o: undefined,
            ot: undefined,
        });
    }
    return out.sort((a, b) => b.t - a.t);
}

/** Whether an entry matches the query: every word of the term appears in the
 *  body (anywhere, so partial words and CJK match), and the from:/has:
 *  operators hold. */
export function entryMatches(
    entry: CompactEntry,
    parsed: ParsedSearchQuery,
    words: string[],
): boolean {
    if (words.length > 0) {
        const body = normalizeForSearch(entry.b);
        if (!words.every((w) => body.includes(w))) return false;
    }
    return matchesParsedQuery(
        {
            sender: entry.s,
            msgtype: entry.m,
            body: entry.b,
            isVoice: !!entry.v,
            itemtypes: entry.g,
        },
        parsed,
    );
}

/** The normalized words of a search term. */
export function searchWords(term: string): string[] {
    return normalizeForSearch(term).split(/\s+/).filter(Boolean);
}

/** Search resolved entries, newest first, at most `limit` results. */
export function searchEntries(
    entries: CompactEntry[],
    parsed: ParsedSearchQuery,
    limit = 500,
): CompactEntry[] {
    const words = searchWords(parsed.term);
    const out: CompactEntry[] = [];
    for (const entry of entries) {
        if (entryMatches(entry, parsed, words)) {
            out.push(entry);
            if (out.length >= limit) break;
        }
    }
    return out;
}
