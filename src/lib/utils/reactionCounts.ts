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

/** Longer keys are never real emoji; they are skipped, not rendered. */
const MAX_REACTION_KEY_LENGTH = 256;

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
        // Keys come from remote events: a non-string would throw during render
        // and an oversized one is not an emoji, so both are skipped.
        const key: unknown = e.key;
        if (
            typeof key !== "string" ||
            !key ||
            key.length > MAX_REACTION_KEY_LENGTH
        )
            continue;
        const dedupeKey = `${e.sender} ${key}`;
        const counted = seen.has(dedupeKey);
        seen.add(dedupeKey);
        let group = groups.get(key);
        if (!group) {
            group = {
                count: 0,
                isMine: false,
                myEventId: null,
                reactorIds: [],
            };
            groups.set(key, group);
        }
        const isOwn = e.sender === ownUserId;
        if (!counted) {
            group.count += 1;
            if (e.sender) group.reactorIds.push(e.sender);
        }
        group.isMine = group.isMine || isOwn;
        if (isOwn && !e.status) group.myEventId = e.id ?? null;
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
