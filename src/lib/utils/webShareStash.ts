// App-side reader of the service worker's Web Share Target stash. The SW
// (static/sw.js) writes the shared payload into IndexedDB and redirects here;
// this consumes it exactly once (read then delete). Same db/store/version as
// the SW's own openDb so both see the same object store.

const DB_NAME = "matrix-sw";
const DB_STORE = "auth";
const SHARE_KEY = "share_target_payload";

export type WebShareStash = {
    title?: string;
    text?: string;
    url?: string;
    files?: File[];
};

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

/** Read the stashed share payload and delete it (consume once). Returns null
 *  when there's nothing stashed or IndexedDB is unavailable. */
export async function consumeWebShareStash(): Promise<WebShareStash | null> {
    if (typeof indexedDB === "undefined") return null;
    let db: IDBDatabase;
    try {
        db = await openDb();
    } catch {
        return null;
    }
    return new Promise<WebShareStash | null>((resolve) => {
        try {
            const tx = db.transaction(DB_STORE, "readwrite");
            const store = tx.objectStore(DB_STORE);
            const getReq = store.get(SHARE_KEY);
            getReq.onsuccess = () => {
                const value = getReq.result ?? null;
                store.delete(SHARE_KEY);
                resolve(value as WebShareStash | null);
            };
            getReq.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
}

/** Decode one Android-bridged file (base64) into a File, or null on any error. */
export function base64ToFile(f: {
    name?: string;
    mimeType?: string;
    dataBase64?: string;
}): File | null {
    try {
        if (!f?.dataBase64) return null;
        const bin = atob(f.dataBase64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new File([bytes], f.name || "file", {
            type: f.mimeType || "application/octet-stream",
        });
    } catch {
        return null;
    }
}
