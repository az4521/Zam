// Page-side IndexedDB reader for quick-reply stashes written by the service
// worker when the page was closed. Same db/store/version as webShareStash.ts.

import {
    QUICK_REPLY_STASH_PREFIX,
    quickReplyStashKey,
    partitionQuickReplyStashes,
    type QuickReplyStash,
} from "./notifActions";
import { openSharedDb } from "./sharedIdb";

const DB_NAME = "matrix-sw";
const DB_STORE = "auth";

function openDb(): Promise<IDBDatabase> {
    // Mirror the SW: create the out-of-line store if this context opens the
    // db before the SW ever has.
    return openSharedDb(DB_NAME, 1, (db) => {
        if (!db.objectStoreNames.contains(DB_STORE))
            db.createObjectStore(DB_STORE);
    });
}

/**
 * Read all quick-reply stashes for the given user, delete them (and any
 * invalid/expired ones), and return the valid entries sorted by timestamp.
 * Other users' valid entries are left untouched. Returns empty when IndexedDB
 * is unavailable or open fails.
 */
export async function takeQuickReplyStashes(
    userId: string,
    now = Date.now(),
): Promise<QuickReplyStash[]> {
    if (typeof indexedDB === "undefined") return [];
    let db: IDBDatabase;
    try {
        db = await openDb();
    } catch {
        return [];
    }
    return new Promise<QuickReplyStash[]>((resolve) => {
        try {
            const tx = db.transaction(DB_STORE, "readwrite");
            const store = tx.objectStore(DB_STORE);
            const range = IDBKeyRange.bound(
                QUICK_REPLY_STASH_PREFIX,
                QUICK_REPLY_STASH_PREFIX + "\uffff",
            );

            const entries: { key: string; value: unknown }[] = [];
            const cursorReq = store.openCursor(range);

            cursorReq.onsuccess = () => {
                const cursor = cursorReq.result;
                if (cursor) {
                    entries.push({
                        key: cursor.key as string,
                        value: cursor.value,
                    });
                    cursor.continue();
                } else {
                    // Done reading — partition and delete
                    const { take, deleteKeys } = partitionQuickReplyStashes(
                        entries,
                        userId,
                        now,
                    );
                    for (const key of deleteKeys) {
                        store.delete(key);
                    }
                    resolve(take);
                }
            };
            cursorReq.onerror = () => resolve([]);
        } catch {
            resolve([]);
        }
    });
}

/**
 * Delete a single quick-reply stash by id. No-op when IndexedDB is unavailable
 * or the delete fails.
 */
export async function deleteQuickReplyStash(id: string): Promise<void> {
    if (typeof indexedDB === "undefined") return;
    let db: IDBDatabase;
    try {
        db = await openDb();
    } catch {
        return;
    }
    return new Promise<void>((resolve) => {
        try {
            const tx = db.transaction(DB_STORE, "readwrite");
            const store = tx.objectStore(DB_STORE);
            const key = quickReplyStashKey(id);
            const delReq = store.delete(key);
            delReq.onsuccess = () => resolve();
            delReq.onerror = () => resolve();
        } catch {
            resolve();
        }
    });
}
