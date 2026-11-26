/**
 * Local message index for encrypted rooms (format and search: utils/eventIndex).
 *
 * Two feeds write to it:
 * - live: every message in an encrypted room as it arrives and decrypts, and
 *   any older page the timeline loads;
 * - a crawler that walks each joined encrypted room's history backwards, one
 *   page at a time, until it reaches the start. It covers the plaintext
 *   messages from before a room turned on encryption too, so a mixed room is
 *   searchable end to end.
 *
 * One IndexedDB database per account and device, deleted on sign-out and
 * when the setting is turned off. Account switching reloads the page, so
 * there is only ever one client to follow.
 */
import {
    Direction,
    EventType,
    Filter,
    MatrixEvent,
    MatrixEventEvent,
    RoomEvent,
    type MatrixClient,
    type Room,
} from "matrix-js-sdk";
import { matrixClient } from "./runtime";
import { reportStorageError } from "$lib/stores/storageHealth.svelte";
import { isRoomEncrypted, deleteDatabaseWithOutcome } from "./crypto";
import {
    contextEventStamps,
    fetchEventOriginTs,
    isSyncStale,
    timestampToEventAnchor,
} from "./client";
import { attachIndexSync } from "./eventIndexSync";
import {
    addRange,
    dedupeEntries,
    entriesInRange,
    subtractRanges,
    type Range,
} from "$lib/utils/eventIndexSync";
import {
    BLOCK_SIZE,
    decodeLegacyBlock,
    dropRedactedEntries,
    entryFromEvent,
    entryKey,
    redactionKeyOf,
    indexPlaceholderId,
    legacyToCompact,
    parseIndexPlaceholderId,
    pickResolvedEventId,
    resolveEntries,
    searchEntries,
    type EncodedBlock,
    type LegacyIndexEntry,
} from "$lib/utils/eventIndex";
import {
    decodeBlockKeys,
    decodeIndexBlock,
    encodeIndexBlock,
    eventIdHash,
    type BlockKeys,
    type CompactEntry,
} from "$lib/utils/indexBlock";
import { initPpmd } from "$lib/utils/ppmd";
import {
    mediaFilterDefinition,
    mediaItemsFromEvent,
    type RoomMediaItem,
} from "$lib/utils/roomMedia";
import type { ParsedSearchQuery } from "$lib/utils/messageSearch";
import {
    raceWithTimeout,
    unfinishedRoomCount,
    type FullIndexProgress,
    type FullIndexReason,
    type FullIndexResult,
} from "$lib/utils/fullIndexProgress";
import {
    buildPrefetchRooms,
    type PrefetchCrawlRow,
    type PrefetchPlanInput,
    type PrefetchStatus,
    type TakenPrefetchPage,
} from "$lib/utils/historyPrefetchPlan";
import {
    clearPrefetch,
    historyPrefetchAvailable,
    prefetchStatus,
    setPrefetchPlan,
    takePrefetchedPage,
} from "./historyPrefetch";

/** The raw events of one /messages page, as the SDK returns them. */
type RawPageChunk = NonNullable<
    Awaited<ReturnType<MatrixClient["createMessagesRequest"]>>["chunk"]
>;

export type {
    FullIndexProgress,
    FullIndexReason,
    FullIndexResult,
} from "$lib/utils/fullIndexProgress";

// v5: blocks in format 2 (rows with fmt: 2, see utils/indexBlock.ts). Legacy
// rows are rewritten once (migrateLegacyIndex). META holds one-off flags.
const DB_VERSION = 5;
const BLOCKS = "blocks";
const TAILS = "tails";
const MEDIA = "media";
const CRAWL = "crawl";
const REDACTED = "redacted";
const COVERAGE = "coverage";
const META = "meta";
const REDACTION_SCRUB_KEY = "redaction-scrub";
const MIGRATION_KEY = "format-2-migration";
/** Compaction: a block whose bodies total at most a half of this is "small".
 *  Adjacent blocks are merged while their bodies fit it. */
const BLOCK_BODY_CAP = 1024 * 1024;
const SMALL_BLOCK_BODY = BLOCK_BODY_CAP / 2;
/** Small blocks a room needs before it is compacted. */
const COMPACT_MIN_SMALL = 8;
/** Events fetched on each side of a search hit when resolving its id. */
const RESOLVE_CONTEXT_EVENTS = 50;

/** How long new messages wait before being written (batches a busy sync). */
const FLUSH_DELAY_MS = 2_000;
/** Crawler pacing: between pages, and between checks when it has nothing to
 *  do or shouldn't run (hidden page, sync down, storage tight). */
const CRAWL_PAGE_DELAY_MS = 2_000;
const CRAWL_IDLE_MS = 5 * 60_000;
const CRAWL_PAUSED_MS = 30_000;
const CRAWL_PAGE_SIZE = 100;
/** A step served from a prefetched page costs no request, so the next one follows quickly. */
const CRAWL_PREFETCH_STEP_DELAY_MS = 100;
/** The prefetch plan is pushed at most once per this interval while the crawl runs. */
const PREFETCH_PLAN_THROTTLE_MS = 30_000;
const CRAWL_DECRYPT_BATCH = 4;
/** A /messages request that takes longer is treated as failed (the room backs off). */
const CRAWL_REQUEST_TIMEOUT_MS = 60_000;
/** Decryption that takes longer stops being waited for; the page goes on without it. */
const CRAWL_DECRYPT_TIMEOUT_MS = 30_000;
/** Full build: pause between pages, and between checks while sync is stale. */
const FULL_BUILD_STEP_DELAY_MS = 150;
const FULL_BUILD_STALL_MS = 5_000;
/** Full build gives up after this many failed steps in a row. */
const FULL_BUILD_MAX_ERRORS = 3;
/** Stop crawling past this much origin storage, or half the quota. */
const STORAGE_CAP_BYTES = 1024 * 1024 * 1024;

/** A format 2 block row (utils/indexBlock.ts). */
interface StoredBlockV2 {
    id?: number;
    roomId: string;
    fmt: 2;
    count: number;
    minTs: number;
    maxTs: number;
    /** Uncompressed body size: the compaction budget. */
    bodyRaw: number;
    meta: Uint8Array;
    body: Uint8Array;
}
/** A legacy (format 1) block row, written before format 2. */
interface StoredBlockLegacy extends EncodedBlock {
    id?: number;
    roomId: string;
    count: number;
    minTs: number;
    maxTs: number;
}
type StoredBlock = StoredBlockV2 | StoredBlockLegacy;
interface StoredTail {
    roomId: string;
    /** 2 for compact entries; absent on a legacy row. */
    fmt?: 2;
    entries: CompactEntry[] | LegacyIndexEntry[];
}
/** A block as the room cache keeps it. */
interface BlockSummary {
    count: number;
    minTs: number;
    maxTs: number;
    bodyRaw: number;
    legacy: boolean;
}
/** A room's in-memory index state. `keys` holds the entryKey of every stored
 *  message (for dedup), `blocks` a summary of each block, `tail` the tail. */
interface RoomIndexCache {
    keys: Set<string>;
    blocks: Map<number, BlockSummary>;
    tail: CompactEntry[];
}
interface CrawlState {
    roomId: string;
    /** Where the next backwards page starts; null = from the newest event. */
    from: string | null;
    done: boolean;
    /** Timestamp the next page's events are older than (the coverage edge). */
    upTs?: number;
    /** A walk back from the present to the newest covered moment, filling
     *  what an offline stretch missed. Kept so a restart resumes it. */
    gap?: GapWalk;
}
interface GapWalk {
    from: string | null;
    /** Everything between here and the present is covered. */
    up: number;
    /** Newest moment covered before the hole. */
    stopAt: number;
}
/** The time ranges of a room this device has fully indexed. A block's own
 *  min/max can't say it: a stretch with no messages looks like a hole. */
interface StoredCoverage {
    roomId: string;
    ranges: Range[];
}
/** A media row, keyed by event id. An MSC4274 gallery is ONE row whose
 *  `gallery` holds its items: they share the event id, so separate rows would
 *  overwrite each other, and one row still goes with a redaction of the event. */
type StoredMedia =
    | (RoomMediaItem & { roomId: string; gallery?: undefined })
    | {
          eventId: string;
          roomId: string;
          ts: number;
          gallery: RoomMediaItem[];
      };

export function eventIndexDbName(userId: string, deviceId: string): string {
    return `matrix-client:${encodeURIComponent(userId)}:${encodeURIComponent(deviceId)}:event-index`;
}

function idbFactory(): IDBFactory | null {
    try {
        return globalThis.indexedDB ?? null;
    } catch {
        return null;
    }
}

function req<T>(r: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
    });
}

function done(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

function openDb(name: string): Promise<IDBDatabase> {
    const factory = idbFactory();
    if (!factory) return Promise.reject(new Error("IndexedDB unavailable"));
    return new Promise((resolve, reject) => {
        const open = factory.open(name, DB_VERSION);
        open.onupgradeneeded = (ev) => {
            const db = open.result;
            if (ev.oldVersion < 1) {
                db.createObjectStore(BLOCKS, {
                    keyPath: "id",
                    autoIncrement: true,
                }).createIndex("room", "roomId");
                db.createObjectStore(TAILS, { keyPath: "roomId" });
                db.createObjectStore(MEDIA, {
                    keyPath: "eventId",
                }).createIndex("room_ts", ["roomId", "ts"]);
                db.createObjectStore(CRAWL, { keyPath: "roomId" });
                db.createObjectStore(REDACTED, {
                    keyPath: "eventId",
                }).createIndex("room", "roomId");
            }
            if (ev.oldVersion < 2)
                db.createObjectStore(COVERAGE, { keyPath: "roomId" });
            if (ev.oldVersion < 4)
                db.createObjectStore(META, { keyPath: "key" });
            // Repair (v3): crawls before the mapper fix marked rooms done and
            // claimed ranges whose messages decrypted late and were never
            // indexed. Dropping CRAWL and COVERAGE makes the crawler walk the
            // history again. BLOCKS/TAILS/MEDIA/REDACTED stay; a re-crawled
            // message already stored is written again, and search collapses
            // duplicates by event id, so only storage grows.
            if (ev.oldVersion >= 1 && ev.oldVersion < 3) {
                const tx = open.transaction as IDBTransaction;
                tx.objectStore(CRAWL).clear();
                tx.objectStore(COVERAGE).clear();
            }
        };
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
        open.onblocked = () => reject(new Error("event index blocked"));
    });
}

// ── Session ────────────────────────────────────────────────────────────────

interface Session {
    client: MatrixClient;
    dbName: string;
    db: Promise<IDBDatabase>;
    stopped: boolean;
    /** Per-room cache (see roomCache). Only touched on the write chain. */
    rooms: Map<string, RoomIndexCache>;
    detach: () => void;
}

let session: Session | null = null;
// Every write goes through this chain, so a tail is never read and rewritten
// by two writers at once.
let writeChain: Promise<void> = Promise.resolve();
/** A redaction queued for the next write. `ts` is the redacted event's
 *  origin_server_ts when it was found: without it the redaction removes
 *  nothing by hash (only the full-id checks apply). */
export interface RedactionNote {
    eventId: string;
    ts?: number;
    /** The timestamp lookup failed for now: the tombstone is retried. */
    pending?: boolean;
}
/** An edit queued for the next write, with the full id of the original it
 *  replaces; its `ot` is filled in before the write, if the original is found. */
export interface PendingEdit {
    entry: CompactEntry;
    original: string;
}
interface PendingRoom {
    entries: CompactEntry[];
    media: StoredMedia[];
    redacted: RedactionNote[];
    /** Full ids of the events redacted in this batch (checked before hashing). */
    redactedIds: Set<string>;
    edits: PendingEdit[];
    /** The full event id of each queued entry: matched exactly against the
     *  tombstones, before any hash is involved. */
    fullIds: Map<CompactEntry, string>;
}
const pending = new Map<string, PendingRoom>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;
const LIVE_TICK_MS = 30_000;
// Ids already queued this session: a message is both added to the timeline
// and then decrypted, and both fire.
const seen = new Set<string>();

function bucket(roomId: string): PendingRoom {
    let b = pending.get(roomId);
    if (!b) {
        b = {
            entries: [],
            media: [],
            redacted: [],
            redactedIds: new Set(),
            edits: [],
            fullIds: new Map(),
        };
        pending.set(roomId, b);
    }
    return b;
}

/** Queue a redaction. The event's full id is known at once, so the event is
 *  not queued if it arrives after its redaction in the same batch. */
function noteRedaction(roomId: string, note: RedactionNote): void {
    const b = bucket(roomId);
    b.redactedIds.add(note.eventId);
    b.redacted.push(note);
}

function scheduleFlush(): void {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
        flushTimer = null;
        void flush();
    }, FLUSH_DELAY_MS);
}

