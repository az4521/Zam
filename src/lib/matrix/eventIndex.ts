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
    mediaItemFromEvent,
    type RoomMediaItem,
} from "$lib/utils/roomMedia";
import type { ParsedSearchQuery } from "$lib/utils/messageSearch";

const DB_VERSION = 2;
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
const CRAWL_DECRYPT_BATCH = 4;
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
type StoredMedia = RoomMediaItem & { roomId: string };

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
    const media = mediaItemFromEvent(ev);
    if (media) b.media.push({ ...media, roomId });
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

/** Fetch, decrypt and queue one backwards page. `minTs` is the oldest event
 *  on it (indexable or not), null when the page is empty. */
async function fetchPage(
    s: Session,
    room: Room,
    from: string | null,
): Promise<{ end: string | null; minTs: number | null } | null> {
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
    const events = (res.chunk ?? []).map((raw) => new MatrixEvent(raw));
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
    for (const e of events) {
        minTs = Math.min(minTs ?? Infinity, e.getTs());
        const eventId = e.getId();
        const sender = e.getSender();
        if (!eventId || !sender || e.isDecryptionFailure()) continue;
        queueEvent(room.roomId, {
            eventId,
            sender,
            ts: e.getTs(),
            type: e.getType(),
            content: e.getContent(),
            redacted: e.isRedacted(),
        });
    }
    await flush();
    return { end: res.end ?? null, minTs };
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
        const page = await fetchPage(s, room, walk.from);
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

/** Index one page of some room's history. False when every room is done. */
async function crawlStep(s: Session): Promise<boolean> {
    const db = await s.db;
    if (await gapStep(s, db)) return true;
    for (const room of crawlCandidates(s.client)) {
        const state = await crawlState(db, room.roomId);
        if (state?.done) continue;
        const from = state?.from ?? null;
        const up = state?.upTs ?? Date.now();
        const page = await fetchPage(s, room, from);
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
        return true;
    }
    return false;
}

/** One crawler page for the running session, ignoring the pacing gates.
 *  Exported for tests. */
export function crawlOnceForTests(): Promise<boolean> {
    return session ? crawlStep(session) : Promise.resolve(false);
}

async function runCrawler(s: Session): Promise<void> {
    await seedCoverage(s).catch((e) =>
        console.warn("[eventIndex] coverage seed failed", e),
    );
    while (!s.stopped) {
        let delay = CRAWL_PAGE_DELAY_MS;
        try {
            if (
                document.hidden ||
                isSyncStale() ||
                Date.now() < backfillHeldUntil ||
                (await storageTight())
            ) {
                delay = CRAWL_PAUSED_MS;
            } else if (!(await crawlStep(s))) {
                delay = CRAWL_IDLE_MS;
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
    void runCrawler(s);
    return stopEventIndex;
}

export function stopEventIndex(): void {
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
    wasStale = false;
    void s.db.then((db) => db.close()).catch(() => {});
}

/** Delete an account's index (sign-out, account removal, setting off). */
export async function deleteEventIndex(
    userId: string,
    deviceId: string,
): Promise<void> {
    const name = eventIndexDbName(userId, deviceId);
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
        .map(({ roomId: _r, ...item }) => item as RoomMediaItem);
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
