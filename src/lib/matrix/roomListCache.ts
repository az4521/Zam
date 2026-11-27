// Persisted snapshot of the room list (spaces, rooms, DMs, space tree, tags,
// names, avatars, unread counts) so the sidebar paints instantly on boot while
// sync, classic or sliding, catches up.
//
// The snapshot is materialised into detached `Room` objects that are NEVER put
// in the SDK store: a room already in the store is "not brand new" to both sync
// implementations, which then skip its back-pagination token and its
// ClientEvent.Room emission. client.ts instead consults these rooms as a
// read-only fallback for the room-list helpers until the real list is complete.

import {
    EventType,
    MatrixEvent,
    NotificationCountType,
    PendingEventOrdering,
    Room,
    type IEvent,
    type MatrixClient,
} from "matrix-js-sdk";
import { reportStorageError } from "$lib/stores/storageHealth.svelte";
import type { SpaceChildInfo } from "./client";

const SNAPSHOT_VERSION = 1;

// Everything the sidebar, space tree and room headers read from room state.
const CACHED_STATE_TYPES = new Set<string>([
    "m.room.create",
    "m.room.name",
    "m.room.avatar",
    "m.room.canonical_alias",
    "m.room.topic",
    "m.room.encryption",
    "m.room.tombstone",
    "m.room.join_rules",
    "m.room.power_levels",
    "m.space.parent",
    "m.space.child",
]);

// Global account data the room list depends on. Never secrets (4S, cross-
// signing): those must not be copied out of the SDK's own storage.
export const CACHED_ACCOUNT_DATA_TYPES = [
    EventType.Direct as string,
    "im.client.space_layout",
    "im.client.space_order",
    "chat.commet.sidebar_ordering",
];

// A DM with more joined members than this is a group chat; don't cache its
// whole member list.
const MAX_CACHED_MEMBERS = 8;

// Recent timeline events kept per room so a boot with no network can show the
// conversation instead of an empty pane. Wire events only: encrypted rooms
// cache the ciphertext the SDK's own store already holds. Decryption is NOT
// part of materialising (there is no decrypt call there): client.ts decrypts
// the room about to be opened before publishing the cache, then the rest in
// the background. Until that pass reaches an event, the timeline renders a
// neutral "decrypting" row, never the missing-keys copy.
const MAX_CACHED_EVENTS = 40;

interface CachedHero {
    userId: string;
    displayName?: string;
    avatarUrl?: string;
}

interface CachedRoom {
    roomId: string;
    state: Partial<IEvent>[];
    accountData: Partial<IEvent>[];
    /** Newest-last slice of the live timeline (see MAX_CACHED_EVENTS). */
    timeline?: Partial<IEvent>[];
    heroes?: CachedHero[];
    joined?: number;
    invited?: number;
    total?: number;
    highlight?: number;
}

export interface RoomListSnapshot {
    v: number;
    savedAt: number;
    accountData: Partial<IEvent>[];
    rooms: CachedRoom[];
    /** Last /hierarchy result per space (client.ts owns the shape). */
    hierarchies?: Record<string, SpaceChildInfo[]>;
    /**
     * Event ids known to be redacted. Never written into the snapshot record
     * itself: it lives in its own record (see forgetRedactedInCache), so a later
     * snapshot save cannot bring a redacted event's plaintext back. loadSnapshot
     * fills it in.
     */
    redacted?: string[];
}

/**
 * The timeline tail with every event that must not be shown or decrypted
 * removed: the known-redacted ids, the targets of redactions the tail holds,
 * and redacted stubs (no content left to show).
 */
function prunedTimeline(
    timeline: readonly Partial<IEvent>[] | undefined,
    known: ReadonlySet<string>,
): Partial<IEvent>[] {
    if (!timeline?.length) return [];
    const gone = new Set(known);
    for (const raw of timeline) {
        if (raw.type !== "m.room.redaction") continue;
        const target = (raw as { redacts?: string }).redacts;
        if (target) gone.add(target);
    }
    return timeline.filter((raw) => {
        if (raw.event_id && gone.has(raw.event_id)) return false;
        const unsigned = (raw as { unsigned?: { redacted_because?: unknown } })
            .unsigned;
        return !unsigned?.redacted_because;
    });
}

/**
 * The snapshot with the given events removed from every room's timeline. The
 * same object comes back when none of them is cached, so callers skip the write.
 */