/** Queue one event (live or crawled). False when it adds nothing. */
function queueEvent(
    roomId: string,
    ev: {
        eventId: string;
        sender: string;
        ts: number;
        type: string;
        content: Record<string, unknown>;
        redacted: boolean;
    },
    /** Keys already stored for the room: such an entry is not queued. */
    known?: ReadonlySet<string>,
): boolean {
    if (seen.has(ev.eventId)) return false;
    const entry = entryFromEvent(ev);
    if (!entry) return false;
    if (known?.has(entryKey(entry))) return false;
    const b = bucket(roomId);
    if (b.redactedIds.has(ev.eventId)) return false;
    seen.add(ev.eventId);
    if (seen.size > 20_000) seen.clear();
    queuedMessages += 1;
    b.entries.push(entry);
    b.fullIds.set(entry, ev.eventId);
    if (entry.o !== undefined) {
        const rel = ev.content["m.relates_to"] as { event_id?: unknown };
        if (typeof rel.event_id === "string")
            b.edits.push({ entry, original: rel.event_id });
    }
    const media = mediaItemsFromEvent(ev);
    if (media.length === 1 && media[0].itemIndex === undefined)
        b.media.push({ ...media[0], roomId });
    else if (media.length > 0)
        b.media.push({
            eventId: ev.eventId,
            roomId,
            ts: ev.ts,
            gallery: media,
        });
    return true;
}

function flush(): Promise<void> {
    const s = session;
    if (!s || pending.size === 0) return writeChain;
    const batch = new Map(pending);
    pending.clear();
    writeChain = writeChain
        .then(async () => {
            const db = await s.db;
            for (const [roomId, b] of batch) {
                // Lookups run here, on the chain, but never inside a transaction.
                const failed = await resolveOriginTimes(roomId, b.edits, () =>
                    isCurrent(s),
                );
                await writeRoom(s, db, roomId, b);
                if (failed.length > 0) {
                    // Kept for a retry; the edit is stored without its time meanwhile.
                    const items = failed.map((x) => ({
                        k: entryKey(x.entry),
                        o: x.original,
                    }));
                    for (const it of items)
                        markFirstFailure(originKey(roomId, it.k));
                    await addPendingOrigins(db, roomId, items);
                }
            }
        })
        .catch((e) => {
            reportStorageError(e, { fromIndexedDB: true });
            console.warn("[eventIndex] write failed", e);
        });
    return writeChain;
}

/** A block row in the format 2 layout, from entries (any order). */
function encodeRoomBlock(
    roomId: string,
    entries: CompactEntry[],
): StoredBlockV2 {
    const enc = encodeIndexBlock(entries);
    const keys = decodeBlockKeys(enc);
    return {
        roomId,
        fmt: 2,
        count: keys.count,
        minTs: keys.minTs,
        maxTs: keys.maxTs,
        bodyRaw: keys.bodyRaw,
        meta: enc.meta,
        body: enc.body,
    };
}

function isV2(b: StoredBlock): b is StoredBlockV2 {
    return (b as StoredBlockV2).fmt === 2;
}

function summaryOf(row: StoredBlock): BlockSummary {
    return {
        count: row.count,
        minTs: row.minTs,
        maxTs: row.maxTs,
        bodyRaw: isV2(row) ? row.bodyRaw : 0,
        legacy: !isV2(row),
    };
}

/** Every entry a stored block holds, in the compact form. */
async function blockEntries(b: StoredBlock): Promise<CompactEntry[]> {
    if (isV2(b)) return decodeIndexBlock({ meta: b.meta, body: b.body });
    return (await decodeLegacyBlock(b)).map(legacyToCompact);
}

/** The entries in a room's tail row, in the compact form. */
function tailEntries(t: StoredTail | undefined): CompactEntry[] {
    if (!t) return [];
    if (t.fmt === 2) return t.entries as CompactEntry[];
    return (t.entries as LegacyIndexEntry[]).map(legacyToCompact);
}

/** Whether a block's keys name any of these redactions: a message by its key
 *  (hash and timestamp), or an edit by the key of the original it names. */
function touchesKeys(k: BlockKeys, keys: ReadonlySet<string>): boolean {
    for (let i = 0; i < k.count; i++) {
        if (keys.has(entryKey({ h: k.h[i], t: k.t[i] }))) return true;
    }
    for (let i = 0; i < k.targets.length; i++) {
        if (keys.has(entryKey({ h: k.targets[i], t: k.targetTs[i] })))
            return true;
    }
    return false;
}

/** Whether the session that started a piece of work is still the running one. */
function isCurrent(s: Session): boolean {
    return session === s && !s.stopped;
}

/** Concurrent fetches allowed while looking up original timestamps. */
const ORIGIN_FETCH_CONCURRENCY = 4;

/** The origin_server_ts of an event this client already holds, or undefined. */
function localEventTs(roomId: string, eventId: string): number | undefined {
    const room = matrixClient?.getRoom(roomId);
    const ts = room?.findEventById?.(eventId)?.getTs();
    return typeof ts === "number" && ts > 0 ? ts : undefined;
}

/** What a timestamp lookup found. `gone`: the server has no such event
 *  (M_NOT_FOUND): nothing will ever match it. `failed`: anything else, which
 *  is retried later. */
type OriginLookup =
    { kind: "ts"; ts: number } | { kind: "gone" } | { kind: "failed" };

function isNotFoundError(e: unknown): boolean {
    const x = e as { errcode?: unknown; httpStatus?: unknown } | null;
    return x?.errcode === "M_NOT_FOUND" || x?.httpStatus === 404;
}

/** The origin_server_ts of an event: the loaded event, else the server. */
async function lookupOriginTs(
    roomId: string,
    eventId: string,
): Promise<OriginLookup> {
    const local = localEventTs(roomId, eventId);
    if (local !== undefined) return { kind: "ts", ts: local };
    try {
        return { kind: "ts", ts: await fetchEventOriginTs(roomId, eventId) };
    } catch (e) {
        return isNotFoundError(e) ? { kind: "gone" } : { kind: "failed" };
    }
}

/** Runs `fn` over `items` with at most `limit` calls in flight. */
async function mapLimit<T>(
    items: readonly T[],
    limit: number,
    fn: (item: T) => Promise<void>,
): Promise<void> {
    let next = 0;
    const worker = async (): Promise<void> => {
        while (next < items.length) await fn(items[next++]);
    };
    await Promise.all(
        Array.from({ length: Math.min(limit, items.length) }, worker),
    );
}

/**
 * Sets `ot` on the edits whose original's timestamp can be found (loaded
 * event first, then the server, a few requests at a time). Returns the edits
 * whose lookup failed for now, so the caller can keep them to retry. An
 * original the server doesn't know leaves its edits without `ot`, for good.
 * Stops looking once `current()` is false (the session was stopped).
 */
export async function resolveOriginTimes(
    roomId: string,
    edits: readonly PendingEdit[],
    current: () => boolean,
): Promise<PendingEdit[]> {
    const todo = edits.filter((x) => x.entry.ot === undefined);
    if (todo.length === 0) return [];
    const originals = [...new Set(todo.map((x) => x.original))];
    const found = new Map<string, OriginLookup>();
    await mapLimit(originals, ORIGIN_FETCH_CONCURRENCY, async (id) => {
        if (!current()) return;
        found.set(id, await lookupOriginTs(roomId, id));
    });
    const failed: PendingEdit[] = [];
    for (const x of todo) {
        const r = found.get(x.original);
        if (r?.kind === "ts") x.entry.ot = r.ts;
        else if (r?.kind === "failed") failed.push(x);
    }
    return failed;
}

/* ── Retries ───────────────────────────────────────────────────────────────
 * A tombstone whose timestamp lookup failed is stored `pending`; an edit whose
 * original's lookup failed is listed in its room's pending origins (META rows
 * "origins:<room>"). Both are retried from the live tick, and once at start.
 * Each waits its own time, doubling from RETRY_START_MS up to RETRY_MAX_MS,
 * in memory: a restart retries at once. */

const RETRY_START_MS = 60_000;
const RETRY_MAX_MS = 6 * 60 * 60_000;
const ORIGINS_PREFIX = "origins:";
/** Pending origins kept per room; the oldest are dropped past this. */
const ORIGIN_PENDING_CAP = 500;

interface RetryState {
    at: number;
    delay: number;
}
const retryState = new Map<string, RetryState>();
let retryRunning = false;

const tombKey = (roomId: string, eventId: string) => `t|${roomId}|${eventId}`;
const originKey = (roomId: string, k: string) => `o|${roomId}|${k}`;

function retryDue(key: string, force: boolean): boolean {
    if (force) return true;
    const st = retryState.get(key);
    return !st || Date.now() >= st.at;
}

/** A first failure: wait the start delay. */
function markFirstFailure(key: string): void {
    if (retryState.has(key)) return;
    retryState.set(key, {
        at: Date.now() + RETRY_START_MS,
        delay: RETRY_START_MS,
    });
}

/** A retry failed again: wait twice as long, up to the maximum. */
function backoffAfter(key: string): void {
    const delay = Math.min(
        (retryState.get(key)?.delay ?? RETRY_START_MS / 2) * 2,
        RETRY_MAX_MS,
    );
    retryState.set(key, { at: Date.now() + delay, delay });
}

interface PendingOriginItem {
    k: string;
    o: string;
}

/** Adds edits to their room's pending origins (write chain only). */
async function addPendingOrigins(
    db: IDBDatabase,
    roomId: string,
    items: PendingOriginItem[],
): Promise<void> {
    if (items.length === 0) return;
    const key = ORIGINS_PREFIX + roomId;
    const row = (await req(db.transaction(META).objectStore(META).get(key))) as
        { key: string; list: PendingOriginItem[] } | undefined;
    const list = [...(row?.list ?? [])];
    for (const it of items) {
        if (!list.some((x) => x.k === it.k)) list.push(it);
    }
    const tx = db.transaction(META, "readwrite");
    tx.objectStore(META).put({
        key,
        list: list.slice(Math.max(0, list.length - ORIGIN_PENDING_CAP)),
    });
    await done(tx);
}

