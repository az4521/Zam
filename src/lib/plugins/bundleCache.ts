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
    sha?: string;
}

/** Pure: a cached bundle is usable iff it exists, its version exactly matches
 *  the version the repo index advertises, it carries non-empty code, AND (when
 *  a SHA is given) the cached SHA matches. A version or SHA mismatch means the
 *  repo published an update → refetch. Legacy cache rows with no sha stay usable. */
export function isCachedBundleUsable(
    cached: CachedBundle | null | undefined,
    wantedVersion: string,
    sha?: string,
): boolean {
    if (!cached) return false;
    if (typeof cached.code !== "string" || cached.code.length === 0)
        return false;
    if (cached.version !== wantedVersion) return false;
    // When a SHA is given and the cache has a SHA, they must match
    if (sha && typeof cached.sha === "string" && cached.sha !== sha)
        return false;
    return true;
}

/** Pure: when a fetch at the pinned SHA fails (offline, 404), may this cache
 *  row stand in? Only if it was cached at that SHA, or is a legacy row with no
 *  SHA (installed before pinning). A row from another commit never runs in
 *  place of the pin. Version is not checked: the fallback is best-effort. */
export function isCacheFallbackAllowed(
    cached: CachedBundle | null | undefined,
    sha: string,
): cached is CachedBundle {
    if (!cached || typeof cached.code !== "string" || cached.code.length === 0)
        return false;
    return typeof cached.sha !== "string" || cached.sha === sha;
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
