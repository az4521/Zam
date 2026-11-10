/**
 * Remembers the folder a local plugin was loaded from, where the browser lets a
 * page keep a directory handle (File System Access API: Chromium and Electron).
 * That makes "Reload" a one-click re-read; elsewhere the user re-picks the
 * folder. Best-effort IndexedDB: every function degrades to "no handle".
 */

const DB_NAME = "zam-plugin-dev";
const STORE = "handles";

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(STORE))
                req.result.createObjectStore(STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function run<T>(
    mode: IDBTransactionMode,
    fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
    });
}

export function canPickDirectory(): boolean {
    return (
        typeof window !== "undefined" &&
        typeof (window as unknown as { showDirectoryPicker?: unknown })
            .showDirectoryPicker === "function"
    );
}

/** Ask for a folder. Throws AbortError if the user cancels. */
export function pickDirectory(): Promise<FileSystemDirectoryHandle> {
    return (
        window as unknown as {
            showDirectoryPicker(o?: {
                id?: string;
            }): Promise<FileSystemDirectoryHandle>;
        }
    ).showDirectoryPicker({ id: "zam-plugin-dev" });
}

export async function saveLocalHandle(
    pluginId: string,
    handle: FileSystemDirectoryHandle,
): Promise<void> {
    try {
        await run("readwrite", (s) => s.put(handle, pluginId));
    } catch {
        /* reload just asks for the folder again */
    }
}

export async function getLocalHandle(
    pluginId: string,
): Promise<FileSystemDirectoryHandle | null> {
    try {
        return (
            ((await run("readonly", (s) => s.get(pluginId))) as
                FileSystemDirectoryHandle | undefined) ?? null
        );
    } catch {
        return null;
    }
}

export async function deleteLocalHandle(pluginId: string): Promise<void> {
    try {
        await run("readwrite", (s) => s.delete(pluginId));
    } catch {
        /* ignore */
    }
}

const REPO_PREFIX = "repo:";

/** Keep a picked repo folder (one holding several plugin folders), keyed by its
 *  name, so the plugin watcher can notice folders added to it later. */
export async function saveRepoHandle(
    root: FileSystemDirectoryHandle,
): Promise<void> {
    try {
        await run("readwrite", (s) => s.put(root, REPO_PREFIX + root.name));
    } catch {
        /* the watcher just doesn't see this folder */
    }
}

/** Every saved repo folder. Empty when nothing is saved or IndexedDB fails. */
export async function listRepoHandles(): Promise<FileSystemDirectoryHandle[]> {
    try {
        const db = await openDb();
        try {
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE, "readonly");
                const s = tx.objectStore(STORE);
                const keys = s.getAllKeys();
                const values = s.getAll();
                tx.oncomplete = () => {
                    const out: FileSystemDirectoryHandle[] = [];
                    keys.result.forEach((k, i) => {
                        if (typeof k === "string" && k.startsWith(REPO_PREFIX))
                            out.push(
                                values.result[i] as FileSystemDirectoryHandle,
                            );
                    });
                    resolve(out);
                };
                tx.onerror = () => reject(tx.error);
            });
        } finally {
            db.close();
        }
    } catch {
        return [];
    }
}

export async function deleteRepoHandle(name: string): Promise<void> {
    try {
        await run("readwrite", (s) => s.delete(REPO_PREFIX + name));
    } catch {
        /* ignore */
    }
}

/** Make sure we may read `handle`, prompting if the browser needs to. */
export async function ensureReadable(
    handle: FileSystemDirectoryHandle,
): Promise<boolean> {
    const h = handle as unknown as {
        queryPermission(o: { mode: "read" }): Promise<string>;
        requestPermission(o: { mode: "read" }): Promise<string>;
    };
    try {
        if ((await h.queryPermission({ mode: "read" })) === "granted")
            return true;
        return (await h.requestPermission({ mode: "read" })) === "granted";
    } catch {
        return false;
    }
}