/** Removes one edit from its room's pending origins (write chain only). */
async function removePendingOrigin(
    db: IDBDatabase,
    roomId: string,
    k: string,
): Promise<void> {
    const key = ORIGINS_PREFIX + roomId;
    const row = (await req(db.transaction(META).objectStore(META).get(key))) as
        { key: string; list: PendingOriginItem[] } | undefined;
    if (!row) return;
    const list = row.list.filter((x) => x.k !== k);
    const tx = db.transaction(META, "readwrite");
    if (list.length === 0) tx.objectStore(META).delete(key);
    else tx.objectStore(META).put({ key, list });
    await done(tx);
}

/** Records the edits whose original lookup failed, so they are retried. */
export function recordPendingOrigins(
    roomId: string,
    failed: readonly PendingEdit[],
): Promise<void> {
    if (failed.length === 0) return Promise.resolve();
    return chained(async () => {
        const s = session;
        if (!s || !isCurrent(s)) return;
        const items = failed.map((x) => ({
            k: entryKey(x.entry),
            o: x.original,
        }));
        for (const it of items) markFirstFailure(originKey(roomId, it.k));
        await addPendingOrigins(await s.db, roomId, items);
    });
}

/** Writes a tombstone's timestamp and scrubs what it names: the stored body
 *  (by hash and timestamp) and the edits of it (by their original's key). */
async function applyTombstoneTs(
    s: Session,
    db: IDBDatabase,
    roomId: string,
    eventId: string,
    ts: number,
): Promise<void> {
    const key = redactionKeyOf(eventIdHash(eventId), ts);
    const keys = new Set([key]);
    const plan = await planBlockScrub(db, roomId, keys);
    const tailRow = (await req(
        db.transaction(TAILS).objectStore(TAILS).get(roomId),
    )) as StoredTail | undefined;
    const tailNow = tailEntries(tailRow);
    const kept = dropRedactedEntries(tailNow, keys);
    const tx = db.transaction([TAILS, BLOCKS, MEDIA, REDACTED], "readwrite");
    tx.objectStore(REDACTED).put({ eventId, roomId, ts });
    tx.objectStore(MEDIA).delete(eventId);
    if (kept !== tailNow) {
        tx.objectStore(TAILS).put({
            roomId,
            fmt: 2,
            entries: kept,
        } satisfies StoredTail);
    }
    for (const block of plan.puts) tx.objectStore(BLOCKS).put(block);
    for (const id of plan.deletes) tx.objectStore(BLOCKS).delete(id);
    await done(tx);
    s.rooms.delete(roomId);
}

/** Sets `ot` on the one edit with key `k` (tail or block), dropping it at
 *  once if its original is already redacted. False when no such edit is stored. */
async function setEditOrigin(
    s: Session,
    db: IDBDatabase,
    roomId: string,
    k: string,
    ts: number,
): Promise<boolean> {
    const roomKeys = await redactionKeys(db, roomId);
    const apply = (entries: CompactEntry[]): CompactEntry[] | undefined => {
        const i = entries.findIndex(
            (e) => entryKey(e) === k && e.o !== undefined && e.ot === undefined,
        );
        if (i < 0) return undefined;
        const copy = entries.slice();
        copy[i] = { ...entries[i], ot: ts };
        return dropRedactedEntries(copy, roomKeys);
    };
    const tailRow = (await req(
        db.transaction(TAILS).objectStore(TAILS).get(roomId),
    )) as StoredTail | undefined;
    const nt = apply(tailEntries(tailRow));
    if (nt) {
        const tx = db.transaction(TAILS, "readwrite");
        tx.objectStore(TAILS).put({
            roomId,
            fmt: 2,
            entries: nt,
        } satisfies StoredTail);
        await done(tx);
        s.rooms.delete(roomId);
        return true;
    }
    const rows = (await req(
        db.transaction(BLOCKS).objectStore(BLOCKS).index("room").getAll(roomId),
    )) as StoredBlock[];
    for (const row of rows) {
        if (row.id === undefined || !isV2(row)) continue;
        const keys = decodeBlockKeys({ meta: row.meta, body: row.body });
        let has = false;
        for (let i = 0; i < keys.count && !has; i++) {
            has = entryKey({ h: keys.h[i], t: keys.t[i] }) === k;
        }
        if (!has) continue;
        const nb = apply(await blockEntries(row));
        if (!nb) continue;
        const tx = db.transaction(BLOCKS, "readwrite");
        if (nb.length === 0) tx.objectStore(BLOCKS).delete(row.id);
        else
            tx.objectStore(BLOCKS).put({
                ...encodeRoomBlock(roomId, nb),
                id: row.id,
            });
        await done(tx);
        s.rooms.delete(roomId);
        return true;
    }
    return false;
}

/**
 * Retries the pending tombstones and pending edit origins that are due (all
 * of them with `force`). Lookups run off the write chain, a few at a time;
 * the results are written on the chain. A lookup the server answers as
 * not-found clears its entry (logged): nothing can be matched later. Only
 * one run at a time; a call during a run returns at once.
 */
export async function runPendingRetries(
    opts: { force?: boolean } = {},
): Promise<void> {
    const s = session;
    if (!s || !isCurrent(s) || retryRunning) return;
    retryRunning = true;
    try {
        const db = await s.db;
        const tombRows = (await req(
            db.transaction(REDACTED).objectStore(REDACTED).getAll(),
        )) as {
            eventId: string;
            roomId: string;
            ts?: number;
            pending?: boolean;
        }[];
        const tombs = tombRows.filter(
            (t) =>
                t.pending === true &&
                retryDue(tombKey(t.roomId, t.eventId), !!opts.force),
        );
        const originRows = (await req(
            db.transaction(META).objectStore(META).getAll(),
        )) as { key: string; list?: PendingOriginItem[] }[];
        const origins: { roomId: string; item: PendingOriginItem }[] = [];
        for (const row of originRows) {
            if (!row.key.startsWith(ORIGINS_PREFIX)) continue;
            const roomId = row.key.slice(ORIGINS_PREFIX.length);
            for (const item of row.list ?? []) {
                if (retryDue(originKey(roomId, item.k), !!opts.force)) {
                    origins.push({ roomId, item });
                }
            }
        }
        const lookupKeys = new Map<string, { roomId: string; id: string }>();
        for (const t of tombs) {
            lookupKeys.set(`${t.roomId}|${t.eventId}`, {
                roomId: t.roomId,
                id: t.eventId,
            });
        }
        for (const o of origins) {
            lookupKeys.set(`${o.roomId}|${o.item.o}`, {
                roomId: o.roomId,
                id: o.item.o,
            });
        }
        const found = new Map<string, OriginLookup>();
        await mapLimit(
            [...lookupKeys],
            ORIGIN_FETCH_CONCURRENCY,
            async ([k, v]) => {
                if (!isCurrent(s)) return;
                found.set(k, await lookupOriginTs(v.roomId, v.id));
            },
        );
        if (!isCurrent(s)) return;

        await chained(async () => {
            for (const t of tombs) {
                if (!isCurrent(s)) return;
                const r = found.get(`${t.roomId}|${t.eventId}`);
                const key = tombKey(t.roomId, t.eventId);
                if (!r) continue;
                if (r.kind === "failed") {
                    backoffAfter(key);
                    continue;
                }
                retryState.delete(key);
                // Superseded meanwhile (rewritten, or gone)?
                const cur = (await req(
                    db
                        .transaction(REDACTED)
                        .objectStore(REDACTED)
                        .get(t.eventId),
                )) as { pending?: boolean } | undefined;
                if (!cur || cur.pending !== true) continue;
                if (r.kind === "gone") {
                    console.info(
                        "[eventIndex] a redacted event is unknown to the server; its body stays unmatched",
                    );
                    const tx = db.transaction(REDACTED, "readwrite");
                    tx.objectStore(REDACTED).put({
                        eventId: t.eventId,
                        roomId: t.roomId,
                    });
                    await done(tx);
                } else {
                    await applyTombstoneTs(s, db, t.roomId, t.eventId, r.ts);
                }
            }
            for (const o of origins) {
                if (!isCurrent(s)) return;
                const r = found.get(`${o.roomId}|${o.item.o}`);
                const key = originKey(o.roomId, o.item.k);
                if (!r) continue;
                if (r.kind === "failed") {
                    backoffAfter(key);
                    continue;
                }
                retryState.delete(key);
                if (r.kind === "ts") {
                    await setEditOrigin(s, db, o.roomId, o.item.k, r.ts);
                } else {
                    console.info(
                        "[eventIndex] an edit's original is unknown to the server; the edit stays unlinked",
                    );
                }
                await removePendingOrigin(db, o.roomId, o.item.k);
            }
        });
    } finally {
        retryRunning = false;
    }
}

/** Runs `fn` on the write chain and returns its result: it sees every write
 *  queued before it, and no write runs while it does. */
function chained<T>(fn: () => Promise<T>): Promise<T> {
    const run = writeChain.then(fn);
    writeChain = run.then(
        () => undefined,
        (e) => {
            reportStorageError(e, { fromIndexedDB: true });
            console.warn("[eventIndex] write failed", e);
        },
    );
    return run;
}

/**
 * A room's in-memory index state: the key of every stored message (for
 * dedup), a summary of each block (for compaction), and the tail. Built from
 * the rows on first use and kept up to date by writeRoom. Only called on the
 * write chain, so it never reads a room half-written.
 */
async function roomCache(
    s: Session,
    db: IDBDatabase,
    roomId: string,
): Promise<RoomIndexCache> {
    const hit = s.rooms.get(roomId);
    if (hit) return hit;
    const tx = db.transaction([BLOCKS, TAILS], "readonly");
    const [blocks, tail] = await Promise.all([
        req(tx.objectStore(BLOCKS).index("room").getAll(roomId)) as Promise<
            StoredBlock[]
        >,
        req(tx.objectStore(TAILS).get(roomId)) as Promise<
            StoredTail | undefined
        >,
    ]);
    const cache: RoomIndexCache = {
        keys: new Set(),
        blocks: new Map(),
        tail: tailEntries(tail),
    };
    for (const row of blocks) {
        if (row.id === undefined) continue;
        cache.blocks.set(row.id, summaryOf(row));
        if (isV2(row)) {
            const k = decodeBlockKeys({ meta: row.meta, body: row.body });
            for (let i = 0; i < k.count; i++)
                cache.keys.add(entryKey({ h: k.h[i], t: k.t[i] }));
        } else {
            for (const e of await blockEntries(row))
                cache.keys.add(entryKey(e));
        }
    }
    for (const e of cache.tail) cache.keys.add(entryKey(e));
    s.rooms.set(roomId, cache);
    return cache;
}

/** Stored blocks of a room with the given redactions' bodies removed: each
 *  rewritten in place, or deleted once empty. Only blocks whose keys name one
 *  of them are decoded. Nothing is written here. */
interface BlockScrub {
    puts: StoredBlockV2[];
    deletes: number[];
    removed: CompactEntry[];
}

async function planBlockScrub(
    db: IDBDatabase,
    roomId: string,
    keys: ReadonlySet<string>,
): Promise<BlockScrub> {
    const rows = (await req(
        db.transaction(BLOCKS).objectStore(BLOCKS).index("room").getAll(roomId),
    )) as StoredBlock[];
    const plan: BlockScrub = { puts: [], deletes: [], removed: [] };
    for (const row of rows) {
        if (row.id === undefined) continue;
        if (
            isV2(row) &&
            !touchesKeys(
                decodeBlockKeys({ meta: row.meta, body: row.body }),
                keys,
            )
        )
            continue;
        const entries = await blockEntries(row);
        const kept = dropRedactedEntries(entries, keys);
        if (kept.length === entries.length) continue;
        const keptSet = new Set(kept);
        plan.removed.push(...entries.filter((e) => !keptSet.has(e)));
        if (kept.length === 0) plan.deletes.push(row.id);
        else plan.puts.push({ ...encodeRoomBlock(roomId, kept), id: row.id });
    }
    return plan;
}

