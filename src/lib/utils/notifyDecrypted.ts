// Deciding whether a just-decrypted event should raise a notification.
//
// An encrypted message reaches the live timeline as `m.room.encrypted`, so the
// main notification path (which gates on the cleartext event type) never sees
// it. A second path notifies on decryption instead, and re-runs the same gate
// chain here. Kept pure so every branch is unit-testable — the SDK/UI wiring
// lives in client.ts and AppShell.svelte.

/**
 * How many event ids the notification bookkeeping remembers. Bounded so a
 * long-running session cannot grow the maps without limit; eviction is FIFO,
 * and the worst case of an eviction is a missed notification for an event that
 * took longer than 500 further events to decrypt.
 */
export const NOTIFIED_ID_CAP = 500;

export interface BoundedIdSet {
    has(id: string): boolean;
    add(id: string): void;
    readonly size: number;
}

/** Insertion-ordered set that drops its oldest id once `cap` is exceeded. */
export function createBoundedIdSet(
    cap: number = NOTIFIED_ID_CAP,
): BoundedIdSet {
    const ids = new Set<string>();
    return {
        has: (id) => ids.has(id),
        add(id) {
            if (ids.has(id)) return;
            ids.add(id);
            // Set iteration order is insertion order, so the first key is the
            // oldest.
            while (ids.size > cap) {
                const oldest = ids.values().next().value;
                if (oldest === undefined) break;
                ids.delete(oldest);
            }
        },
        get size() {
            return ids.size;
        },
    };
}

export interface BoundedIdMap<V> {
    has(id: string): boolean;
    get(id: string): V | undefined;
    set(id: string, value: V): void;
    delete(id: string): void;
    readonly size: number;
}

/** Insertion-ordered map that drops its oldest entry once `cap` is exceeded. */
export function createBoundedIdMap<V>(
    cap: number = NOTIFIED_ID_CAP,
): BoundedIdMap<V> {
    const entries = new Map<string, V>();
    return {
        has: (id) => entries.has(id),
        get: (id) => entries.get(id),
        set(id, value) {
            entries.set(id, value);
            while (entries.size > cap) {
                const oldest = entries.keys().next().value;
                if (oldest === undefined) break;
                entries.delete(oldest);
            }
        },
        delete(id) {
            entries.delete(id);
        },
        get size() {
            return entries.size;
        },
    };
}

export interface DecryptedNotifyInput {
    /** Falsy when the SDK gave us an event with no id — never notify then. */
    eventId: string | null | undefined;
    /** This event already went through the notification path once. */
    alreadyNotified: boolean;
    /** The ciphertext arrived as a fresh tail append (not a mid-timeline insert). */
    isLiveAppend: boolean;
    isOwnEvent: boolean;
    /** Set when the event is a thread reply — those have their own gated path. */
    threadRootId: string | null | undefined;
    /** `notify` from getPushActionsForEvent(event, true) — false for a muted room. */
    pushNotify: boolean;
}

/**
 * The plaintext gate chain, re-run for an event that only became notifiable
 * once it decrypted. Mirrors the order used by the main-timeline subscription
 * in AppShell so the two paths cannot drift.
 */
export function shouldNotifyDecrypted(input: DecryptedNotifyInput): boolean {
    if (!input.eventId) return false;
    if (input.alreadyNotified) return false;
    if (!input.isLiveAppend) return false;
    if (input.isOwnEvent) return false;
    if (input.threadRootId) return false;
    return input.pushNotify;
}
