/**
 * Whether this device has run out of storage, or is about to. A full disk
 * otherwise fails silently: IndexedDB writes are rejected deep inside the
 * SDK and the crypto engine, and the app carries on without saving messages
 * or encryption keys. Anything that catches a storage error reports it here
 * (reportStorageError), as do the global error handlers and the console
 * watch installed from hooks.client.ts; the StorageBanner shows the state.
 *
 * Out-of-space clears itself: while it is set, the monitor re-checks every
 * FULL_CHECK_MS and lifts it once the quota has some room and a test write
 * to IndexedDB goes through.
 */
import {
    freeQuotaBytes,
    isLowOnSpace,
    isStorageFullError,
    type StorageErrorContext,
} from "$lib/utils/storageFull";

class StorageHealthState {
    // A write failed for lack of space and no check has seen room since.
    full = $state(false);
    // Free quota is below LOW_SPACE_BYTES (warn before writes fail).
    low = $state(false);
    // Free quota at the last check, or null when the browser doesn't say.
    freeBytes = $state<number | null>(null);
}

export const storageHealthState = new StorageHealthState();

/** How often to check the quota normally, and while out of space. */
const CHECK_MS = 5 * 60_000;
const FULL_CHECK_MS = 30_000;
const PROBE_DB = "zam-storage-probe";
const PROBE_BYTES = 64 * 1024;
const PROBE_TIMEOUT_MS = 10_000;
// Out-of-space lifts once at least this much is free (and a write works).
// Lower than the low-space warning: a small device may never get above that.
const RECOVERED_BYTES = 16 * 1024 * 1024;

let reporting = false;

/**
 * Record `err` if it means storage is full. True when it did. Never throws,
 * so it can sit in any catch block.
 */
export function reportStorageError(
    err: unknown,
    context: StorageErrorContext = {},
): boolean {
    // The warning below goes through the console watch, which calls back in.
    if (reporting) return false;
    let full = false;
    try {
        full = isStorageFullError(err, context);
    } catch {
        return false;
    }
    if (!full) return false;
    if (!storageHealthState.full) {
        storageHealthState.full = true;
        reporting = true;
        try {
            console.warn("[storage] device is out of storage", err);
        } finally {
            reporting = false;
        }
        scheduleCheck(FULL_CHECK_MS);
    }
    return true;
}

/** Test write: can IndexedDB take a small record right now? */
function probeWrite(): Promise<boolean> {
    const factory = typeof indexedDB !== "undefined" ? indexedDB : null;
    if (!factory) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (ok: boolean) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(ok);
            try {
                factory.deleteDatabase(PROBE_DB);
            } catch {
                /* best effort */
            }
        };
        const timer = setTimeout(() => finish(false), PROBE_TIMEOUT_MS);
        try {
            const open = factory.open(PROBE_DB, 1);
            open.onupgradeneeded = () => open.result.createObjectStore("p");
            open.onerror = () => finish(false);
            open.onblocked = () => finish(false);
            open.onsuccess = () => {
                const db = open.result;
                try {
                    const tx = db.transaction("p", "readwrite");
                    tx.objectStore("p").put(new Uint8Array(PROBE_BYTES), 1);
                    tx.oncomplete = () => {
                        db.close();
                        finish(true);
                    };
                    tx.onerror = tx.onabort = () => {
                        db.close();
                        finish(false);
                    };
                } catch {
                    db.close();
                    finish(false);
                }
            };
        } catch {
            finish(false);
        }
    });
}

/**
 * Read the quota now: flag low space, and lift out-of-space once there is
 * room again and a test write succeeds.
 */
export async function checkStorage(): Promise<void> {
    const storage =
        typeof navigator !== "undefined" ? navigator.storage : undefined;
    let low = false;
    if (storage && typeof storage.estimate === "function") {
        try {
            const estimate = await storage.estimate();
            storageHealthState.freeBytes = freeQuotaBytes(estimate);
            low = isLowOnSpace(estimate);
        } catch {
            storageHealthState.freeBytes = null;
        }
    }
    storageHealthState.low = low;
    const free = storageHealthState.freeBytes;
    if (
        storageHealthState.full &&
        (free === null || free >= RECOVERED_BYTES) &&
        (await probeWrite())
    ) {
        storageHealthState.full = false;
        console.info("[storage] space is available again");
    }
}

let timer: ReturnType<typeof setTimeout> | null = null;
let monitoring = false;

function scheduleCheck(ms: number): void {
    if (!monitoring) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void runCheck(), ms);
}

async function runCheck(): Promise<void> {
    timer = null;
    await checkStorage();
    scheduleCheck(storageHealthState.full ? FULL_CHECK_MS : CHECK_MS);
}

/** Check the quota now and then periodically. Idempotent. */
export function startStorageMonitor(): void {
    if (monitoring) return;
    monitoring = true;
    void runCheck();
}

/** Re-check right away (the banner's "check again"). */
export function recheckStorage(): Promise<void> {
    if (timer) clearTimeout(timer);
    return runCheck();
}

/**
 * Report storage-full errors nobody caught (unhandled rejections, uncaught
 * errors) and ones that were only logged: the SDK and the crypto engine
 * catch their own store failures and log them. Idempotent.
 */
let handlersInstalled = false;
export function installStorageErrorHandlers(): void {
    if (handlersInstalled || typeof window === "undefined") return;
    handlersInstalled = true;
    window.addEventListener("unhandledrejection", (e) => {
        reportStorageError(e.reason);
    });
    window.addEventListener("error", (e) => {
        reportStorageError(e.error ?? e.message);
    });
    for (const level of ["warn", "error"] as const) {
        const original = console[level];
        if (typeof original !== "function") continue;
        console[level] = function (...args: unknown[]) {
            if (!storageHealthState.full)
                for (const arg of args) if (reportStorageError(arg)) break;
            return original.apply(this, args);
        };
    }
}