export function dropRedactedFromSnapshot(
    snapshot: RoomListSnapshot,
    eventIds: ReadonlySet<string>,
): RoomListSnapshot {
    let changed = false;
    const rooms = snapshot.rooms.map((room) => {
        if (!room.timeline?.length) return room;
        const timeline = prunedTimeline(room.timeline, eventIds);
        if (timeline.length === room.timeline.length) return room;
        changed = true;
        return { ...room, timeline: timeline.length ? timeline : undefined };
    });
    return changed ? { ...snapshot, rooms } : snapshot;
}

export interface MaterializedCache {
    rooms: Map<string, Room>;
    accountData: Map<string, MatrixEvent>;
}

function rawOf(ev: MatrixEvent): Partial<IEvent> {
    return { ...ev.event };
}

/** Snapshot the joined rooms of a client whose room list is complete. */
export function buildSnapshot(
    client: MatrixClient,
    accountDataTypes: readonly string[] = CACHED_ACCOUNT_DATA_TYPES,
): RoomListSnapshot {
    const accountData: Partial<IEvent>[] = [];
    for (const type of accountDataTypes) {
        const ev = client.getAccountData(type as never);
        if (ev) accountData.push(rawOf(ev));
    }
    const directIds = new Set(
        Object.values(
            (client.getAccountData(EventType.Direct)?.getContent() ??
                {}) as Record<string, string[]>,
        ).flat(),
    );
    const myId = client.getUserId();

    const rooms: CachedRoom[] = [];
    for (const room of client.getRooms()) {
        if (room.getMyMembership() !== "join") continue;
        const state: Partial<IEvent>[] = [];
        const current = room.currentState;
        for (const type of CACHED_STATE_TYPES) {
            for (const ev of current.getStateEvents(type))
                state.push(rawOf(ev));
        }
        const me = myId ? current.getStateEvents("m.room.member", myId) : null;
        if (me) state.push(rawOf(me));
        if (directIds.has(room.roomId)) {
            const members = current
                .getStateEvents("m.room.member")
                .filter(
                    (e) =>
                        e.getStateKey() !== myId &&
                        ["join", "invite"].includes(
                            e.getContent().membership ?? "",
                        ),
                );
            if (members.length <= MAX_CACHED_MEMBERS)
                for (const e of members) state.push(rawOf(e));
        }
        const heroes = (room as unknown as { heroes?: CachedHero[] | null })
            .heroes;
        // Newest 40 non-state events. A detached timeline replay is only worth
        // having if it looks like the conversation did, so this is the live
        // timeline's tail rather than a sample.
        // A redacted event is kept out: its stub has nothing to show, and the
        // plaintext it replaced must not be written back on a later boot.
        const tail = room
            .getLiveTimeline()
            .getEvents()
            .filter((e) => !e.isState() && !e.isRedacted())
            .slice(-MAX_CACHED_EVENTS);
        const timeline = tail.map(rawOf);
        // The tail's senders, so the cached conversation opens with display
        // names and avatars instead of raw user ids until members load. At
        // most one member event per sender, and none already stored above.
        const haveMember = new Set(
            state
                .filter((e) => e.type === "m.room.member")
                .map((e) => e.state_key),
        );
        for (const sender of new Set(tail.map((e) => e.getSender()))) {
            if (!sender || haveMember.has(sender)) continue;
            const member = current.getStateEvents("m.room.member", sender);
            if (member) state.push(rawOf(member));
        }
        rooms.push({
            roomId: room.roomId,
            state,
            accountData: [...room.accountData.values()].map(rawOf),
            timeline: timeline.length ? timeline : undefined,
            heroes: heroes?.length ? heroes.map((h) => ({ ...h })) : undefined,
            joined: room.getJoinedMemberCount(),
            invited: room.getInvitedMemberCount(),
            total: room.getUnreadNotificationCount(NotificationCountType.Total),
            highlight: room.getUnreadNotificationCount(
                NotificationCountType.Highlight,
            ),
        });
    }
    return { v: SNAPSHOT_VERSION, savedAt: Date.now(), accountData, rooms };
}

