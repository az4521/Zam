/**
 * Request persistent (non-evictable) origin storage so mobile browsers and
 * installed PWAs don't silently evict our IndexedDB state — most importantly
 * the rust-crypto store (Megolm/room keys, cross-signing secrets) and the
 * sync store. SDK-free: touches only the browser StorageManager, so the
 * decision gate can be unit-tested.
 *
 * See docs/superpowers/specs/2026-07-24-storage-persist-design.md.
 */

export interface PersistResult {
    /** The StorageManager persist API exists in this context. */
    supported: boolean;
    /** Origin is persisted after this call (false when unsupported/denied). */
    persisted: boolean;
    /** We actually invoked persist() this call (false when unsupported or already granted). */
    requested: boolean;
}

export interface ShouldRequestInput {
    /** navigator.storage.persist/persisted are both callable. */
    apiAvailable: boolean;
    /** navigator.storage.persisted() already returned true. */
    alreadyPersisted: boolean;
}

/**
 * Pure gate: request persistence only when the API exists AND we're not
 * already persisted. Encodes the idempotent short-circuit. The one unit.
 */
export function shouldRequestPersistence(input: ShouldRequestInput): boolean {
    return input.apiAvailable && !input.alreadyPersisted;
}

/**
 * Feature-detected, idempotent one-shot: if supported and not already
 * persisted, ask the browser to persist this origin. Never throws — a denied
 * grant is a normal `{ persisted: false }`, not an error, and is not retried
 * within a session. Not unit-tested (browser API) → live-verify.
 */
export async function requestPersistentStorage(): Promise<PersistResult> {
    const storage =
        typeof navigator !== "undefined" ? navigator.storage : undefined;
    const apiAvailable =
        !!storage &&
        typeof storage.persist === "function" &&
        typeof storage.persisted === "function";

    if (!apiAvailable) {
        return { supported: false, persisted: false, requested: false };
    }

    let alreadyPersisted = false;
    try {
        alreadyPersisted = await storage!.persisted();
    } catch {
        alreadyPersisted = false;
    }

    if (!shouldRequestPersistence({ apiAvailable, alreadyPersisted })) {
        return {
            supported: true,
            persisted: alreadyPersisted,
            requested: false,
        };
    }

    let granted = false;
    try {
        granted = await storage!.persist();
    } catch {
        granted = false;
    }
    return { supported: true, persisted: granted, requested: true };
}