/** Adjacent blocks (by first timestamp) grouped while their bodies fit one
 *  block's budget. Only groups of two or more are returned. */
function planCompaction(blocks: Map<number, BlockSummary>): number[][] {
    const list = [...blocks]
        .filter(([, b]) => !b.legacy)
        .map(([id, b]) => ({ id, ...b }))
        .sort((a, b) => a.minTs - b.minTs);
    const groups: number[][] = [];
    let cur: number[] = [];
    let sum = 0;
    for (const b of list) {
        if (cur.length > 0 && sum + b.bodyRaw > BLOCK_BODY_CAP) {
            groups.push(cur);
            cur = [];
            sum = 0;
        }
        cur.push(b.id);
        sum += b.bodyRaw;
    }
    if (cur.length > 0) groups.push(cur);
    return groups.filter((g) => g.length >= 2);
}

/**
 * Merges a room's small blocks once it has enough of them: the groups from
 * planCompaction are decoded, merged and re-encoded, and each group is put
 * back as one block in a single transaction. The entries and their keys don't
 * change, so the key set is left as it is.
 */
async function maybeCompact(
    s: Session,
    db: IDBDatabase,
    roomId: string,
): Promise<void> {
    const cache = s.rooms.get(roomId);
    if (!cache) return;
    let small = 0;
    for (const b of cache.blocks.values()) {
        if (!b.legacy && b.bodyRaw < SMALL_BLOCK_BODY) small++;
    }
    if (small < COMPACT_MIN_SMALL) return;
    const groups = planCompaction(cache.blocks);
    if (groups.length === 0) return;
    const rows = (await req(
        db.transaction(BLOCKS).objectStore(BLOCKS).index("room").getAll(roomId),
    )) as StoredBlock[];
    const byId = new Map<number, StoredBlockV2>();
    for (const row of rows) {
        if (row.id !== undefined && isV2(row)) byId.set(row.id, row);
    }
    const plans: { ids: number[]; block: StoredBlockV2 }[] = [];
    for (const ids of groups) {
        const entries: CompactEntry[] = [];
        let whole = true;
        for (const id of ids) {
            const row = byId.get(id);
            if (!row) {
                whole = false;
                break;
            }
            entries.push(
                ...decodeIndexBlock({ meta: row.meta, body: row.body }),
            );
        }
        if (whole) plans.push({ ids, block: encodeRoomBlock(roomId, entries) });
    }
    if (plans.length === 0) return;
    const tx = db.transaction(BLOCKS, "readwrite");
    const store = tx.objectStore(BLOCKS);
    const added = plans.map((p) => store.add(p.block));
    for (const p of plans) for (const id of p.ids) store.delete(id);
    await done(tx);
    plans.forEach((p, i) => {
        for (const id of p.ids) cache.blocks.delete(id);
        cache.blocks.set(added[i].result as number, summaryOf(p.block));
    });
}

/** One room's share of a flush. */
interface RoomBatch {
    entries: CompactEntry[];
    media: StoredMedia[];
    redacted: RedactionNote[];
    fullIds: Map<CompactEntry, string>;
    edits: PendingEdit[];
}

/**
 * Writes a room's batch: its entries, minus the ones already stored or
 * redacted, then the redactions and media. Every full block is cut off the
 * tail, and then compaction runs. Runs on the write chain.
 */
async function writeRoom(
    s: Session,
    db: IDBDatabase,
    roomId: string,
    b: RoomBatch,
): Promise<void> {
    try {
        await writeRoomRows(s, db, roomId, b);
        await maybeCompact(s, db, roomId);
    } catch (e) {
        // The in-memory view may be ahead of what was stored: rebuild it.
        s.rooms.delete(roomId);
        throw e;
    }
}

/** The (hash, timestamp) key of a redaction note, or undefined without a timestamp. */
function noteKey(n: RedactionNote): string | undefined {
    return n.ts === undefined
        ? undefined
        : redactionKeyOf(eventIdHash(n.eventId), n.ts);
}

async function writeRoomRows(
    s: Session,
    db: IDBDatabase,
    roomId: string,
    b: RoomBatch,
): Promise<void> {
    const cache = await roomCache(s, db, roomId);
    // Every tombstone this room has, plus the ones in this batch. A message
    // is redacted when its (hash, timestamp) matches a tombstone's; a
    // tombstone without a timestamp matches by full id only (see migration).
    const tombRows = (await req(
        db
            .transaction(REDACTED)
            .objectStore(REDACTED)
            .index("room")
            .getAll(roomId),
    )) as { eventId: string; ts?: number }[];
    const goneIds = new Set(tombRows.map((r) => r.eventId));
    const goneKeys = new Set<string>();
    for (const r of tombRows) {
        const k = noteKey(r);
        if (k !== undefined) goneKeys.add(k);
    }
    for (const n of b.redacted) {
        goneIds.add(n.eventId);
        const k = noteKey(n);
        if (k !== undefined) goneKeys.add(k);
    }
    const isGone = (e: CompactEntry): boolean => {
        if (goneKeys.has(entryKey(e))) return true;
        return (
            e.o !== undefined &&
            e.ot !== undefined &&
            goneKeys.has(redactionKeyOf(e.o, e.ot))
        );
    };

    const tailKept = dropRedactedEntries(cache.tail, goneKeys);
    const keptTail = new Set(tailKept);
    const droppedTail = cache.tail.filter((e) => !keptTail.has(e));
    for (const e of droppedTail) cache.keys.delete(entryKey(e));

    // Exact checks first, by full id: the message itself, and the original an
    // edit replaces (when this batch knows both).
    const originOf = new Map<CompactEntry, string>();
    for (const x of b.edits) originOf.set(x.entry, x.original);
    const fresh: CompactEntry[] = [];
    for (const e of b.entries) {
        const full = b.fullIds.get(e);
        if (full !== undefined && goneIds.has(full)) continue;
        const origin = originOf.get(e);
        if (origin !== undefined && goneIds.has(origin)) continue;
        if (isGone(e)) continue;
        const key = entryKey(e);
        if (cache.keys.has(key)) continue;
        cache.keys.add(key);
        fresh.push(e);
    }

    let entries = [...tailKept, ...fresh];
    const newBlocks: StoredBlockV2[] = [];
    while (entries.length >= BLOCK_SIZE) {
        newBlocks.push(encodeRoomBlock(roomId, entries.slice(0, BLOCK_SIZE)));
        entries = entries.slice(BLOCK_SIZE);
    }
    const tail = entries;
    // The stored bodies of messages redacted in this batch are removed from
    // their blocks, in the same transaction as the tombstone, so a tombstone
    // never outlives the plaintext it names.
    const batchKeys = new Set<string>();
    for (const n of b.redacted) {
        const k = noteKey(n);
        if (k !== undefined) batchKeys.add(k);
    }
    const scrub =
        batchKeys.size > 0 ? await planBlockScrub(db, roomId, batchKeys) : null;
    const tx = db.transaction([TAILS, BLOCKS, MEDIA, REDACTED], "readwrite");
    tx.objectStore(TAILS).put({
        roomId,
        fmt: 2,
        entries: tail,
    } satisfies StoredTail);
    if (scrub) {
        for (const block of scrub.puts) tx.objectStore(BLOCKS).put(block);
        for (const id of scrub.deletes) tx.objectStore(BLOCKS).delete(id);
    }
    const added = newBlocks.map((block) => tx.objectStore(BLOCKS).add(block));
    for (const m of b.media) {
        if (!goneIds.has(m.eventId)) tx.objectStore(MEDIA).put(m);
    }
    for (const n of b.redacted) {
        tx.objectStore(REDACTED).put(
            // A timestamp when known; `pending` when its lookup failed (retried);
            // neither when the server has no such event (matched by full id only).
            n.ts !== undefined
                ? { eventId: n.eventId, roomId, ts: n.ts }
                : n.pending
                  ? { eventId: n.eventId, roomId, pending: true }
                  : { eventId: n.eventId, roomId },
        );
        tx.objectStore(MEDIA).delete(n.eventId);
    }
    await done(tx);

    cache.tail = tail;
    if (scrub) {
        for (const e of scrub.removed) cache.keys.delete(entryKey(e));
        for (const id of scrub.deletes) cache.blocks.delete(id);
        for (const block of scrub.puts)
            cache.blocks.set(block.id as number, summaryOf(block));
    }
    newBlocks.forEach((block, i) =>
        cache.blocks.set(added[i].result as number, summaryOf(block)),
    );
}

/** Run a write after the ones already queued (every index write goes through
 *  this chain, so two writers never touch the same rows at once). */
function serialWrite(fn: () => Promise<void>): Promise<void> {
    writeChain = writeChain.then(fn).catch((e) => {
        reportStorageError(e, { fromIndexedDB: true });
        console.warn("[eventIndex] write failed", e);
    });
    return writeChain;
}

/**
 * Once per index: a redaction stored before the scrub existed left its body
 * in a block. Walk every room with a tombstone and remove those bodies. Runs
 * on the write chain; a flag in META means it never runs again. A tombstone
 * without a timestamp removes nothing by hash, as everywhere else.
 */
async function scrubPriorRedactions(s: Session): Promise<void> {
    const db = await s.db;
    const flag = await req(
        db.transaction(META).objectStore(META).get(REDACTION_SCRUB_KEY),
    );
    if (flag) return;
    const tombs = (await req(
        db.transaction(REDACTED).objectStore(REDACTED).getAll(),
    )) as { eventId: string; roomId: string; ts?: number }[];
    const byRoom = new Map<string, Set<string>>();
    for (const t of tombs) {
        const key = noteKey(t);
        if (key === undefined) continue;
        let keys = byRoom.get(t.roomId);
        if (!keys) {
            keys = new Set();
            byRoom.set(t.roomId, keys);
        }
        keys.add(key);
    }
    for (const [roomId, keys] of byRoom) {
        if (s.stopped) return;
        const tail = (await req(
            db.transaction(TAILS).objectStore(TAILS).get(roomId),
        )) as StoredTail | undefined;
        const plan = await planBlockScrub(db, roomId, keys);
        const tailNow = tailEntries(tail);
        const kept = dropRedactedEntries(tailNow, keys);
        const tx = db.transaction([TAILS, BLOCKS], "readwrite");
        if (tail && kept !== tailNow)
            tx.objectStore(TAILS).put({
                roomId,
                fmt: 2,
                entries: kept,
            } satisfies StoredTail);
        for (const block of plan.puts) tx.objectStore(BLOCKS).put(block);
        for (const id of plan.deletes) tx.objectStore(BLOCKS).delete(id);
        await done(tx);
        s.rooms.delete(roomId);
    }
    const flagTx = db.transaction(META, "readwrite");
    flagTx
        .objectStore(META)
        .put({ key: REDACTION_SCRUB_KEY, done: true, at: Date.now() });
    await done(flagTx);
}

/**
 * Once per index: rewrite each room that still holds legacy (format 1) rows
 * into format 2. Every entry of the room is read, duplicates are dropped (a
 * legacy row's copies by full event id, then any copy by key), tombstoned
 * messages are dropped, and the rest is written back as format 2 blocks plus
 * a new tail, in one transaction per room. A room that is interrupted is
 * simply redone on the next start. A META flag records completion. Runs on
 * the write chain, before any other write.
 */
