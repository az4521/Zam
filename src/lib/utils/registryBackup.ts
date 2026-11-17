// A copy of the account registry in IndexedDB, so a localStorage wipe does not
// sign the user out.
//
// Why: Chromium deletes an origin's whole localStorage database when writes to
// it keep failing (LocalStorageImpl::OnCommitResult → DeleteAndRecreateDatabase
// with kCommitErrorThresholdExceeded), and also when it fails to open it. A
// full disk causes exactly that. The registry (access tokens, device ids)
// lives in localStorage, so the account vanished and the user had to sign in
// again, as a new device. IndexedDB is a separate backend that recovery does
// not touch, and the rust-crypto store in it survives too, so restoring the
// registry from here resumes the same device with its keys intact.
//
// The registry is the only thing mirrored: per-account settings that also sat
// in localStorage are still lost when Chromium wipes it.

import { parseRegistry, type AccountRegistry } from "./accounts";

const DB_NAME = "zam-account-backup";
const STORE = "registry";
const KEY = "matrix_accounts";

/**
 * The registry to restore, or null when there is nothing to do. Only restores
 * into an EMPTY registry: a live one is always newer than the backup.
 */
export function pickRecoveredRegistry(
    current: AccountRegistry,
    backupRaw: string | null | undefined,
): AccountRegistry | null {
    if (current.accounts.length > 0) return null;
    if (typeof backupRaw !== "string") return null;
    const backup = parseRegistry(backupRaw);
    return backup.accounts.length > 0 ? backup : null;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(STORE))
                req.result.createObjectStore(STORE);
        };
        req.onsuccess = () => {
            const db = req.result;
            // Never block a delete or upgrade from another context.
            db.onversionchange = () => {
                db.close();
                dbPromise = null;
            };
            resolve(db);
        };
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error("blocked"));
    });
    // A failed open is retried on the next call rather than cached.
    dbPromise.catch(() => {
        dbPromise = null;
    });
    return dbPromise;
}

/**
 * Write the serialized registry. Fire-and-forget: a failure (the disk is full
 * too) keeps the previous copy, which is still the best one available.
 * Transactions on one store complete in the order they were created, so the
 * newest call wins.
 */
export function writeRegistryBackup(raw: string): void {
    if (typeof indexedDB === "undefined") return;
    openDb()
        .then((db) => {
            const tx = db.transaction(STORE, "readwrite");
            tx.objectStore(STORE).put(raw, KEY);
        })
        .catch(() => {});
}

/** The serialized backup, or null when absent or unreadable. */
export async function readRegistryBackup(
    timeoutMs = 2000,
): Promise<string | null> {
    if (typeof indexedDB === "undefined") return null;
    const read = openDb().then(
        (db) =>
            new Promise<string | null>((resolve) => {
                const req = db
                    .transaction(STORE, "readonly")
                    .objectStore(STORE)
                    .get(KEY);
                req.onsuccess = () =>
                    resolve(typeof req.result === "string" ? req.result : null);
                req.onerror = () => resolve(null);
            }),
    );
    // Boot waits on this, so it must never hang.
    const timeout = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), timeoutMs),
    );
    try {
        return await Promise.race([read, timeout]);
    } catch {
        return null;
    }
}
