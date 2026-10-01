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
    Room,
    type IEvent,
    type MatrixClient,
} from "matrix-js-sdk";
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
];

// A DM with more joined members than this is a group chat; don't cache its
// whole member list.
const MAX_CACHED_MEMBERS = 8;

interface CachedHero {
    userId: string;
    displayName?: string;
    avatarUrl?: string;
}

interface CachedRoom {
    roomId: string;
    state: Partial<IEvent>[];
    accountData: Partial<IEvent>[];
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
        rooms.push({
            roomId: room.roomId,
            state,
            accountData: [...room.accountData.values()].map(rawOf),
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
    for (const cached of snapshot.rooms) {
        try {
            const room = new Room(cached.roomId, client, userId, {
                lazyLoadMembers: true,
            });
            room.getLiveTimeline().initialiseState(cached.state.map(toEvent));
            room.updateMyMembership("join");
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

export async function loadSnapshot(
    key: string,
): Promise<RoomListSnapshot | null> {
    try {
        const snap = await withStore<RoomListSnapshot | undefined>(
            "readonly",
            (s) => s.get(key),
        );
        return snap && snap.v === SNAPSHOT_VERSION ? snap : null;
    } catch {
        return null;
    }
}

export async function saveSnapshot(
    key: string,
    snapshot: RoomListSnapshot,
): Promise<void> {
    try {
        await withStore("readwrite", (s) => s.put(snapshot, key));
    } catch (err) {
        console.warn("[roomListCache] save failed", err);
    }
}

export async function deleteSnapshot(key: string): Promise<void> {
    try {
        await withStore("readwrite", (s) => s.delete(key));
    } catch {
        // Nothing stored or no IndexedDB: nothing to wipe.
    }
}
