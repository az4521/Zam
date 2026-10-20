// Recognising "the device is out of space" among the errors storage hands
// back. Chromium's IndexedDB sits on SQLite (Zam has no SQLite of its own),
// so a full disk can surface as a QuotaExceededError, as a bare
// UnknownError / DataError from IndexedDB, or as SQLite's own wording inside
// the message of an error the crypto WASM wraps. SDK-free and pure, so the
// classification is unit-tested.

export interface StorageErrorContext {
    /**
     * The error came out of an IndexedDB (or crypto store) call. Only then do
     * a bare UnknownError / DataError count: elsewhere those names mean
     * something unrelated (DataError is also an invalid IndexedDB key).
     */
    fromIndexedDB?: boolean;
}

// Wording that only ever means "no space", wherever it shows up.
const FULL_TEXT =
    /QuotaExceeded|NS_ERROR_DOM_QUOTA_REACHED|SQLITE_FULL|database or disk is full|disk (?:is )?full|no space left on device|ENOSPC/i;
// Names IndexedDB uses for a write the backing store refused.
const IDB_FAILURE_NAMES = new Set(["UnknownError", "DataError"]);
// The same, as they appear inside a wrapped error's message (the crypto
// WASM reports `DomException { name: "UnknownError", ... }`).
const IDB_FAILURE_TEXT = /\b(?:UnknownError|DataError)\b/;

function errorName(err: unknown): string {
    if (err && typeof err === "object" && "name" in err) {
        const name = (err as { name?: unknown }).name;
        if (typeof name === "string") return name;
    }
    return "";
}

function errorText(err: unknown): string {
    if (typeof err === "string") return err;
    if (err && typeof err === "object") {
        const message = (err as { message?: unknown }).message;
        if (typeof message === "string") return message;
    }
    try {
        return String(err);
    } catch {
        return "";
    }
}

/** Whether `err` (or anything in its `cause` chain) means storage is full. */
export function isStorageFullError(
    err: unknown,
    context: StorageErrorContext = {},
): boolean {
    for (let e = err, depth = 0; e != null && depth < 5; depth++) {
        const name = errorName(e);
        const text = errorText(e);
        if (name === "QuotaExceededError") return true;
        // Legacy DOMException code for QUOTA_EXCEEDED_ERR.
        if ((e as { code?: unknown }).code === 22) return true;
        if (FULL_TEXT.test(name) || FULL_TEXT.test(text)) return true;
        if (
            context.fromIndexedDB &&
            (IDB_FAILURE_NAMES.has(name) || IDB_FAILURE_TEXT.test(text))
        )
            return true;
        e =
            typeof e === "object"
                ? (e as { cause?: unknown }).cause
                : undefined;
    }
    return false;
}

/** Below this much free quota, warn before writes start failing. */
export const LOW_SPACE_BYTES = 200 * 1024 * 1024;

export interface StorageEstimateLike {
    quota?: number;
    usage?: number;
}

/**
 * Free bytes left in the origin's quota, or null when the browser doesn't
 * say. Chromium sizes the quota from the free disk, so this tracks the disk.
 */
export function freeQuotaBytes(estimate: StorageEstimateLike): number | null {
    const { quota, usage } = estimate;
    if (typeof quota !== "number" || !Number.isFinite(quota) || quota <= 0)
        return null;
    return Math.max(0, quota - (typeof usage === "number" ? usage : 0));
}

/** Whether the free quota is low enough to warn about. */
export function isLowOnSpace(estimate: StorageEstimateLike): boolean {
    const free = freeQuotaBytes(estimate);
    return free !== null && free < LOW_SPACE_BYTES;
}

/** Why crypto init failed, as the banner explains it. */
export type CryptoFailureKind = "storage" | "locked" | "other";

/** Classify an initCrypto failure. */
export function cryptoFailureKind(err: unknown): CryptoFailureKind {
    if (isStorageFullError(err, { fromIndexedDB: true })) return "storage";
    if (/push-notification decrypt/.test(errorText(err))) return "locked";
    return "other";
}
