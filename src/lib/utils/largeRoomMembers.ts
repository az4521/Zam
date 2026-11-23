/**
 * Pure helpers for large rooms (Discord-style member handling).
 *
 * Loading every member of a 10k-member room costs ~20 MB of SDK objects, so
 * big rooms only materialise the members that matter: role holders, recent
 * senders, the logged-in user, and anyone found through a directory search.
 * Nothing here imports the SDK; `client.ts` feeds these with SDK data.
 */

/** A room with at least this many joined members is treated as large. */
export const LARGE_ROOM_MEMBERS = 500;

export function isLargeRoomCount(joined: number): boolean {
    return joined >= LARGE_ROOM_MEMBERS;
}

export type ActivityPresence =
    "online" | "unavailable" | "busy" | "offline" | null;

/**
 * Sort rank for the member list. Lower is shown first:
 * 0 rich presence (playing, listening, ...), 1 online, 2 busy,
 * 3 unavailable (away), 4 offline or unknown. Rich presence wins over the
 * presence state, so a member playing a game ranks 0 even when offline.
 */
export function activityRank(
    presence: ActivityPresence,
    hasRichPresence: boolean,
): number {
    if (hasRichPresence) return 0;
    switch (presence) {
        case "online":
            return 1;
        case "busy":
            return 2;
        case "unavailable":
            return 3;
        default:
            return 4;
    }
}

/**
 * Discord-style large-room member filter. Keeps role holders, anyone with an
 * activity rank below 4 (i.e. not offline), recent senders and the logged-in
 * user. Drops everyone else. Keeps the input order.
 */
export function pickLargeRoomMembers<T extends { userId: string }>(opts: {
    members: readonly T[];
    isRoleHolder: (userId: string) => boolean;
    rank: (userId: string) => number;
    recentSenders: ReadonlySet<string>;
    selfId: string | null;
}): T[] {
    const { members, isRoleHolder, rank, recentSenders, selfId } = opts;
    return members.filter(
        (m) =>
            m.userId === selfId ||
            recentSenders.has(m.userId) ||
            isRoleHolder(m.userId) ||
            rank(m.userId) < 4,
    );
}

/**
 * The ids that still need loading: deduplicated, with those `has` already
 * knows dropped, capped at `limit`, in first-seen order.
 */
export function missingMemberIds(
    ids: Iterable<string>,
    has: (userId: string) => boolean,
    limit: number,
): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of ids) {
        if (out.length >= limit) break;
        if (seen.has(id)) continue;
        seen.add(id);
        if (has(id)) continue;
        out.push(id);
    }
    return out;
}
