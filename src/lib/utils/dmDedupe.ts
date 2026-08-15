/**
 * Pure plumbing for DM-creation dedupe (see `createDirectMessage` in
 * `client.ts`). No imports so it can be unit-tested — the house pattern
 * (`inFlightByKey.ts`).
 */

/**
 * The dedupe key for one account creating a DM with one contact, or `null`
 * when the account's own user id is not known yet.
 *
 * A `null` owner MUST NOT be deduped. `getUserId()` can be momentarily empty
 * (before `whoami` resolves); keying on `"|<contact>"` then would let a call
 * made while it was empty and a later call made once it resolved take
 * DIFFERENT keys and both create a room — two DMs for one contact. Callers
 * treat `null` as "not logged in" and refuse to start.
 */
export function dmDedupeKey(
    ownUserId: string,
    contactUserId: string,
): string | null {
    if (!ownUserId.trim()) return null;
    return `${ownUserId}|${contactUserId}`;
}

/** Monotonic per-key record of "does any caller want this DM encrypted?". */
export interface DmEncryptIntent {
    /** Raise the key's intent to encrypted. `encrypt=false` is a no-op. */
    raise(key: string, encrypt: boolean): void;
    /** The raised intent for the key, or `fallback` if none was raised. */
    resolve(key: string, fallback: boolean): boolean;
    /** Forget the key (call when its create settles). */
    clear(key: string): void;
}

/**
 * Concurrent DM-create callers can disagree on `encrypt` (the setting flips
 * between two near-simultaneous clicks). Since they collapse onto one room,
 * the honest bias is toward encryption: encryption is irreversible and a DM
 * pinned to plaintext by a race is the strictly worse outcome. This ledger
 * lets every caller raise the intent; the actual create reads it at room-build
 * time, so a `true` raised before the room is built wins.
 */
export function createDmEncryptIntent(): DmEncryptIntent {
    const raised = new Map<string, boolean>();
    return {
        raise(key, encrypt) {
            if (encrypt) raised.set(key, true);
        },
        resolve(key, fallback) {
            return raised.get(key) ?? fallback;
        },
        clear(key) {
            raised.delete(key);
        },
    };
}