/** Turn a snapshot back into detached, read-only Room objects. */
export function materializeSnapshot(
    client: MatrixClient,
    snapshot: RoomListSnapshot,
): MaterializedCache {
    const toEvent = (raw: Partial<IEvent>) => new MatrixEvent(raw);
    const userId = client.getUserId() ?? "";
    const rooms = new Map<string, Room>();
    const knownRedacted = new Set(snapshot.redacted ?? []);
    for (const cached of snapshot.rooms) {
        try {
            const room = new Room(cached.roomId, client, userId, {
                lazyLoadMembers: true,
                // The live client runs detached ordering; a Room that defaults
                // to chronological throws from getPendingEvents(), which the
                // timeline helpers call before they read a single event.
                pendingEventOrdering: PendingEventOrdering.Detached,
            });
            room.getLiveTimeline().initialiseState(cached.state.map(toEvent));
            room.updateMyMembership("join");
            // Replay the cached conversation onto the live timeline so a room
            // opened with no network is not an empty pane. Latest events last,
            // and state resolution is skipped: the state above is the snapshot.
            // Redacted events are never replayed, so they never reach decryption
            // or the screen. client.ts decrypts only what is replayed here.
            const replay = prunedTimeline(cached.timeline, knownRedacted);
            if (replay.length) {
                // Through the timeline SET, not the bare timeline: that is
                // what indexes the events by id, so a reply finds its parent
                // here (findEventById) instead of fetching it over the network.
                const timeline = room.getLiveTimeline();
                const set = room.getUnfilteredTimelineSet();
                for (const raw of replay) {
                    set.addEventToTimeline(toEvent(raw), timeline, {
                        toStartOfTimeline: false,
                        addToState: false,
                    });
                }
            }
            if (cached.heroes || cached.joined !== undefined) {
                room.setMSC4186SummaryData(
                    cached.heroes?.map((h) => ({
                        user_id: h.userId,
                        displayname: h.displayName,
                        avatar_url: h.avatarUrl,
                    })),
                    cached.joined,
                    cached.invited,
                );
            }
            if (cached.accountData.length)
                room.addAccountData(cached.accountData.map(toEvent));
            if (cached.total)
                room.setUnreadNotificationCount(
                    NotificationCountType.Total,
                    cached.total,
                );
            if (cached.highlight)
                room.setUnreadNotificationCount(
                    NotificationCountType.Highlight,
                    cached.highlight,
                );
            room.recalculate();
            rooms.set(cached.roomId, room);
        } catch (err) {
            // One malformed entry must not cost the rest of the list.
            console.warn("[roomListCache] skipped room", cached.roomId, err);
        }
    }
    const accountData = new Map<string, MatrixEvent>();
    for (const raw of snapshot.accountData) {
        if (raw.type) accountData.set(raw.type, toEvent(raw));
    }
    return { rooms, accountData };
}

// ---- IndexedDB (one record per account + device) ----

const DB_NAME = "zam-roomlist-cache";
const STORE = "snapshots";

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE))
                db.createObjectStore(STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function withStore<T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
    const db = await openDb();
    try {
        return await new Promise<T>((resolve, reject) => {
            const tx = db.transaction(STORE, mode);
            const req = fn(tx.objectStore(STORE));
            tx.oncomplete = () => resolve(req.result as T);
            tx.onabort = tx.onerror = () => reject(tx.error ?? req.error);
        });
    } finally {
        db.close();
    }
}

export function snapshotKey(userId: string, deviceId: string): string {
    return `${userId}|${deviceId}`;
}

// Redacted event ids for an account. A record of its own, beside the snapshot:
// the snapshot is rewritten on a timer from live state, and a save built before
// a redaction must not undo the forgetting when it lands.
const REDACTED_RECORD_VERSION = 1;
const REDACTED_RECORD_MAX = 500;
const redactedRecordKey = (key: string) => `${key}|redacted`;

export async function loadSnapshot(
    key: string,
): Promise<RoomListSnapshot | null> {
    try {
        const snap = await withStore<RoomListSnapshot | undefined>(
            "readonly",
            (s) => s.get(key),
        );
        if (!snap || snap.v !== SNAPSHOT_VERSION) return null;
        const rec = await withStore<{ v: number; ids: string[] } | undefined>(
            "readonly",
            (s) => s.get(redactedRecordKey(key)),
        ).catch(() => undefined);
        return rec?.v === REDACTED_RECORD_VERSION
            ? { ...snap, redacted: rec.ids }
            : snap;
    } catch {
        return null;
    }
}

/**
 * Forget redacted events in the stored snapshot: remove them from the cached
 * timelines and remember their ids. The snapshot and the record are read and
 * written in ONE readwrite transaction, so a concurrent save cannot interleave.
 */
