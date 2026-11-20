/**
 * Who is watching whose screen share, as the call publishes it. Each client
 * sets the participant attribute `zam.watching` to the JSON array of the
 * sharer identities it is watching; this module encodes and reads that value
 * and answers "who watches this share". No LiveKit import, so it is testable.
 */
import { identityToUserId } from "$lib/utils/voiceCall";

/** The participant attribute holding the sharers a client is watching. */
export const WATCHING_ATTRIBUTE = "zam.watching";

/** Watcher identity ("@user:server:DEVICE") to the sharer identities it
 *  watches. Our own entry is included, keyed by our identity. */
export type WatchingMap = Record<string, string[]>;

/** Sorted, deduped JSON array of sharer identities. */
export function encodeWatchingAttribute(identities: readonly string[]): string {
    return JSON.stringify([...new Set(identities)].sort());
}

/** A participant's watching list; empty when unset or not a list (not Zam,
 *  or a bad value). Non-string entries are dropped. */
export function parseWatchingAttribute(value: string | undefined): string[] {
    if (!value) return [];
    try {
        const parsed: unknown = JSON.parse(value);
        if (!Array.isArray(parsed)) return [];
        const ids = parsed.filter((id): id is string => typeof id === "string");
        return [...new Set(ids)].sort();
    } catch {
        return [];
    }
}

/** One remote participant as a LiveKit room reports it: identity and its
 *  `zam.watching` attribute, if set. */
export interface WatchingSnapshot {
    identity: string;
    attribute?: string;
}

/**
 * The watching map for a call from every room it spans (the publishing SFU,
 * remote SFUs, each one's participants). A watcher present in several rooms
 * counts the union of what it announced; a watcher who left every room is
 * gone; one who rejoins reappears with whatever it announces. Our own entry
 * comes from our own state, not from any room's echo of it.
 */
export function buildWatchingMap(
    rooms: readonly (readonly WatchingSnapshot[])[],
    own: { identity: string; shares: readonly string[] } | null,
): WatchingMap {
    const merged = new Map<string, Set<string>>();
    for (const room of rooms)
        for (const p of room) {
            const shares = merged.get(p.identity) ?? new Set<string>();
            for (const id of parseWatchingAttribute(p.attribute))
                shares.add(id);
            merged.set(p.identity, shares);
        }
    const watching: WatchingMap = {};
    for (const [identity, shares] of merged)
        watching[identity] = [...shares].sort();
    if (own?.identity) watching[own.identity] = [...new Set(own.shares)].sort();
    return watching;
}

/** The distinct users watching the share of `shareIdentity`, sorted by user
 *  id. The sharer's own user is not counted as a viewer of their share. */
export function shareViewers(
    watching: WatchingMap,
    shareIdentity: string,
): string[] {
    const sharerUser = identityToUserId(shareIdentity);
    const users = new Set<string>();
    for (const [watcher, shares] of Object.entries(watching)) {
        if (!shares.includes(shareIdentity)) continue;
        const user = identityToUserId(watcher);
        if (user !== sharerUser) users.add(user);
    }
    return [...users].sort();
}

/** The first `max` viewers to draw as avatars, and how many are left over for
 *  a "+N". Keeps a small thumbnail's stack inside its box. */
export function watcherSlots(
    viewers: readonly string[],
    max: number,
): { shown: string[]; extra: number } {
    const cap = Math.max(0, Math.floor(max));
    const shown = viewers.slice(0, cap);
    return { shown, extra: viewers.length - shown.length };
}
