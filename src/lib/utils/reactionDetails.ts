/**
 * Pure model for the reactions viewer: every reactor of a message, grouped by
 * reaction key, with when they reacted and which event to redact to take it
 * back. SDK-free so it can be tested without a `Room`.
 */
export interface ReactionRecord {
    sender: string | null;
    key: string;
    /** origin_server_ts of the reaction event (0 when unknown). */
    ts: number;
    id: string | null;
    /** MatrixEvent.status: truthy while a local echo is still sending. */
    status: string | null;
    isRedacted: boolean;
}

export interface ReactorDetail {
    userId: string;
    ts: number;
    /** Reaction event id, or null while a local echo has none yet. */
    eventId: string | null;
    pending: boolean;
}

export interface ReactionDetailGroup {
    key: string;
    count: number;
    /** Newest first; ties by user id so the order is stable. */
    reactors: ReactorDetail[];
}

function usableTs(ts: number): number {
    return Number.isFinite(ts) && ts > 0 ? ts : 0;
}

/**
 * Group reactions by key. A sender reacting twice with the same key counts
 * once (the spec's dedupe; the newest event wins). Groups run most-used first.
 */
export function groupReactionDetails(
    records: ReactionRecord[],
): ReactionDetailGroup[] {
    const seen = new Map<string, ReactorDetail & { key: string }>();
    for (const r of records) {
        if (r.isRedacted || !r.key || !r.sender) continue;
        const ts = usableTs(r.ts);
        const id = `${r.sender} ${r.key}`;
        const prev = seen.get(id);
        if (prev && ts < prev.ts) continue;
        seen.set(id, {
            key: r.key,
            userId: r.sender,
            ts,
            eventId: r.id,
            pending: !!r.status,
        });
    }
    const byKey = new Map<string, ReactorDetail[]>();
    for (const { key, ...reactor } of seen.values()) {
        const list = byKey.get(key) ?? [];
        list.push(reactor);
        byKey.set(key, list);
    }
    const groups: ReactionDetailGroup[] = [];
    for (const [key, reactors] of byKey) {
        reactors.sort(
            (a, b) =>
                b.ts - a.ts ||
                (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0),
        );
        groups.push({ key, count: reactors.length, reactors });
    }
    groups.sort(
        (a, b) =>
            b.count - a.count || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
    );
    return groups;
}

/** The tab to open on: the viewer's own reaction if they have one, else the
 *  most used. */
export function initialReactionKey(
    groups: ReactionDetailGroup[],
    ownUserId: string | null,
): string | null {
    if (groups.length === 0) return null;
    const mine = ownUserId
        ? groups.find((g) => g.reactors.some((r) => r.userId === ownUserId))
        : undefined;
    return (mine ?? groups[0]).key;
}