export async function forgetRedactedInCache(
    key: string,
    eventIds: readonly string[],
): Promise<void> {
    if (eventIds.length === 0) return;
    try {
        const db = await openDb();
        try {
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction(STORE, "readwrite");
                const store = tx.objectStore(STORE);
                const snapReq = store.get(key);
                const recReq = store.get(redactedRecordKey(key));
                // Requests on one store run in order, so the snapshot is read
                // by the time the record's handler runs.
                recReq.onsuccess = () => {
                    const rec = recReq.result as
                        { v: number; ids: string[] } | undefined;
                    const known =
                        rec?.v === REDACTED_RECORD_VERSION ? rec.ids : [];
                    const all = [...new Set([...known, ...eventIds])].slice(
                        -REDACTED_RECORD_MAX,
                    );
                    store.put(
                        { v: REDACTED_RECORD_VERSION, ids: all },
                        redactedRecordKey(key),
                    );
                    const snap = snapReq.result as RoomListSnapshot | undefined;
                    if (snap && snap.v === SNAPSHOT_VERSION) {
                        const next = dropRedactedFromSnapshot(
                            snap,
                            new Set(all),
                        );
                        if (next !== snap) store.put(next, key);
                    }
                };
                tx.oncomplete = () => resolve();
                tx.onabort = tx.onerror = () =>
                    reject(tx.error ?? recReq.error);
            });
        } finally {
            db.close();
        }
    } catch (err) {
        console.warn("[roomListCache] redaction forget failed", err);
    }
}

// Redactions arrive one at a time; batch them per account into one transaction.
const FORGET_BATCH_MS = 500;
const forgetBatch = new Map<string, Set<string>>();
let forgetBatchTimer: ReturnType<typeof setTimeout> | null = null;

/** Queue a redacted event for forgetting in the account's cached snapshot. */
export function queueRedactedForget(
    userId: string,
    deviceId: string,
    eventId: string,
): void {
    const key = snapshotKey(userId, deviceId);
    let ids = forgetBatch.get(key);
    if (!ids) {
        ids = new Set();
        forgetBatch.set(key, ids);
    }
    ids.add(eventId);
    if (forgetBatchTimer) return;
    forgetBatchTimer = setTimeout(() => {
        forgetBatchTimer = null;
        const batch = [...forgetBatch];
        forgetBatch.clear();
        for (const [k, set] of batch) void forgetRedactedInCache(k, [...set]);
    }, FORGET_BATCH_MS);
}

export async function saveSnapshot(
    key: string,
    snapshot: RoomListSnapshot,
): Promise<void> {
    try {
        await withStore("readwrite", (s) => s.put(snapshot, key));
    } catch (err) {
        reportStorageError(err, { fromIndexedDB: true });
        console.warn("[roomListCache] save failed", err);
    }
}

// The /hierarchy cache lives in its own record, not in the room-list snapshot:
// a snapshot is rewritten on a timer, only once the room list is complete, and
// dropped to heal rooms, any of which would lose a hierarchy that took a
// minute to fetch. It is kept until logout.
const HIERARCHY_RECORD_VERSION = 1;
const hierarchyRecordKey = (key: string) => `${key}|hierarchy`;

export async function loadHierarchies(
    key: string,
): Promise<Record<string, SpaceChildInfo[]> | null> {
    try {
        const rec = await withStore<
            | { v: number; hierarchies: Record<string, SpaceChildInfo[]> }
            | undefined
        >("readonly", (s) => s.get(hierarchyRecordKey(key)));
        return rec && rec.v === HIERARCHY_RECORD_VERSION
            ? rec.hierarchies
            : null;
    } catch {
        return null;
    }
}

export async function saveHierarchies(
    key: string,
    hierarchies: Record<string, SpaceChildInfo[]>,
): Promise<void> {
    try {
        await withStore("readwrite", (s) =>
            s.put(
                { v: HIERARCHY_RECORD_VERSION, hierarchies },
                hierarchyRecordKey(key),
            ),
        );
    } catch (err) {
        reportStorageError(err, { fromIndexedDB: true });
        console.warn("[roomListCache] hierarchy save failed", err);
    }
}

export async function deleteHierarchies(key: string): Promise<void> {
    try {
        await withStore("readwrite", (s) => s.delete(hierarchyRecordKey(key)));
    } catch {
        // Nothing stored or no IndexedDB: nothing to wipe.
    }
}

export async function deleteSnapshot(key: string): Promise<void> {
    try {
        await withStore("readwrite", (s) => s.delete(key));
        await withStore("readwrite", (s) => s.delete(redactedRecordKey(key)));
    } catch {
        // Nothing stored or no IndexedDB: nothing to wipe.
    }
}
