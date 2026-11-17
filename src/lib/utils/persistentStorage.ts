// Ask the browser to keep this origin's storage when the disk runs low.
//
// Without it, storage is "best effort": Chromium evicts best-effort origins
// whole (IndexedDB, so the crypto store, included) under disk pressure, and
// that is exactly when a full disk also makes it wipe localStorage. Persisted
// storage is exempt from that eviction. It does not stop Chromium's
// localStorage reset after failed writes (registryBackup.ts covers that), nor
// Safari's 7-day purge for a site opened in a plain tab.
//
// Chromium and Safari 17+ decide silently (installed app, engagement); Firefox
// shows a permission prompt, so this runs only once someone is signed in and
// never asks again after an answer of "already persisted".

export interface StorageManagerLike {
    persisted?: () => Promise<boolean>;
    persist?: () => Promise<boolean>;
}

export type PersistOutcome = "unsupported" | "already" | "granted" | "denied";

export async function requestPersistentStorage(
    storage: StorageManagerLike | undefined = typeof navigator !== "undefined"
        ? navigator.storage
        : undefined,
): Promise<PersistOutcome> {
    if (!storage || typeof storage.persist !== "function") return "unsupported";
    try {
        if (
            typeof storage.persisted === "function" &&
            (await storage.persisted())
        )
            return "already";
        return (await storage.persist()) ? "granted" : "denied";
    } catch {
        return "unsupported";
    }
}
