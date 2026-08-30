/**
 * Bundle cache — pure staleness decision + IndexedDB I/O.
 *
 * `isCachedBundleUsable` is pure (unit-tested). The IndexedDB I/O
 * (`getCachedBundle`, `putCachedBundle`, `deleteCachedBundle`) is live-verified
 * only — `indexedDB` is referenced ONLY inside function bodies (jsdom-safe import).
 */

export interface CachedBundle {
    pluginId: string;
    version: string;
    code: string;
    cachedAt: number;
}

/** Pure: a cached bundle is usable iff it exists, its version exactly matches
 *  the version the repo index advertises, and it carries non-empty code. A
 *  version mismatch means the repo published an update → refetch. */
export function isCachedBundleUsable(
    cached: CachedBundle | null | undefined,
    wantedVersion: string,
): boolean {
    return (
        !!cached &&
        typeof cached.code === "string" &&
        cached.code.length > 0 &&
        cached.version === wantedVersion
    );
}

const DB_NAME = "zam-plugins";
const STORE = "bundles";

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE, { keyPath: "pluginId" });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function getCachedBundle(
    pluginId: string,
): Promise<CachedBundle | null> {
    try {
        const db = await openDb();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, "readonly");
            const req = tx.objectStore(STORE).get(pluginId);
            req.onsuccess = () => resolve((req.result as CachedBundle) ?? null);
            req.onerror = () => reject(req.error);
        });
    } catch {
        return null;
    }
}

export async function putCachedBundle(bundle: CachedBundle): Promise<void> {
    try {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE, "readwrite");
            tx.objectStore(STORE).put(bundle);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch {
        /* cache is best-effort — a failed write just means a refetch next time */
    }
}

export async function deleteCachedBundle(pluginId: string): Promise<void> {
    try {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE, "readwrite");
            tx.objectStore(STORE).delete(pluginId);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch {
        /* ignore */
    }
}
