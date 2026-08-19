/**
 * Presentation ordering for a reaction's reactor list: put the viewer first,
 * then cap the visible list, reporting how many were hidden.
 *
 * The reactor userIds come from `countReactions().reactorIds` (already deduped
 * by sender+key); the extra `Set` here is defensive only. Kept pure and SDK-free
 * so it is unit-testable without a `Room`.
 */
export interface OrderedReactors {
    /** userIds to display, viewer first, at most `cap`. */
    shown: string[];
    /** how many reactors are beyond `cap` (>= 0). */
    overflow: number;
}

export function orderReactors(
    reactorIds: string[],
    ownUserId: string | null,
    cap = 20,
): OrderedReactors {
    const deduped = Array.from(new Set(reactorIds));
    const ordered =
        ownUserId && deduped.includes(ownUserId)
            ? [ownUserId, ...deduped.filter((id) => id !== ownUserId)]
            : deduped;
    return {
        shown: ordered.slice(0, cap),
        overflow: Math.max(0, ordered.length - cap),
    };
}
