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
 * SDK-free so it can be unit-tested; storage lives in matrix/eventIndex.ts.
 */
import {
    matchesParsedQuery,
    type ParsedSearchQuery,
} from "$lib/utils/messageSearch";

/** One indexed message. Short keys: there are a lot of these. */
export interface IndexEntry {
    /** Event id. For an edit, the id of the edit event itself. */
    e: string;
    /** Sender. */
    s: string;
    /** origin_server_ts. */
    t: number;
    /** msgtype. */
    m: string;
    /** Body text (the new body, for an edit). */
    b: string;
    /** Voice message (MSC3245). Omitted when false. */
    v?: 1;
    /** For an edit: the event it replaces. */
    o?: string;
}

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
export function entryFromEvent(ev: IndexSourceEvent): IndexEntry | null {
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
    const entry: IndexEntry = {
        e: eventId,
        s: sender,
        t: ev.ts,
        m: msgtype,
        b: source.body,
    };
    if ("org.matrix.msc3245.voice" in source || "m.voice" in source)
        entry.v = 1;
    if (isEdit) entry.o = rel!.event_id as string;
    return entry;
}

/** Messages per compressed block: big enough to compress well, small enough
 *  that appending to a room doesn't rewrite much. */
export const BLOCK_SIZE = 250;

const hasCompression = (): boolean =>
    typeof CompressionStream === "function" &&
    typeof DecompressionStream === "function";

async function pipeBytes(
    bytes: Uint8Array,
    stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
    const writer = stream.writable.getWriter();
    void writer.write(bytes as BufferSource).then(() => writer.close());
    return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

/** A stored block: `z` says whether `data` is deflated (older engines without
 *  CompressionStream store it plain rather than not at all). */
export interface EncodedBlock {
    z: boolean;
    data: Uint8Array;
}

export async function encodeBlock(
    entries: IndexEntry[],
): Promise<EncodedBlock> {
    const json = new TextEncoder().encode(JSON.stringify(entries));
    if (!hasCompression()) return { z: false, data: json };
    return {
        z: true,
        data: await pipeBytes(json, new CompressionStream("deflate-raw")),
    };
}

export async function decodeBlock(block: EncodedBlock): Promise<IndexEntry[]> {
    const bytes = block.z
        ? await pipeBytes(block.data, new DecompressionStream("deflate-raw"))
        : block.data;
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return Array.isArray(parsed) ? (parsed as IndexEntry[]) : [];
}

/** Case- and accent-insensitive form for matching. */
export function normalizeForSearch(s: string): string {
    return s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * Resolve edits and drop redactions: each original message appears once,
 * with its latest edit's text (an edit whose original isn't indexed stands in
 * for it). Order is newest first.
 */
export function resolveEntries(
    entries: Iterable<IndexEntry>,
    redacted: ReadonlySet<string>,
): IndexEntry[] {
    const originals = new Map<string, IndexEntry>();
    const latestEdit = new Map<string, IndexEntry>();
    for (const entry of entries) {
        if (redacted.has(entry.e)) continue;
        if (entry.o) {
            if (redacted.has(entry.o)) continue;
            const prev = latestEdit.get(entry.o);
            if (!prev || prev.t < entry.t) latestEdit.set(entry.o, entry);
        } else {
            originals.set(entry.e, entry);
        }
    }
    const out: IndexEntry[] = [];
    for (const [id, original] of originals) {
        const edit = latestEdit.get(id);
        out.push(
            edit
                ? { ...original, b: edit.b, m: edit.m || original.m }
                : original,
        );
        latestEdit.delete(id);
    }
    for (const [target, edit] of latestEdit) {
        out.push({ ...edit, e: target, o: undefined });
    }
    return out.sort((a, b) => b.t - a.t);
}

/** Whether an entry matches the query: every word of the term appears in the
 *  body (anywhere, so partial words and CJK match), and the from:/has:
 *  operators hold. */
export function entryMatches(
    entry: IndexEntry,
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
    entries: IndexEntry[],
    parsed: ParsedSearchQuery,
    limit = 500,
): IndexEntry[] {
    const words = searchWords(parsed.term);
    const out: IndexEntry[] = [];
    for (const entry of entries) {
        if (entryMatches(entry, parsed, words)) {
            out.push(entry);
            if (out.length >= limit) break;
        }
    }
    return out;
}