async function migrateLegacyIndex(s: Session): Promise<void> {
    const db = await s.db;
    const flag = await req(
        db.transaction(META).objectStore(META).get(MIGRATION_KEY),
    );
    if (flag) return;
    const roomIds = (await req(
        db.transaction(TAILS).objectStore(TAILS).getAllKeys(),
    )) as string[];
    for (const roomId of roomIds) {
        if (s.stopped) return;
        await migrateRoom(s, db, roomId);
    }
    const flagTx = db.transaction(META, "readwrite");
    flagTx
        .objectStore(META)
        .put({ key: MIGRATION_KEY, done: true, at: Date.now() });
    await done(flagTx);
}

async function migrateRoom(
    s: Session,
    db: IDBDatabase,
    roomId: string,
): Promise<void> {
    const read = db.transaction([BLOCKS, TAILS, REDACTED], "readonly");
    const [blocks, tail, tombRows] = await Promise.all([
        req(read.objectStore(BLOCKS).index("room").getAll(roomId)) as Promise<
            StoredBlock[]
        >,
        req(read.objectStore(TAILS).get(roomId)) as Promise<
            StoredTail | undefined
        >,
        req(read.objectStore(REDACTED).index("room").getAll(roomId)) as Promise<
            { eventId: string; ts?: number }[]
        >,
    ]);
    const hasLegacy =
        blocks.some((b) => !isV2(b)) || (tail !== undefined && tail.fmt !== 2);
    if (!hasLegacy) return;

    const goneIds = new Set(tombRows.map((r) => r.eventId));
    const goneKeys = new Set<string>();
    for (const r of tombRows) {
        const k = noteKey(r);
        if (k !== undefined) goneKeys.add(k);
    }
    // Oldest rows first, then the tail (the newest): the first copy wins.
    const ordered = [...blocks].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    const legacyLists: LegacyIndexEntry[][] = [];
    for (const b of ordered) {
        if (!isV2(b)) legacyLists.push(await decodeLegacyBlock(b));
    }
    const legacyTail =
        tail && tail.fmt !== 2 ? (tail.entries as LegacyIndexEntry[]) : null;
    if (legacyTail) legacyLists.push(legacyTail);
    // The timestamp of each legacy message, by full id. A legacy edit's
    // original is found exactly here, when it is in the room's legacy data.
    const legacyTs = new Map<string, number>();
    for (const list of legacyLists) {
        for (const e of list) {
            if (!legacyTs.has(e.e)) legacyTs.set(e.e, e.t);
        }
    }

    const legacyIds = new Set<string>();
    const keys = new Set<string>();
    const all: CompactEntry[] = [];
    const add = (e: CompactEntry) => {
        if (goneKeys.has(entryKey(e))) return;
        if (
            e.o !== undefined &&
            e.ot !== undefined &&
            goneKeys.has(redactionKeyOf(e.o, e.ot))
        )
            return;
        const key = entryKey(e);
        if (keys.has(key)) return;
        keys.add(key);
        all.push(e);
    };
    const addLegacy = (list: LegacyIndexEntry[]) => {
        for (const e of list) {
            if (legacyIds.has(e.e)) continue;
            legacyIds.add(e.e);
            // Tombstones apply by full id here, exactly, whatever their time.
            if (goneIds.has(e.e) || (e.o !== undefined && goneIds.has(e.o)))
                continue;
            const originTs = e.o !== undefined ? legacyTs.get(e.o) : undefined;
            add(legacyToCompact(e, originTs));
        }
    };
    let li = 0;
    for (const b of ordered) {
        if (isV2(b)) {
            for (const e of decodeIndexBlock({ meta: b.meta, body: b.body }))
                add(e);
        } else {
            addLegacy(legacyLists[li++]);
        }
    }
    if (legacyTail) {
        addLegacy(legacyTail);
    } else if (tail?.fmt === 2) {
        for (const e of tail.entries as CompactEntry[]) add(e);
    }

    all.sort((a, b) => a.t - b.t);
    // Straight to full-size blocks (compaction would only merge 250-entry
    // ones on the room's next write); the newest partial run stays the tail.
    const tailStart = all.length - (all.length % BLOCK_SIZE);
    const fresh: StoredBlockV2[] = [];
    const enc = new TextEncoder();
    let start = 0;
    let body = 0;
    for (let i = 0; i < tailStart; i++) {
        const size = enc.encode(all[i].b).length + 1;
        if (i > start && body + size > BLOCK_BODY_CAP) {
            fresh.push(encodeRoomBlock(roomId, all.slice(start, i)));
            start = i;
            body = 0;
        }
        body += size;
    }
    if (start < tailStart)
        fresh.push(encodeRoomBlock(roomId, all.slice(start, tailStart)));
    const restTail = all.slice(tailStart);

    const tx = db.transaction([BLOCKS, TAILS], "readwrite");
    for (const b of blocks) {
        if (b.id !== undefined) tx.objectStore(BLOCKS).delete(b.id);
    }
    for (const block of fresh) tx.objectStore(BLOCKS).add(block);
    tx.objectStore(TAILS).put({
        roomId,
        fmt: 2,
        entries: restTail,
    } satisfies StoredTail);
    await done(tx);
    s.rooms.delete(roomId);
}

// ── Live feed ──────────────────────────────────────────────────────────────

function liveEvent(ev: MatrixEvent, room: Room | null | undefined): void {
    if (!room || !isRoomEncrypted(room)) return;
    const eventId = ev.getId();
    const sender = ev.getSender();
    // Local echoes (no server id yet) and messages still waiting for a key.
    if (!eventId || eventId.startsWith("~") || !sender) return;
    if (ev.isBeingDecrypted() || ev.isDecryptionFailure()) return;
    if (
        queueEvent(room.roomId, {
            eventId,
            sender,
            ts: ev.getTs(),
            type: ev.getType(),
            content: ev.getContent(),
            redacted: ev.isRedacted(),
        })
    )
        scheduleFlush();
}

/** A redaction event on the timeline. Fed from RoomEvent.Timeline, not
 *  RoomEvent.Redaction: the SDK raises that only when the target is loaded, and
 *  an older message's body may be indexed while it is not. */
function liveRedaction(ev: MatrixEvent, room: Room | null | undefined): void {
    if (!room || !isRoomEncrypted(room)) return;
    const target =
        (ev.event as { redacts?: string }).redacts ??
        (ev.getContent().redacts as string | undefined);
    if (!target) return;
    const roomId = room.roomId;
    const s = session;
    // Marked at once, so an event arriving meanwhile is not queued; the
    // tombstone (with the redacted event's timestamp) follows once looked up.
    bucket(roomId).redactedIds.add(target);
    void lookupOriginTs(roomId, target)
        .catch((): OriginLookup => ({ kind: "failed" }))
        .then((r) => {
            if (!s || !isCurrent(s)) return;
            if (r.kind === "ts") {
                noteRedaction(roomId, { eventId: target, ts: r.ts });
            } else {
                if (r.kind === "failed")
                    markFirstFailure(tombKey(roomId, target));
                noteRedaction(roomId, {
                    eventId: target,
                    pending: r.kind === "failed",
                });
            }
            scheduleFlush();
        });
}

// ── Coverage ───────────────────────────────────────────────────────────────

/** Ranges are only ever added, so two writers can't undo each other. */
function addCoverage(roomId: string, range: Range): Promise<void> {
    const s = session;
    if (!s || !(range[0] <= range[1])) return writeChain;
    writeChain = writeChain
        .then(async () => {
            const db = await s.db;
            const store = (m: IDBTransactionMode) =>
                db.transaction(COVERAGE, m).objectStore(COVERAGE);
            const row = (await req(store("readonly").get(roomId))) as
                StoredCoverage | undefined;
            const ranges = addRange(row?.ranges ?? [], range);
            await req(
                store("readwrite").put({ roomId, ranges } as StoredCoverage),
            );
        })
        .catch((e) => {
            reportStorageError(e, { fromIndexedDB: true });
            console.warn("[eventIndex] coverage write failed", e);
        });
    return writeChain;
}

/** What this device has fully indexed of a room. */
export async function getCoverage(roomId: string): Promise<Range[]> {
    const s = session;
    if (!s) return [];
    const db = await s.db;
    await writeChain;
    const row = (await req(
        db.transaction(COVERAGE).objectStore(COVERAGE).get(roomId),
    )) as StoredCoverage | undefined;
    return row?.ranges ?? [];
}

/** Rooms an index from before coverage existed already holds: claim only the
 *  span between their oldest and newest message, and all the way back when
 *  the crawler had finished. Gaps inside that span are unknowable. */
async function seedCoverage(s: Session): Promise<void> {
    const db = await s.db;
    const tx = db.transaction([BLOCKS, TAILS, CRAWL, COVERAGE]);
    const [blocks, tails, crawls, covs] = await Promise.all([
        req(tx.objectStore(BLOCKS).getAll()) as Promise<StoredBlock[]>,
        req(tx.objectStore(TAILS).getAll()) as Promise<StoredTail[]>,
        req(tx.objectStore(CRAWL).getAll()) as Promise<CrawlState[]>,
        req(tx.objectStore(COVERAGE).getAllKeys()) as Promise<IDBValidKey[]>,
    ]);
    const has = new Set(covs);
    const span = new Map<string, Range>();
    const widen = (roomId: string, lo: number, hi: number) => {
        const cur = span.get(roomId);
        span.set(roomId, [
            Math.min(lo, cur?.[0] ?? lo),
            Math.max(hi, cur?.[1] ?? hi),
        ]);
    };
    for (const b of blocks) widen(b.roomId, b.minTs, b.maxTs);
    for (const t of tails) for (const e of t.entries) widen(t.roomId, e.t, e.t);
    const finished = new Set(crawls.filter((c) => c.done).map((c) => c.roomId));
    for (const [roomId, r] of span) {
        if (has.has(roomId)) continue;
        await addCoverage(roomId, [finished.has(roomId) ? 0 : r[0], r[1]]);
    }
}

// ── Crawler ────────────────────────────────────────────────────────────────

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function storageTight(): Promise<boolean> {
    try {
        const est = await navigator.storage?.estimate?.();
        if (!est?.usage) return false;
        return (
            est.usage > STORAGE_CAP_BYTES ||
            (!!est.quota && est.usage > est.quota / 2)
        );
    } catch {
        return false;
    }
}

function crawlCandidates(client: MatrixClient): Room[] {
    return client
        .getRooms()
        .filter((r) => r.getMyMembership() === "join" && isRoomEncrypted(r))
        .sort(
            (a, b) => b.getLastActiveTimestamp() - a.getLastActiveTimestamp(),
        );
}

/** Joined encrypted rooms, newest activity first, for the peer sync. */
export function indexedRoomIds(): string[] {
    const s = session;
    return s ? crawlCandidates(s.client).map((r) => r.roomId) : [];
}

/**
 * Whatever backfilling costs, other devices can supply it for free, so the
 * crawler waits until this moment (the peer sync sets it while it asks).
 */
let backfillHeldUntil = 0;
export function holdBackfill(untilMs: number): void {
    backfillHeldUntil = Math.max(backfillHeldUntil, untilMs);
}

/** A gap shorter than this is the live feed catching up, not a hole. */
const GAP_MIN_MS = 2 * 60_000;
/** Rooms whose hole has been looked for this connection. */
const gapChecked = new Set<string>();
/** Where the live feed's coverage was last extended, per room. */
const liveEdge = new Map<string, number>();
let wasStale = false;

