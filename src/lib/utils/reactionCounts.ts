/**
 * Pure reaction-counting core, extracted from `getReactions` so the dedupe and
 * own-reaction logic can be unit-tested without an SDK `Room`.
 *
 * Each annotation is the flattened form of an `m.reaction` (`m.annotation`)
 * relation: its sender, the reaction key, the event id, its send `status`
 * (truthy only for an unsent local echo), and whether it has been redacted.
 */
export interface ReactionAnnotation {
    sender: string | null;
    key: string;
    id: string | null;
    /** MatrixEvent.status — truthy while a local echo is still sending/unsent. */
    status: string | null;
    isRedacted: boolean;
}

export interface ReactionCount {
    key: string;
    count: number;
    isMine: boolean;
    myEventId: string | null;
    /** Deduped non-null senders for this key, first-seen order. */
    reactorIds: string[];
}

/**
 * Tally reactions by key.
 *
 * Matrix spec (v1.19 §"Server-side aggregation of `m.annotation`") requires a
 * client to treat multiple annotations from the *same* sender with the *same*
 * key as a SINGLE reaction — duplicates (e.g. re-sent over federation) MUST NOT
 * inflate the count. We enforce that with a `${sender} ${key}` seen-set: only
 * the first annotation from a given sender for a given key increments `count`.
 *
 * The own-reaction bookkeeping (`isMine` / `myEventId`) is intentionally
 * unchanged from the original inline implementation — it still runs for every
 * annotation, so a duplicate own reaction never alters highlighting or the id
 * used for removal.
 */
export function countReactions(
    annotations: ReactionAnnotation[],
    ownUserId: string | null,
): ReactionCount[] {
    const groups: Map<
        string,
        {
            count: number;
            isMine: boolean;
            myEventId: string | null;
            reactorIds: string[];
        }
    > = new Map();
    const seen = new Set<string>();

    for (const e of annotations) {
        if (e.isRedacted) continue;
        const key = e.key;
        if (!key) continue;
        const dedupeKey = `${e.sender} ${key}`;
        const counted = seen.has(dedupeKey);
        seen.add(dedupeKey);
        const existing = groups.get(key) ?? {
            count: 0,
            isMine: false,
            myEventId: null,
            reactorIds: [],
        };
        const isOwn = e.sender === ownUserId;
        groups.set(key, {
            count: counted ? existing.count : existing.count + 1,
            isMine: existing.isMine || isOwn,
            myEventId: isOwn && !e.status ? (e.id ?? null) : existing.myEventId,
            reactorIds:
                !counted && e.sender
                    ? [...existing.reactorIds, e.sender]
                    : existing.reactorIds,
        });
    }

    return Array.from(groups.entries()).map(
        ([key, { count, isMine, myEventId, reactorIds }]) => ({
            key,
            count,
            isMine,
            myEventId,
            reactorIds,
        }),
    );
}
