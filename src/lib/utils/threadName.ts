// src/lib/utils/threadName.ts
/**
 * Thread names, proposed as MSC4558. The Matrix spec has no way to name a
 * thread yet, so a name is an event of our own that relates to the thread's
 * root:
 *
 *   type THREAD_NAME_EVENT_TYPE
 *   content { name, "m.relates_to": { rel_type: THREAD_NAME_REL_TYPE,
 *                                     event_id: <root event id> } }
 *
 * The newest naming event from an allowed sender wins; an empty name clears
 * it. Anyone can send one, so the client decides whose count: the root's own
 * sender, or a moderator (`mayNameThread`). Other clients ignore the event.
 */

export const THREAD_NAME_EVENT_TYPE = "moe.crafty.matrix.thread_name";
export const THREAD_NAME_REL_TYPE = "moe.crafty.matrix.thread_name";

/** Longest name kept; longer input is cut (names show in one-line headers). */
export const MAX_THREAD_NAME_LENGTH = 100;

/**
 * Trim and cap the length of a name as typed. Whitespace inside the name is
 * kept as sent (MSC4558).
 */
export function normalizeThreadName(input: string): string {
    return input.trim().slice(0, MAX_THREAD_NAME_LENGTH).trimEnd();
}

/** The name in a naming event's content, or null when it clears the name. */
export function parseThreadName(content: unknown): string | null {
    if (!content || typeof content !== "object") return null;
    const name = (content as Record<string, unknown>).name;
    if (typeof name !== "string") return null;
    const cleaned = normalizeThreadName(name);
    return cleaned.length > 0 ? cleaned : null;
}

/** Content for a naming event; an empty name clears the thread's name. */
export function buildThreadNameContent(
    rootEventId: string,
    name: string,
): {
    name: string;
    "m.relates_to": { rel_type: string; event_id: string };
} {
    return {
        name: normalizeThreadName(name),
        "m.relates_to": {
            rel_type: THREAD_NAME_REL_TYPE,
            event_id: rootEventId,
        },
    };
}

/**
 * The root a naming event's content targets, or null when it isn't a
 * well-formed naming event (wrong relation, or no string `name`).
 */
export function threadNameTarget(content: unknown): string | null {
    if (!content || typeof content !== "object") return null;
    const c = content as Record<string, unknown>;
    if (typeof c.name !== "string") return null;
    const rel = c["m.relates_to"] as Record<string, unknown> | undefined;
    if (!rel || rel.rel_type !== THREAD_NAME_REL_TYPE) return null;
    return typeof rel.event_id === "string" ? rel.event_id : null;
}

/**
 * Whose naming events count: the root's sender (it's their thread), or anyone
 * at the room's moderator level (the level that may redact others' events).
 */
export function mayNameThread(params: {
    senderId: string;
    rootSenderId: string | null;
    senderPowerLevel: number;
    moderatorLevel: number;
}): boolean {
    if (params.rootSenderId !== null && params.senderId === params.rootSenderId)
        return true;
    return params.senderPowerLevel >= params.moderatorLevel;
}

export interface ThreadNameCandidate {
    eventId: string;
    senderId: string;
    ts: number;
    content: unknown;
}

export interface ResolvedThreadName {
    name: string | null;
    eventId: string;
    ts: number;
}

/**
 * The newest well-formed naming event for `rootEventId` from an allowed
 * sender, or null when there is none. Ties on timestamp keep input order
 * (the server returns newest first).
 */
export function latestThreadName(
    rootEventId: string,
    candidates: ThreadNameCandidate[],
    isAllowed: (senderId: string) => boolean,
): ResolvedThreadName | null {
    let best: ThreadNameCandidate | null = null;
    for (const c of candidates) {
        if (threadNameTarget(c.content) !== rootEventId) continue;
        if (!isAllowed(c.senderId)) continue;
        if (!best || c.ts > best.ts) best = c;
    }
    if (!best) return null;
    return {
        name: parseThreadName(best.content),
        eventId: best.eventId,
        ts: best.ts,
    };
}
