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
import { isSyncStale } from "./client";
import { attachIndexSync } from "./eventIndexSync";
import {
    addRange,
    entriesInRange,
    subtractRanges,
    type Range,
} from "$lib/utils/eventIndexSync";
import {
    BLOCK_SIZE,
    decodeBlock,
    encodeBlock,
    entryFromEvent,
    resolveEntries,
    searchEntries,
    type EncodedBlock,
    type IndexEntry,
} from "$lib/utils/eventIndex";
import {
    mediaFilterDefinition,
    mediaItemsFromEvent,
    type RoomMediaItem,
} from "$lib/utils/roomMedia";
import type { ParsedSearchQuery } from "$lib/utils/messageSearch";
import {
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

const DB_VERSION = 3;
const BLOCKS = "blocks";
const TAILS = "tails";
const MEDIA = "media";
const CRAWL = "crawl";
const REDACTED = "redacted";
const COVERAGE = "coverage";

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
/** Full build: pause between pages, and between checks while sync is stale. */
const FULL_BUILD_STEP_DELAY_MS = 150;
const FULL_BUILD_STALL_MS = 5_000;
/** Full build gives up after this many failed steps in a row. */
const FULL_BUILD_MAX_ERRORS = 3;
/** Stop crawling past this much origin storage, or half the quota. */
const STORAGE_CAP_BYTES = 1024 * 1024 * 1024;

interface StoredBlock extends EncodedBlock {
    id?: number;
    roomId: string;
    count: number;
    minTs: number;
    maxTs: number;
}
interface StoredTail {
    roomId: string;
    entries: IndexEntry[];
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
    detach: () => void;
}

let session: Session | null = null;
// Every write goes through this chain, so a tail is never read and rewritten
// by two writers at once.
let writeChain: Promise<void> = Promise.resolve();
const pending = new Map<
    string,
    { entries: IndexEntry[]; media: StoredMedia[]; redacted: string[] }
>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;
const LIVE_TICK_MS = 30_000;
// Ids already queued this session: a message is both added to the timeline
// and then decrypted, and both fire.
const seen = new Set<string>();

function bucket(roomId: string) {
    let b = pending.get(roomId);
    if (!b) {
        b = { entries: [], media: [], redacted: [] };
        pending.set(roomId, b);
    }
    return b;
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
): boolean {
    if (seen.has(ev.eventId)) return false;
    const entry = entryFromEvent(ev);
    if (!entry) return false;
    seen.add(ev.eventId);
    if (seen.size > 20_000) seen.clear();
    const b = bucket(roomId);
    b.entries.push(entry);
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
            for (const [roomId, b] of batch) await writeRoom(db, roomId, b);
        })
        .catch((e) => {
            reportStorageError(e, { fromIndexedDB: true });
            console.warn("[eventIndex] write failed", e);
        });
    return writeChain;
}