/** Claim the time the live feed has been continuously connected for. After
 *  a dropped connection the hole is looked for again. */
function liveTick(): void {
    if (isSyncStale()) {
        if (!wasStale) {
            wasStale = true;
            liveEdge.clear();
            gapChecked.clear();
        }
        return;
    }
    wasStale = false;
    // Pending timestamp lookups (tombstones, edits) retry when due.
    void runPendingRetries().catch((e) =>
        console.warn("[eventIndex] retry failed", e),
    );
    const now = Date.now();
    for (const [roomId, from] of liveEdge) {
        void addCoverage(roomId, [from, now]);
        liveEdge.set(roomId, now);
    }
}

/** Rooms whose crawl or gap page threw, and when to try them again. A failing
 *  room is skipped, so it can't hold up the rooms after it. */
const CRAWL_RETRY_START_MS = 5 * 60_000;
const CRAWL_RETRY_MAX_MS = 60 * 60_000;
const retryAfter = new Map<string, { at: number; delay: number }>();

function backingOff(roomId: string): boolean {
    const r = retryAfter.get(roomId);
    return !!r && Date.now() < r.at;
}

function crawlFailed(roomId: string, e: unknown): void {
    const prev = retryAfter.get(roomId)?.delay;
    const delay = prev
        ? Math.min(prev * 2, CRAWL_RETRY_MAX_MS)
        : CRAWL_RETRY_START_MS;
    retryAfter.set(roomId, { at: Date.now() + delay, delay });
    console.warn("[eventIndex] crawl page failed", roomId, e);
}

/** Options for one crawl step. The full build passes its abort signal and a
 *  hook told which room is about to be fetched; the background crawler passes none. */
interface CrawlRun {
    signal?: AbortSignal;
    /** Before a request: the room, which pass ("recent" fills a gap up to the
     *  present, "history" walks back from the oldest point reached), and the
     *  moment that pass has reached so far (undefined before its first page). */
    onRoom?: (room: Room, pass: CrawlPass, reachedTs?: number) => void;
    /** After a page landed: how far back that pass has now reached. */
    onPage?: (room: Room, pass: CrawlPass, reachedTs: number) => void;
}
export type CrawlPass = "recent" | "history";

/** Fetch, decrypt and queue one backwards page. `minTs` is the oldest event
 *  on it (indexable or not), null when the page is empty. A `prefetched` page
 *  (taken from native, same token, filter and page size) replaces the request.
 *  Throws when the request times out or is aborted; returns null when stopped. */
async function fetchPage(
    s: Session,
    room: Room,
    from: string | null,
    prefetched: TakenPrefetchPage | null = null,
    signal?: AbortSignal,
): Promise<{ end: string | null; minTs: number | null } | null> {
    let chunk: RawPageChunk;
    let end: string | null;
    if (prefetched) {
        chunk = prefetched.chunk as RawPageChunk;
        end = prefetched.end;
    } else {
        const filter = new Filter(s.client.getUserId());
        filter.setDefinition(mediaFilterDefinition(true, CRAWL_PAGE_SIZE));
        const res = await raceWithTimeout(
            s.client.createMessagesRequest(
                room.roomId,
                from,
                CRAWL_PAGE_SIZE,
                Direction.Backward,
                filter,
            ),
            CRAWL_REQUEST_TIMEOUT_MS,
            signal,
        );
        if (s.stopped) return null;
        chunk = res.chunk ?? [];
        end = res.end ?? null;
    }
    // A mapper re-emits Decrypted on the client, so a key that arrives after
    // this page (server key backup) still reaches the index's live listener.
    const map = s.client.getEventMapper({ decrypt: false });
    const events = chunk.map((raw) => map({ ...raw, room_id: room.roomId }));
    // A few at a time: every decryption in flight holds working memory in the
    // crypto WASM, which never shrinks, so a whole page at once raises the
    // module's size for the rest of the session.
    const encrypted = events.filter((e) => e.getType() === "m.room.encrypted");
    for (let i = 0; i < encrypted.length; i += CRAWL_DECRYPT_BATCH) {
        if (s.stopped || signal?.aborted) return null;
        // A batch that hangs is left behind after the timeout. Events still
        // undecrypted are skipped below, since only m.room.message is indexed.
        await raceWithTimeout(
            Promise.all(
                encrypted
                    .slice(i, i + CRAWL_DECRYPT_BATCH)
                    .map((e) =>
                        s.client.decryptEventIfNeeded(e).catch(() => {}),
                    ),
            ),
            CRAWL_DECRYPT_TIMEOUT_MS,
            signal,
        ).catch(() => {});
    }
    if (s.stopped || signal?.aborted) return null;
    let minTs: number | null = null;
    let maxTs: number | null = null;
    for (const e of events) {
        minTs = Math.min(minTs ?? Infinity, e.getTs());
        maxTs = Math.max(maxTs ?? -Infinity, e.getTs());
    }
    // A re-walk (v3 repair, gap walk) meets messages already stored; skipping
    // them stops a message being stored twice.
    let known: ReadonlySet<string> = new Set<string>();
    if (minTs !== null && maxTs !== null) {
        await flush();
        if (s.stopped) return null;
        const db = await s.db;
        known = (await chained(() => roomCache(s, db, room.roomId))).keys;
        if (s.stopped) return null;
    }
    for (const e of events) {
        const eventId = e.getId();
        const sender = e.getSender();
        // The server hands a redacted event back as a stub: whatever this
        // device still holds of its body goes too.
        if (eventId && e.isRedacted())
            noteRedaction(room.roomId, { eventId, ts: e.getTs() });
        if (!eventId || !sender || e.isDecryptionFailure()) continue;
        queueEvent(
            room.roomId,
            {
                eventId,
                sender,
                ts: e.getTs(),
                type: e.getType(),
                content: e.getContent(),
                redacted: e.isRedacted(),
            },
            known,
        );
    }
    await flush();
    return { end, minTs };
}

async function crawlState(
    db: IDBDatabase,
    roomId: string,
): Promise<CrawlState | undefined> {
    return (await req(db.transaction(CRAWL).objectStore(CRAWL).get(roomId))) as
        CrawlState | undefined;
}

/** One page of a gap walk, if some room has a hole up to the present. */
async function gapStep(
    s: Session,
    db: IDBDatabase,
    run: CrawlRun = {},
): Promise<boolean> {
    for (const room of crawlCandidates(s.client)) {
        const id = room.roomId;
        if (backingOff(id)) continue;
        const state = await crawlState(db, id);
        let walk = state?.gap;
        if (!walk) {
            if (gapChecked.has(id)) continue;
            gapChecked.add(id);
            liveEdge.set(id, Date.now());
            const ranges = await getCoverage(id);
            const newest = ranges.length ? ranges[ranges.length - 1][1] : 0;
            // No coverage at all is the history crawler's job, from the top.
            if (!newest || Date.now() - newest < GAP_MIN_MS) continue;
            walk = { from: null, up: Date.now(), stopAt: newest };
        }
        let page: Awaited<ReturnType<typeof fetchPage>>;
        run.onRoom?.(room, "recent", walk.from === null ? undefined : walk.up);
        try {
            page = await fetchPage(s, room, walk.from, null, run.signal);
        } catch (e) {
            if (run.signal?.aborted) return false;
            crawlFailed(id, e);
            continue;
        }
        retryAfter.delete(id);
        if (!page) return false;
        const finished =
            page.end === null ||
            page.end === walk.from ||
            (page.minTs !== null && page.minTs <= walk.stopAt);
        const low = finished
            ? walk.stopAt
            : Math.min(page.minTs ?? walk.up, walk.up);
        await addCoverage(id, [low, walk.up]);
        run.onPage?.(room, "recent", low);
        const tx = db.transaction(CRAWL, "readwrite");
        tx.objectStore(CRAWL).put({
            roomId: id,
            from: state?.from ?? null,
            done: state?.done ?? false,
            upTs: state?.upTs,
            gap: finished
                ? undefined
                : { from: page.end, up: low, stopAt: walk.stopAt },
        } satisfies CrawlState);
        await done(tx);
        return true;
    }
    return false;
}

/** What one crawl step did: "server" (a request), "prefetch" (a page native
 *  had fetched, no request), "held" (only server work was left and it was not
 *  allowed), or false (nothing to do). */
export type CrawlStepResult = "server" | "prefetch" | "held" | false;

/** Index one page of some room's history. With `serverAllowed` false, only
 *  prefetched pages are taken; rooms needing the server are left alone. */
async function crawlStep(
    s: Session,
    serverAllowed: boolean,
    run: CrawlRun = {},
): Promise<CrawlStepResult> {
    const db = await s.db;
    if (serverAllowed && (await gapStep(s, db, run))) return "server";
    if (run.signal?.aborted) return false;
    let held = false;
    for (const room of crawlCandidates(s.client)) {
        if (run.signal?.aborted) return false;
        if (backingOff(room.roomId)) continue;
        const state = await crawlState(db, room.roomId);
        if (state?.done) continue;
        const from = state?.from ?? null;
        const up = state?.upTs ?? Date.now();
        // Native may already hold the page for this exact token.
        const prefetched =
            from !== null && historyPrefetchAvailable()
                ? await takePrefetchedPage(s.dbName, room.roomId, from)
                : null;
        if (!prefetched && !serverAllowed) {
            held = true;
            continue;
        }
        let page: Awaited<ReturnType<typeof fetchPage>>;
        run.onRoom?.(room, "history", state?.upTs);
        try {
            page = await fetchPage(s, room, from, prefetched, run.signal);
        } catch (e) {
            // An aborted wait is not a room failure: no backoff for it.
            if (run.signal?.aborted) return false;
            crawlFailed(room.roomId, e);
            continue;
        }
        retryAfter.delete(room.roomId);
        if (!page) return false;
        // Same end-of-history rule as fetchRoomMediaPage: tuwunel can hand
        // back an empty chunk mid-history, so only the token decides.
        const end = page.end;
        const finished = end === null || end === from;
        const low = finished ? 0 : Math.min(page.minTs ?? up, up);
        await addCoverage(room.roomId, [low, up]);
        run.onPage?.(room, "history", low);
        const next: CrawlState = {
            roomId: room.roomId,
            from: end,
            done: finished,
            upTs: low,
        };
        const tx = db.transaction(CRAWL, "readwrite");
        tx.objectStore(CRAWL).put(next);
        await done(tx);
        return prefetched ? "prefetch" : "server";
    }
    return held ? "held" : false;
}

/** One crawler page for the running session, ignoring the pacing gates.
 *  Exported for tests. */
export async function crawlOnceForTests(): Promise<boolean> {
    if (!session) return false;
    return (await crawlStep(session, true)) !== false;
}

// ── Prefetch plan ──────────────────────────────────────────────────────────

/** Serialises plan pushes, so native never sees an older plan land last. */
let planChain: Promise<void> = Promise.resolve();
let prefetchTimer: ReturnType<typeof setTimeout> | null = null;

/** Hand native the unfinished rooms and their next tokens. Never throws. */
function pushPrefetchPlan(s: Session): Promise<void> {
    planChain = planChain.then(() => sendPrefetchPlan(s)).catch(() => {});
    return planChain;
}

