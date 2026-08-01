/**
 * Pure scheduling policy for `/hierarchy` fetches.
 *
 * Master re-fetched the active space's (paginated!) hierarchy on a 2 s timer
 * that was re-armed by every sync, so an open space issued a request roughly
 * every two seconds forever. This replaces the poll with: invalidate when the
 * local `m.space.child` state actually changes, plus a TTL floor for the parts
 * of the response that are not in local state (member counts, unjoined room
 * names), plus in-flight coalescing, request generations, and a backoff so a
 * failing space cannot re-attempt on every sync.
 */

/** Floor for remote-only drift. Master's effective cadence was 2 000 ms. */
export const HIERARCHY_TTL_MS = 5 * 60_000;

/**
 * Floor between two attempts at a key that just failed. Without it a
 * persistently failing space (a 403 with no parent to walk in through, a 429,
 * a 5xx) re-attempts on every sync response — a failure deliberately records
 * no applied key — which is faster than the poll this replaces.
 */
export const HIERARCHY_FAILURE_BACKOFF_MS = 30_000;

export interface HierarchyTarget {
    spaceId: string;
    parentSpaceId: string | null;
    drillDepth: number;
    /** Signature of the space's own m.space.child state. */
    childSignature: string;
    /** Signature of the drill parent's child state ("" when there is none). */
    parentSignature: string;
    /**
     * How many children of this space we have joined. `isJoined` is baked into
     * the /hierarchy response at fetch time and joining a room fires no
     * m.space.child event, so nothing else notices a join or leave that
     * happened on another device.
     */
    joinedChildCount: number;
}

export function hierarchyKey(t: HierarchyTarget): string {
    return [
        t.spaceId,
        t.parentSpaceId ?? "",
        String(t.drillDepth),
        t.childSignature,
        t.parentSignature,
        String(t.joinedChildCount),
    ].join("\u0000");
}

export interface FetchDecisionInput {
    key: string;
    /** Key of the request currently in flight, if any. */
    inFlightKey: string | null;
    lastAppliedKey: string | null;
    lastAppliedAt: number | null;
    /** Key of the most recent FAILED attempt, if any. */
    lastFailedKey: string | null;
    lastFailedAt: number | null;
    failureBackoffMs: number;
    now: number;
    ttlMs: number;
    /** The user just opened/drilled this space — always refresh. */
    force: boolean;
}

export function shouldFetchHierarchy(i: FetchDecisionInput): boolean {
    if (i.inFlightKey !== null && i.inFlightKey === i.key) return false;
    // `force` outranks the backoff: a user-driven open is allowed to retry a
    // failing space immediately, and it is the only way out of a backoff the
    // user can see (the spinner belongs to that open).
    if (i.force) return true;
    if (
        i.lastFailedKey === i.key &&
        i.lastFailedAt !== null &&
        i.now - i.lastFailedAt < i.failureBackoffMs
    )
        return false;
    if (i.lastAppliedKey !== i.key) return true;
    if (i.lastAppliedAt === null) return true;
    return i.now - i.lastAppliedAt >= i.ttlMs;
}

export interface ResultDecisionInput {
    requestGeneration: number;
    latestGeneration: number;
    requestSpaceId: string;
    activeSpaceId: string | null;
    /** The fetch failed, as opposed to returning a genuinely empty space. */
    failed: boolean;
}

/**
 * "drop" must NOT clear the loading flag — a newer request owns it.
 * "keep-previous" clears loading but leaves the on-screen hierarchy alone, so a
 * transient failure cannot blank a sidebar that used to be correct.
 */
export function hierarchyResultAction(
    i: ResultDecisionInput,
): "apply" | "drop" | "keep-previous" {
    if (i.requestGeneration !== i.latestGeneration) return "drop";
    if (i.activeSpaceId !== i.requestSpaceId) return "drop";
    return i.failed ? "keep-previous" : "apply";
}
