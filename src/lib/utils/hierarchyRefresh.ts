/**
 * Pure scheduling policy for `/hierarchy` fetches.
 *
 * Master re-fetched the active space's (paginated!) hierarchy on a 2 s timer
 * that was re-armed by every sync, so an open space issued a request roughly
 * every two seconds forever. This replaces the poll with: invalidate when the
 * local `m.space.child` state actually changes, plus a TTL floor for the parts
 * of the response that are not in local state (member counts, unjoined room
 * names), plus in-flight coalescing and request generations.
 */

/** Floor for remote-only drift. Master's effective cadence was 2 000 ms. */
export const HIERARCHY_TTL_MS = 5 * 60_000;

export interface HierarchyTarget {
    spaceId: string;
    parentSpaceId: string | null;
    drillDepth: number;
    /** Signature of the space's own m.space.child state. */
    childSignature: string;
    /** Signature of the drill parent's child state ("" when there is none). */
    parentSignature: string;
}

export function hierarchyKey(t: HierarchyTarget): string {
    return [
        t.spaceId,
        t.parentSpaceId ?? "",
        String(t.drillDepth),
        t.childSignature,
        t.parentSignature,
    ].join("\u0000");
}

export interface FetchDecisionInput {
    key: string;
    /** Key of the request currently in flight, if any. */
    inFlightKey: string | null;
    lastAppliedKey: string | null;
    lastAppliedAt: number | null;
    now: number;
    ttlMs: number;
    /** The user just opened/drilled this space — always refresh. */
    force: boolean;
}

export function shouldFetchHierarchy(i: FetchDecisionInput): boolean {
    if (i.inFlightKey !== null && i.inFlightKey === i.key) return false;
    if (i.force) return true;
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
