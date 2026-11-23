/**
 * One shared IndexedDB connection per factory and database name, for page-side
 * stores that used to open their database on every call and never close it
 * (each call leaked a connection until GC).
 *
 * The connection is closed when another context asks to upgrade the schema
 * (`versionchange`) or the browser closes it, and the next call reopens it.
 * Failed or blocked opens are not cached, so a later call retries. Keyed by the
 * factory object, so a replaced `indexedDB` (tests) never reuses an old one.
 */

const connections = new WeakMap<
    IDBFactory,
    Map<string, Promise<IDBDatabase>>
>();

export function openSharedDb(
    name: string,
    version: number,
    onUpgrade: (db: IDBDatabase) => void,
): Promise<IDBDatabase> {
    const factory = globalThis.indexedDB as IDBFactory | undefined;
    if (!factory) return Promise.reject(new Error("IndexedDB unavailable"));

    let byName = connections.get(factory);
    if (!byName) {
        byName = new Map();
        connections.set(factory, byName);
    }
    const cache = byName;
    const existing = cache.get(name);
    if (existing) return existing;

    const forget = () => {
        if (cache.get(name) === p) cache.delete(name);
    };
    const p: Promise<IDBDatabase> = new Promise((resolve, reject) => {
        const req = factory.open(name, version);
        req.onupgradeneeded = () => onUpgrade(req.result);
        req.onsuccess = () => {
            const db = req.result;
            if (cache.get(name) !== p) {
                // Abandoned by a blocked or failed earlier attempt: nothing
                // holds this connection, so release it.
                db.close();
                return;
            }
            db.onversionchange = () => {
                db.close();
                forget();
            };
            db.onclose = forget;
            resolve(db);
        };
        req.onerror = () => {
            forget();
            reject(req.error);
        };
        req.onblocked = () => {
            forget();
            reject(new Error("blocked"));
        };
    });
    cache.set(name, p);
    return p;
}