async function writeRoom(
    db: IDBDatabase,
    roomId: string,
    b: { entries: IndexEntry[]; media: StoredMedia[]; redacted: string[] },
): Promise<void> {
    const read = db.transaction(TAILS, "readonly");
    const tail = ((await req(read.objectStore(TAILS).get(roomId))) as
        StoredTail | undefined) ?? { roomId, entries: [] };
    let entries = [...tail.entries, ...b.entries];
    // Compress outside the transaction: an IndexedDB transaction closes as
    // soon as it waits on anything that isn't IndexedDB.
    const blocks: StoredBlock[] = [];
    while (entries.length >= BLOCK_SIZE) {
        const chunk = entries.slice(0, BLOCK_SIZE);
        entries = entries.slice(BLOCK_SIZE);
        const ts = chunk.map((e) => e.t);
        blocks.push({
            ...(await encodeBlock(chunk)),
            roomId,
            count: chunk.length,
            minTs: Math.min(...ts),
            maxTs: Math.max(...ts),
        });
    }
    const tx = db.transaction([TAILS, BLOCKS, MEDIA, REDACTED], "readwrite");
    tx.objectStore(TAILS).put({ roomId, entries } satisfies StoredTail);
    for (const block of blocks) tx.objectStore(BLOCKS).add(block);
    for (const m of b.media) tx.objectStore(MEDIA).put(m);
    for (const eventId of b.redacted) {
        tx.objectStore(REDACTED).put({ eventId, roomId });
        tx.objectStore(MEDIA).delete(eventId);
    }
    await done(tx);
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

function liveRedaction(ev: MatrixEvent, room: Room): void {
    if (!isRoomEncrypted(room)) return;
    const target =
        (ev.event as { redacts?: string }).redacts ??
        (ev.getContent().redacts as string | undefined);
    if (!target) return;
    bucket(room.roomId).redacted.push(target);
    scheduleFlush();
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

/** Fetch, decrypt and queue one backwards page. `minTs` is the oldest event
 *  on it (indexable or not), null when the page is empty. A `prefetched` page
 *  (taken from native, same token, filter and page size) replaces the request. */
async function fetchPage(
    s: Session,
    room: Room,
    from: string | null,
    prefetched: TakenPrefetchPage | null = null,
): Promise<{ end: string | null; minTs: number | null } | null> {
    lastCrawledRoomId = room.roomId;
    let chunk: RawPageChunk;
    let end: string | null;
    if (prefetched) {
        chunk = prefetched.chunk as RawPageChunk;
        end = prefetched.end;
    } else {
        const filter = new Filter(s.client.getUserId());
        filter.setDefinition(mediaFilterDefinition(true, CRAWL_PAGE_SIZE));
        const res = await s.client.createMessagesRequest(
            room.roomId,
            from,
            CRAWL_PAGE_SIZE,
            Direction.Backward,
            filter,
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
        if (s.stopped) return null;
        await Promise.all(
            encrypted
                .slice(i, i + CRAWL_DECRYPT_BATCH)
                .map((e) => s.client.decryptEventIfNeeded(e).catch(() => {})),
        );
    }
    let minTs: number | null = null;
    let maxTs: number | null = null;
    for (const e of events) {
        minTs = Math.min(minTs ?? Infinity, e.getTs());
        maxTs = Math.max(maxTs ?? -Infinity, e.getTs());
    }
    // A re-walk (v3 repair, gap walk) meets messages already stored; skipping
    // them stops a message being stored twice.
    const known = new Set<string>();
    if (minTs !== null && maxTs !== null) {
        await flush();
        if (s.stopped) return null;
        const db = await s.db;
        for (const e of await roomEntriesIn(db, room.roomId, [[minTs, maxTs]]))
            known.add(e.e);
        if (s.stopped) return null;
    }
    for (const e of events) {
        const eventId = e.getId();
        const sender = e.getSender();
        if (!eventId || !sender || e.isDecryptionFailure()) continue;
        if (known.has(eventId)) continue;
        if (
            queueEvent(room.roomId, {
                eventId,
                sender,
                ts: e.getTs(),
                type: e.getType(),
                content: e.getContent(),
                redacted: e.isRedacted(),
            })
        )
            crawledMessages += 1;
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
async function gapStep(s: Session, db: IDBDatabase): Promise<boolean> {
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
        try {
            page = await fetchPage(s, room, walk.from);
        } catch (e) {
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
): Promise<CrawlStepResult> {
    const db = await s.db;
    if (serverAllowed && (await gapStep(s, db))) return "server";
    let held = false;
    for (const room of crawlCandidates(s.client)) {
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
        try {
            page = await fetchPage(s, room, from, prefetched);
        } catch (e) {
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
/** Messages newly queued by crawled pages, for the full build's counter. */
let crawledMessages = 0;
/** The room the most recent crawled page was for. */
let lastCrawledRoomId: string | undefined;

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
 * Only one build runs at a time, and the background crawler stays idle while
 * it runs.
 */
export async function buildFullIndex(opts: {
    signal: AbortSignal;
    onProgress: (p: FullIndexProgress) => void;
}): Promise<FullIndexResult> {
    const s = session;
    const progress: FullIndexProgress = {
        roomsDone: 0,
        roomsTotal: 0,
        pages: 0,
        messagesIndexed: 0,
    };
    if (!s || s.stopped) {
        return { reason: "unavailable", progress, failedRooms: 0 };
    }
    if (fullBuildRunning) throw new Error("full index build already running");

    const abort = new AbortController();
    const forward = () => abort.abort();
    if (opts.signal.aborted) abort.abort();
    else opts.signal.addEventListener("abort", forward, { once: true });
    fullBuildAbort = abort;
    fullBuildRunning = true;

    const startMessages = crawledMessages;
    const emit = () => {
        progress.messagesIndexed = crawledMessages - startMessages;
        opts.onProgress({ ...progress });
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
            if (isSyncStale()) {
                await waitOrAbort(FULL_BUILD_STALL_MS, abort.signal);
                continue;
            }
            let more: boolean;
            try {
                more = (await crawlStep(s, true)) !== false;
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
                progress.currentRoomId = lastCrawledRoomId;
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
    const onTimeline = (ev: MatrixEvent, room: Room | undefined) =>
        liveEvent(ev, room);
    const onDecrypted = (ev: MatrixEvent) =>
        liveEvent(ev, client.getRoom(ev.getRoomId() ?? ""));
    const onRedaction = (ev: MatrixEvent, room: Room) =>
        liveRedaction(ev, room);
    client.on(RoomEvent.Timeline, onTimeline as never);
    client.on(MatrixEventEvent.Decrypted, onDecrypted as never);
    client.on(RoomEvent.Redaction, onRedaction as never);
    const detachSync = attachIndexSync(client);
    const s: Session = {
        client,
        dbName: eventIndexDbName(userId, deviceId),
        db: openDb(eventIndexDbName(userId, deviceId)),
        stopped: false,
        detach: () => {
            detachSync();
            client.off(RoomEvent.Timeline, onTimeline as never);
            client.off(MatrixEventEvent.Decrypted, onDecrypted as never);
            client.off(RoomEvent.Redaction, onRedaction as never);
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

/** A search hit as a MatrixEvent, for the same rendering as server results. */
function entryEvent(roomId: string, entry: IndexEntry): MatrixEvent {
    const content: Record<string, unknown> = {
        msgtype: entry.m,
        body: entry.b,
    };
    if (entry.v) content["org.matrix.msc3245.voice"] = {};
    return new MatrixEvent({
        event_id: entry.e,
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
    const toEvents = (entries: IndexEntry[]) =>
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
    const redacted = new Set(redactedRows.map((r) => r.eventId));
    const all: IndexEntry[] = [...(tail?.entries ?? [])];
    blocks.sort((a, b) => b.maxTs - a.maxTs);
    const PARTIAL_AFTER = 8;
    for (let i = 0; i < blocks.length; i++) {
        all.push(...(await decodeBlock(blocks[i])));
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

/** Decoded entries of a room's blocks that overlap `ranges`, plus its tail. */
async function roomEntriesIn(
    db: IDBDatabase,
    roomId: string,
    ranges: Range[],
): Promise<IndexEntry[]> {
    const tx = db.transaction([BLOCKS, TAILS]);
    const [blocks, tail] = await Promise.all([
        req(tx.objectStore(BLOCKS).index("room").getAll(roomId)) as Promise<
            StoredBlock[]
        >,
        req(tx.objectStore(TAILS).get(roomId)) as Promise<
            StoredTail | undefined
        >,
    ]);
    const all: IndexEntry[] = [...(tail?.entries ?? [])];
    for (const b of blocks) {
        if (ranges.some(([lo, hi]) => b.minTs <= hi && b.maxTs >= lo))
            all.push(...(await decodeBlock(b)));
    }
    for (const e of pending.get(roomId)?.entries ?? []) all.push(e);
    return entriesInRange(all, ranges);
}

/** What this device can give a peer for `ranges`: the entries it holds in the
 *  parts of them it has covered, minus what it knows was redacted. */
export async function readEntriesInRanges(
    roomId: string,
    ranges: Range[],
): Promise<IndexEntry[]> {
    const s = session;
    if (!s) return [];
    const db = await s.db;
    await flush();
    const [entries, redacted] = await Promise.all([
        roomEntriesIn(db, roomId, ranges),
        redactedIds(db, roomId),
    ]);
    return entries.filter(
        (e) => !redacted.has(e.e) && !(e.o && redacted.has(e.o)),
    );
}

/** Merge entries a peer sent for `range` (a full answer: the whole range is
 *  now covered). Returns how many were new. */
export async function importPeerEntries(
    roomId: string,
    range: Range,
    entries: IndexEntry[],
): Promise<number> {
    const s = session;
    if (!s) return 0;
    const db = await s.db;
    await flush();
    const known = new Set(
        (await roomEntriesIn(db, roomId, [range])).map((e) => e.e),
    );
    const fresh: IndexEntry[] = [];
    for (const e of entries) {
        if (known.has(e.e)) continue;
        known.add(e.e);
        fresh.push(e);
    }
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
