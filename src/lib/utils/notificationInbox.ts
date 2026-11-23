/**
 * Pure helpers for the loud/silent notification inbox: forgetting the entries
 * of redacted events and bounding how many bodies are kept on the device.
 * Store-free and SDK-free so they can be unit-tested; the store in
 * stores/notifications.svelte.ts owns persistence.
 */

export interface InboxEntry {
    roomId: string;
    eventId: string;
    ts: number;
}

/** Most message bodies the inbox keeps across all rooms (newest kept). */
export const INBOX_MAX_ENTRIES = 200;

/**
 * Remove the entries for the given events. Returns the new map, or null when
 * none of the refs was in the inbox (so the caller skips the write).
 */
export function removeInboxEvents<T extends InboxEntry>(
    byRoom: Record<string, T[]>,
    refs: readonly { roomId: string; eventId: string }[],
): Record<string, T[]> | null {
    if (refs.length === 0) return null;
    const gone = new Map<string, Set<string>>();
    for (const ref of refs) {
        let ids = gone.get(ref.roomId);
        if (!ids) {
            ids = new Set();
            gone.set(ref.roomId, ids);
        }
        ids.add(ref.eventId);
    }
    let changed = false;
    const next: Record<string, T[]> = {};
    for (const [roomId, list] of Object.entries(byRoom)) {
        const drop = gone.get(roomId);
        const kept = drop ? list.filter((e) => !drop.has(e.eventId)) : list;
        if (kept.length !== list.length) changed = true;
        if (kept.length > 0) next[roomId] = kept;
    }
    return changed ? next : null;
}

/**
 * Keep only the newest `max` entries across all rooms. Returns the trimmed map,
 * or null when the inbox is already within the bound.
 */
export function capInbox<T extends InboxEntry>(
    byRoom: Record<string, T[]>,
    max: number = INBOX_MAX_ENTRIES,
): Record<string, T[]> | null {
    const all: T[] = [];
    for (const list of Object.values(byRoom)) all.push(...list);
    if (all.length <= max) return null;
    // Keep exactly `max` object references: the newest by timestamp.
    const newest = [...all].sort((a, b) => b.ts - a.ts).slice(0, max);
    const keep = new Set<T>(newest);
    const next: Record<string, T[]> = {};
    for (const [roomId, list] of Object.entries(byRoom)) {
        const kept = list.filter((e) => keep.has(e));
        if (kept.length > 0) next[roomId] = kept;
    }
    return next;
}