async function sendPrefetchPlan(s: Session): Promise<void> {
    if (!historyPrefetchAvailable() || s.stopped) return;
    try {
        const accessToken = s.client.getAccessToken();
        if (!accessToken) return;
        const db = await s.db;
        const rows = (await req(
            db.transaction(CRAWL).objectStore(CRAWL).getAll(),
        )) as CrawlState[];
        const byRoom = new Map(rows.map((r) => [r.roomId, r]));
        const crawlRows: PrefetchCrawlRow[] = crawlCandidates(s.client).map(
            (room) => {
                const st = byRoom.get(room.roomId);
                return {
                    roomId: room.roomId,
                    from: st?.from ?? null,
                    done: st?.done ?? false,
                };
            },
        );
        const plan: PrefetchPlanInput = {
            accountKey: s.dbName,
            baseUrl: s.client.baseUrl,
            accessToken,
            filter: JSON.stringify(
                mediaFilterDefinition(true, CRAWL_PAGE_SIZE),
            ),
            pageSize: CRAWL_PAGE_SIZE,
            rooms: buildPrefetchRooms(crawlRows),
        };
        if (s.stopped) return;
        await setPrefetchPlan(plan);
    } catch (e) {
        console.warn("[eventIndex] prefetch plan failed", e);
    }
}

/** Push the plan at most once per interval; the push reads the rows when it
 *  runs, so it always carries the latest tokens. */
function schedulePrefetchPlan(s: Session): void {
    if (prefetchTimer) return;
    prefetchTimer = setTimeout(() => {
        prefetchTimer = null;
        void pushPrefetchPlan(s);
    }, PREFETCH_PLAN_THROTTLE_MS);
}

/** Push the plan now when the app goes to the background: native takes over there. */
function onVisibilityChange(): void {
    const s = session;
    if (s && !s.stopped && document.hidden) void pushPrefetchPlan(s);
}

// ── Full build lock ────────────────────────────────────────────────────────

/** The background crawler's step in flight, so a full build can wait for it. */
let crawlerStep: Promise<CrawlStepResult> | null = null;
/** True while buildFullIndex runs. The background crawler then skips its steps,
 *  so the two never write the same room's crawl state at once. */
let fullBuildRunning = false;
/** Aborts the running full build (stopEventIndex calls it). */
let fullBuildAbort: AbortController | null = null;
/** Messages newly queued into the index (crawled pages, and late decryptions
 *  and live messages through liveEvent), for the full build's counter. */
let queuedMessages = 0;
/** Settles once the previous full build has fully stopped. A new build waits
 *  for it, so a cancelled run's wind-down never overlaps the new run. */
let fullBuildSettled: Promise<void> = Promise.resolve();

/** Resolves after `ms`, or as soon as `signal` aborts. */
function waitOrAbort(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
        if (signal.aborted) return resolve();
        const finish = () => {
            clearTimeout(timer);
            signal.removeEventListener("abort", finish);
            resolve();
        };
        const timer = setTimeout(finish, ms);
        signal.addEventListener("abort", finish, { once: true });
    });
}

/** Rooms done (CRAWL row finished) out of the candidates now. */
async function roomStatus(
    s: Session,
): Promise<{ roomsDone: number; roomsTotal: number }> {
    const db = await s.db;
    const rows = (await req(
        db.transaction(CRAWL).objectStore(CRAWL).getAll(),
    )) as CrawlState[];
    const finished = new Set(rows.filter((r) => r.done).map((r) => r.roomId));
    const rooms = crawlCandidates(s.client);
    return {
        roomsDone: rooms.filter((r) => finished.has(r.roomId)).length,
        roomsTotal: rooms.length,
    };
}

/**
 * Index the whole history of every joined encrypted room in one run: the
 * crawler's steps back to back, a short pause between pages. It ignores the
 * backfill hold and the hidden page, pauses while sync is stale, and stops
 * when storage is tight. Resolves when every room is done (complete), when
 * some rooms are still failing or backing off (partial), or when stopped.
 * Only one build runs at a time: a call made while a previous run is still
 * winding down (after a cancel) waits for it to stop first. The background
 * crawler stays idle while a build runs.
 */
export async function buildFullIndex(opts: {
    signal: AbortSignal;
    onProgress: (p: FullIndexProgress) => void;
}): Promise<FullIndexResult> {
    const prior = fullBuildSettled;
    let release!: () => void;
    fullBuildSettled = new Promise<void>((resolve) => (release = resolve));
    try {
        await prior;
        return await runFullBuild(opts);
    } finally {
        release();
    }
}

async function runFullBuild(opts: {
    signal: AbortSignal;
    onProgress: (p: FullIndexProgress) => void;
}): Promise<FullIndexResult> {
    const s = session;
    const progress: FullIndexProgress = {
        roomsDone: 0,
        roomsTotal: 0,
        pages: 0,
        messagesIndexed: 0,
        waitingForSync: false,
    };
    if (!s || s.stopped) {
        return { reason: "unavailable", progress, failedRooms: 0 };
    }

    const abort = new AbortController();
    const forward = () => abort.abort();
    if (opts.signal.aborted) abort.abort();
    else opts.signal.addEventListener("abort", forward, { once: true });
    fullBuildAbort = abort;
    fullBuildRunning = true;

    const startMessages = queuedMessages;
    const emit = () => {
        progress.messagesIndexed = queuedMessages - startMessages;
        progress.roomsRetrying = s.stopped
            ? 0
            : crawlCandidates(s.client).filter((r) => backingOff(r.roomId))
                  .length;
        opts.onProgress({ ...progress });
    };
    // The crawl reports the room before its request goes out, so a hang shows
    // which room it is stuck on, and after each page how far back it got.
    const run: CrawlRun = {
        signal: abort.signal,
        onRoom: (room, pass, reachedTs) => {
            progress.currentRoomId = room.roomId;
            progress.currentRoomName = room.name || undefined;
            progress.currentPass = pass;
            progress.currentReachedTs = reachedTs;
            emit();
        },
        onPage: (room, pass, reachedTs) => {
            if (progress.currentRoomId !== room.roomId) return;
            progress.currentPass = pass;
            // 0 is "reached the start of the room".
            progress.currentReachedTs = reachedTs;
        },
    };
    let reason: FullIndexReason = "complete";
    let failedRooms = 0;
    let errors = 0;
    try {
        const first = await roomStatus(s);
        progress.roomsDone = first.roomsDone;
        progress.roomsTotal = first.roomsTotal;
        emit();
        for (;;) {
            if (abort.signal.aborted || s.stopped) {
                reason = "aborted";
                break;
            }
            // A background step that started before the lock was taken.
            while (crawlerStep) await crawlerStep.catch(() => {});
            if (await storageTight()) {
                reason = "storage";
                break;
            }
            const stale = isSyncStale();
            if (stale !== progress.waitingForSync) {
                progress.waitingForSync = stale;
                emit();
            }
            if (stale) {
                await waitOrAbort(FULL_BUILD_STALL_MS, abort.signal);
                continue;
            }
            let more: boolean;
            try {
                more = (await crawlStep(s, true, run)) !== false;
                errors = 0;
            } catch (e) {
                errors += 1;
                console.warn("[eventIndex] full build step failed", e);
                if (errors >= FULL_BUILD_MAX_ERRORS) {
                    reason = "unavailable";
                    break;
                }
                await waitOrAbort(FULL_BUILD_STALL_MS, abort.signal);
                continue;
            }
            if (abort.signal.aborted || s.stopped) {
                reason = "aborted";
                break;
            }
            const status = await roomStatus(s);
            progress.roomsDone = status.roomsDone;
            progress.roomsTotal = status.roomsTotal;
            if (more) {
                progress.pages += 1;
                emit();
                await waitOrAbort(FULL_BUILD_STEP_DELAY_MS, abort.signal);
                continue;
            }
            // No room took a page: all done, or the rest are backing off.
            emit();
            failedRooms = unfinishedRoomCount(
                status.roomsDone,
                status.roomsTotal,
            );
            reason = failedRooms === 0 ? "complete" : "partial";
            break;
        }
    } catch (e) {
        console.warn("[eventIndex] full build failed", e);
        reason = "unavailable";
    } finally {
        opts.signal.removeEventListener("abort", forward);
        if (fullBuildAbort === abort) fullBuildAbort = null;
        fullBuildRunning = false;
    }
    // The build may have moved many tokens: let native pick them up.
    await pushPrefetchPlan(s);
    emit();
    return { reason, progress: { ...progress }, failedRooms };
}

