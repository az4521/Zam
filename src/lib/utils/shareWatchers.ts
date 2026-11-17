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
