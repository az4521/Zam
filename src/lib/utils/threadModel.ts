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

/**
 * Root event id when a relation makes this event a thread REPLY, else null.
 *
 * The inverse of `belongsToMainTimeline`, extracted so the notification path's
 * main-vs-thread classification is pinned by tests rather than living
 * untestably inside the SDK wrapper. A malformed self-referential `m.thread`
 * relation, or one with no `event_id`, is a main-timeline event and yields null
 * — exactly what `belongsToMainTimeline` decides, by construction.
 */
export function threadReplyRootId(params: {
    relatesTo: { rel_type?: string; event_id?: string } | undefined;
    eventId: string;
}): string | null {
    if (belongsToMainTimeline(params)) return null;
    return params.relatesTo?.event_id ?? null;
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