async function runCrawler(s: Session): Promise<void> {
    await serialWrite(() => migrateLegacyIndex(s));
    await serialWrite(() => scrubPriorRedactions(s));
    void runPendingRetries().catch((e) =>
        console.warn("[eventIndex] retry failed", e),
    );
    await seedCoverage(s).catch((e) =>
        console.warn("[eventIndex] coverage seed failed", e),
    );
    void pushPrefetchPlan(s);
    while (!s.stopped) {
        let delay = CRAWL_PAGE_DELAY_MS;
        try {
            const gated =
                document.hidden || isSyncStale() || (await storageTight());
            // Checked after the last await, so a full build that started during
            // it is seen here. The step below is then recorded in crawlerStep
            // before anything else runs, and the build waits for it.
            if (gated || fullBuildRunning) {
                delay = CRAWL_PAUSED_MS;
            } else {
                // The backfill hold stops server requests only; prefetched
                // pages are still taken while it runs.
                const serverAllowed = Date.now() >= backfillHeldUntil;
                const step = crawlStep(s, serverAllowed);
                crawlerStep = step;
                let source: CrawlStepResult;
                try {
                    source = await step;
                } finally {
                    if (crawlerStep === step) crawlerStep = null;
                }
                if (source === false) delay = CRAWL_IDLE_MS;
                else if (source === "held") delay = CRAWL_PAUSED_MS;
                else if (source === "prefetch")
                    delay = CRAWL_PREFETCH_STEP_DELAY_MS;
                if (source === "server" || source === "prefetch")
                    schedulePrefetchPlan(s);
            }
        } catch (e) {
            console.warn("[eventIndex] crawl page failed", e);
            delay = CRAWL_PAUSED_MS;
        }
        await wait(delay);
    }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

/** Start indexing for the current client. Returns the stop function. */
export function startEventIndex(): () => void {
    const client = matrixClient;
    const userId = client?.getUserId();
    const deviceId = client?.getDeviceId();
    if (!client || !userId || !deviceId || !idbFactory()) return () => {};
    stopEventIndex();
    const onTimeline = (ev: MatrixEvent, room: Room | undefined) => {
        if (ev.getType() === EventType.RoomRedaction) liveRedaction(ev, room);
        else liveEvent(ev, room);
    };
    const onDecrypted = (ev: MatrixEvent) =>
        liveEvent(ev, client.getRoom(ev.getRoomId() ?? ""));
    client.on(RoomEvent.Timeline, onTimeline as never);
    client.on(MatrixEventEvent.Decrypted, onDecrypted as never);
    const detachSync = attachIndexSync(client);
    const s: Session = {
        client,
        dbName: eventIndexDbName(userId, deviceId),
        // The block codec must be ready before any block is read or written.
        db: openDb(eventIndexDbName(userId, deviceId)).then(async (db) => {
            await initPpmd();
            return db;
        }),
        stopped: false,
        rooms: new Map(),
        detach: () => {
            detachSync();
            client.off(RoomEvent.Timeline, onTimeline as never);
            client.off(MatrixEventEvent.Decrypted, onDecrypted as never);
        },
    };
    s.db.catch((e) => {
        console.warn("[eventIndex] unavailable", e);
        stopEventIndex();
    });
    session = s;
    tickTimer = setInterval(liveTick, LIVE_TICK_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    void runCrawler(s);
    return stopEventIndex;
}

export function stopEventIndex(): void {
    fullBuildAbort?.abort();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (prefetchTimer) clearTimeout(prefetchTimer);
    prefetchTimer = null;
    const s = session;
    if (!s) return;
    s.stopped = true;
    s.detach();
    session = null;
    pending.clear();
    seen.clear();
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = null;
    gapChecked.clear();
    liveEdge.clear();
    retryAfter.clear();
    wasStale = false;
    void s.db.then((db) => db.close()).catch(() => {});
}

/** Delete an account's index (sign-out, account removal, setting off). The
 *  native background download for it goes too. */
export async function deleteEventIndex(
    userId: string,
    deviceId: string,
): Promise<void> {
    const name = eventIndexDbName(userId, deviceId);
    await clearPrefetch(name);
    if (session?.dbName === name) {
        const s = session;
        stopEventIndex();
        await s.db.then((db) => db.close()).catch(() => {});
    }
    const factory = idbFactory();
    if (factory) await deleteDatabaseWithOutcome(factory, name, 5_000);
}

// ── Reads ──────────────────────────────────────────────────────────────────

/** Whether the index is running and can answer for encrypted rooms. */
export function isEventIndexActive(): boolean {
    return session !== null && !session.stopped;
}

/** The Android background download's status for the running account (debug
 *  panel). Null when the index is not running or the download is unavailable. */
export async function eventIndexPrefetchStatus(): Promise<PrefetchStatus | null> {
    const s = session;
    if (!s || s.stopped) return null;
    return prefetchStatus(s.dbName);
}

async function redactedIds(
    db: IDBDatabase,
    roomId: string,
): Promise<Set<string>> {
    const rows = (await req(
        db
            .transaction(REDACTED)
            .objectStore(REDACTED)
            .index("room")
            .getAll(roomId),
    )) as { eventId: string }[];
    return new Set(rows.map((r) => r.eventId));
}

/** A search hit as a MatrixEvent, for the same rendering as server results.
 *  Its event id is a placeholder: jumpTo resolves it (resolveIndexedEventId). */
function entryEvent(roomId: string, entry: CompactEntry): MatrixEvent {
    const content: Record<string, unknown> = {
        msgtype: entry.m,
        body: entry.b,
    };
    if (entry.v) content["org.matrix.msc3245.voice"] = {};
    return new MatrixEvent({
        event_id: indexPlaceholderId(entry.h, entry.t),
        room_id: roomId,
        sender: entry.s,
        origin_server_ts: entry.t,
        type: "m.room.message",
        content,
    });
}

export interface LocalSearchResult {
    events: MatrixEvent[];
    /** Whether the crawler has reached the start of this room's history. */
    complete: boolean;
}

/**
 * Search one room's index, newest first. `onPartial` gets the matches from
 * the newest blocks first, so recent hits show while older blocks decompress.
 */
export async function searchLocalIndex(
    roomId: string,
    parsed: ParsedSearchQuery,
    onPartial?: (events: MatrixEvent[]) => void,
): Promise<LocalSearchResult> {
    const s = session;
    if (!s) return { events: [], complete: false };
    const toEvents = (entries: CompactEntry[]) =>
        entries.map((e) => entryEvent(roomId, e));
    const db = await s.db;
    // Write what's queued first, so a message that just arrived is findable.
    await flush();
    const tx = db.transaction([BLOCKS, TAILS, CRAWL, REDACTED]);
    const [blocks, tail, crawl, redactedRows] = await Promise.all([
        req(tx.objectStore(BLOCKS).index("room").getAll(roomId)) as Promise<
            StoredBlock[]
        >,
        req(tx.objectStore(TAILS).get(roomId)) as Promise<
            StoredTail | undefined
        >,
        req(tx.objectStore(CRAWL).get(roomId)) as Promise<
            CrawlState | undefined
        >,
        req(tx.objectStore(REDACTED).index("room").getAll(roomId)) as Promise<
            { eventId: string }[]
        >,
    ]);
    const redacted = redactionKeysOf(redactedRows);
    const all: CompactEntry[] = [...tailEntries(tail)];
    blocks.sort((a, b) => b.maxTs - a.maxTs);
    const PARTIAL_AFTER = 8;
    for (let i = 0; i < blocks.length; i++) {
        all.push(...(await blockEntries(blocks[i])));
        if (
            onPartial &&
            i === PARTIAL_AFTER - 1 &&
            blocks.length > PARTIAL_AFTER
        )
            onPartial(
                toEvents(searchEntries(resolveEntries(all, redacted), parsed)),
            );
    }
    return {
        events: toEvents(searchEntries(resolveEntries(all, redacted), parsed)),
        complete: !!crawl?.done,
    };
}

/** A room's indexed attachments, newest first. `resumeFrom` is where the
 *  crawler stopped: paging the server from there covers only what the index
 *  doesn't have yet. */
export async function getIndexedMedia(roomId: string): Promise<{
    items: RoomMediaItem[];
    complete: boolean;
    resumeFrom: string | null;
}> {
    const s = session;
    if (!s) return { items: [], complete: false, resumeFrom: null };
    const db = await s.db;
    await flush();
    const tx = db.transaction([MEDIA, CRAWL]);
    const range = IDBKeyRange.bound([roomId, -Infinity], [roomId, Infinity]);
    const [rows, crawl] = await Promise.all([
        req(tx.objectStore(MEDIA).index("room_ts").getAll(range)) as Promise<
            StoredMedia[]
        >,
        req(tx.objectStore(CRAWL).get(roomId)) as Promise<
            CrawlState | undefined
        >,
    ]);
    const redacted = await redactedIds(db, roomId);
    const items = rows
        .filter((r) => !redacted.has(r.eventId))
        .reverse()
        // Rows are oldest first; a gallery's items keep their own order
        // within the newest-first list, as fetchRoomMediaPage gives them.
        .flatMap((row): RoomMediaItem[] => {
            if (row.gallery) return row.gallery;
            const { roomId: _r, gallery: _g, ...item } = row;
            return [item as RoomMediaItem];
        });
    return {
        items,
        complete: !!crawl?.done,
        resumeFrom: crawl?.done ? null : (crawl?.from ?? null),
    };
}

// ── Peer sync ──────────────────────────────────────────────────────────────

/** Per joined encrypted room, the time ranges this device lacks. */
export async function getMissingRanges(): Promise<
    { roomId: string; missing: Range[] }[]
> {
    const out: { roomId: string; missing: Range[] }[] = [];
    // The newest minutes are the live feed's, not a hole.
    const now = Date.now() - GAP_MIN_MS;
    for (const roomId of indexedRoomIds()) {
        const missing = subtractRanges([0, now], await getCoverage(roomId));
        if (missing.length) out.push({ roomId, missing });
    }
    return out;
}

/** The (hash, timestamp) keys of tombstones. A tombstone without a timestamp
 *  has no key: it removes nothing by hash. */
function redactionKeysOf(
    rows: { eventId: string; ts?: number }[],
): Set<string> {
    const keys = new Set<string>();
    for (const r of rows) {
        if (r.ts !== undefined) {
            keys.add(redactionKeyOf(eventIdHash(r.eventId), r.ts));
        }
    }
    return keys;
}

/** A room's tombstones as (hash, timestamp) keys (the full ids are kept in REDACTED). */
async function redactionKeys(
    db: IDBDatabase,
    roomId: string,
): Promise<Set<string>> {
    const rows = (await req(
        db
            .transaction(REDACTED)
            .objectStore(REDACTED)
            .index("room")
            .getAll(roomId),
    )) as { eventId: string; ts?: number }[];
    return redactionKeysOf(rows);
}

/** Decoded entries of a room's blocks that overlap `ranges`, plus its tail. */
async function roomEntriesIn(
    db: IDBDatabase,
    roomId: string,
    ranges: Range[],
): Promise<CompactEntry[]> {
    const tx = db.transaction([BLOCKS, TAILS]);
    const [blocks, tail] = await Promise.all([
        req(tx.objectStore(BLOCKS).index("room").getAll(roomId)) as Promise<
            StoredBlock[]
        >,
        req(tx.objectStore(TAILS).get(roomId)) as Promise<
            StoredTail | undefined
        >,
    ]);
    const all: CompactEntry[] = [...tailEntries(tail)];
    for (const b of blocks) {
        if (ranges.some(([lo, hi]) => b.minTs <= hi && b.maxTs >= lo))
            all.push(...(await blockEntries(b)));
    }
    for (const e of pending.get(roomId)?.entries ?? []) all.push(e);
    return entriesInRange(all, ranges);
}

/** What this device can give a peer for `ranges`: the entries it holds in the
 *  parts of them it has covered, minus what it knows was redacted. */
export async function readEntriesInRanges(
    roomId: string,
    ranges: Range[],
): Promise<CompactEntry[]> {
    const s = session;
    if (!s) return [];
    const db = await s.db;
    await flush();
    const [entries, redacted] = await Promise.all([
        roomEntriesIn(db, roomId, ranges),
        redactionKeys(db, roomId),
    ]);
    return dropRedactedEntries(entries, redacted);
}

/** Merge entries a peer sent for `range` (a full answer: the whole range is
 *  now covered). Returns how many were new. */
export async function importPeerEntries(
    roomId: string,
    range: Range,
    entries: CompactEntry[],
): Promise<number> {
    const s = session;
    if (!s) return 0;
    const db = await s.db;
    await flush();
    const known = (await chained(() => roomCache(s, db, roomId))).keys;
    const fresh = dedupeEntries(entries, known);
    if (fresh.length) {
        bucket(roomId).entries.push(...fresh);
        await flush();
    }
    await addCoverage(roomId, range);
    // A range from the start of the room settles the crawl, unless this
    // device's own crawl is further up than the range reaches: marking it
    // done would leave what lies between uncovered.
    if (range[0] === 0) {
        const state = await crawlState(db, roomId);
        const reaches = state?.upTs === undefined || range[1] >= state.upTs - 1;
        if (!state?.done && reaches) {
            const tx = db.transaction(CRAWL, "readwrite");
            tx.objectStore(CRAWL).put({
                ...state,
                roomId,
                from: state?.from ?? null,
                done: true,
            } satisfies CrawlState);
            await done(tx);
        }
    }
    return fresh.length;
}

/** The real event id behind a search hit's placeholder, found through the
 *  server: the event at the hit's timestamp, or one near it with a matching
 *  hash. The forward lookup is tried first, then the backward one. The
 *  forward lookup's event is the fallback when neither confirms the hash.
 *  Null when the server can't say at all. */
export async function resolveIndexedEventId(
    roomId: string,
    placeholderId: string,
): Promise<string | null> {
    const parsed = parseIndexPlaceholderId(placeholderId);
    if (!parsed) return null;
    let fallback: string | null = null;
    try {
        for (const dir of [Direction.Forward, Direction.Backward]) {
            const anchor = await timestampToEventAnchor(roomId, parsed.t, dir);
            if (!anchor) continue;
            if (!fallback) fallback = anchor.eventId;
            const context =
                anchor.ts === parsed.t &&
                eventIdHash(anchor.eventId) === parsed.h
                    ? []
                    : await contextEventStamps(
                          roomId,
                          anchor.eventId,
                          RESOLVE_CONTEXT_EVENTS,
                      );
            const id = pickResolvedEventId(parsed.h, parsed.t, anchor, context);
            if (id) return id;
        }
    } catch (e) {
        console.warn("[eventIndex] could not resolve a search hit", e);
    }
    return fallback;
}
