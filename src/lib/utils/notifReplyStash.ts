// Page-side IndexedDB reader for quick-reply stashes written by the service
// worker when the page was closed. Same db/store/version as webShareStash.ts.

import {
    QUICK_REPLY_STASH_PREFIX,
    quickReplyStashKey,
    partitionQuickReplyStashes,
    type QuickReplyStash,
} from "./notifActions";

const DB_NAME = "matrix-sw";
const DB_STORE = "auth";

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        // Mirror the SW: create the out-of-line store if this context opens the
        // db before the SW ever has.
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(DB_STORE))
                req.result.createObjectStore(DB_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error("blocked"));
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
