// src/lib/utils/threadModel.ts
/**
 * Whether an event belongs in the MAIN room timeline (as opposed to being a
 * thread reply diverted into a per-thread timeline).
 *
 * With `threadSupport: true` the SDK already keeps `m.thread` replies out of the
 * main live timeline; this is the ⚑4 defensive backstop for Conduit-family
 * servers that deliver related events out of order. The decision is purely about
 * the relation: an `m.thread` relation whose `event_id` names a DIFFERENT event
 * (its root) is a reply and leaves the main view; everything else stays.
 */
export function belongsToMainTimeline(params: {
    relatesTo: { rel_type?: string; event_id?: string } | undefined;
    eventId: string;
}): boolean {
    const rel = params.relatesTo;
    if (
        rel?.rel_type === "m.thread" &&
        rel.event_id &&
        rel.event_id !== params.eventId
    ) {
        return false;
    }
    return true;
}

export interface ThreadSummary {
    count: number;
    latestEventId: string | null;
    latestTs: number;
}

/**
 * Pure shape mapper from a live `Thread`'s fields to the wrapper's stable
 * `{count, latestEventId, latestTs}` summary, so `getThreadSummary` stays
 * trivially testable independent of the SDK object.
 */
export function summarizeThread(input: {
    length: number;
    latestEventId: string | null;
    latestTs: number;
}): ThreadSummary {
    return {
        count: input.length,
        latestEventId: input.latestEventId,
        latestTs: input.latestTs,
    };
}

/**
 * Exact value equality for a ThreadSummary.
 *
 * `summarizeThread` mints a fresh object on every call, and Svelte's `$derived`
 * invalidates dependents on referential inequality — so a per-row summary
 * recomputed on every sync re-rendered every row's thread chip even when
 * nothing about the thread had moved. Callers compare with this and keep the
 * previous reference when it returns true. Same fix as `sameShield`.
 */
export function sameThreadSummary(
    a: ThreadSummary | null,
    b: ThreadSummary | null,
): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    return (
        a.count === b.count &&
        a.latestEventId === b.latestEventId &&
        a.latestTs === b.latestTs
    );
}
