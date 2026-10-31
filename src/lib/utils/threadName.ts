// src/lib/utils/threadName.ts
/**
 * Thread names (MSC4558, using its unstable identifiers). A name is a room
 * event that relates to the thread's root, encrypted in an encrypted room like
 * any other event:
 *
 *   type THREAD_NAME_EVENT_TYPE
 *   content { name, "m.relates_to": { rel_type: THREAD_NAME_REL_TYPE,
 *                                     event_id: <root event id> } }
 *
 * The relation stays in the clear on the wire, so whether a naming event is
 * valid (`mayNameThread`) never needs decrypting it, and servers can check and
 * bundle them. Few do yet, and federation can deliver invalid ones anyway, so
 * clients always check. The most recent valid event wins, in event-graph order
 * (never `origin_server_ts`); an empty name clears it. Other clients ignore
 * the event.
 */

import { coercePl } from "./powerLevels";

export const THREAD_NAME_EVENT_TYPE = "moe.crafty.matrix.thread_name";
export const THREAD_NAME_REL_TYPE = "moe.crafty.matrix.thread_name";
export const THREAD_NAME_PUSH_RULE_ID = "moe.crafty.rule.thread_name";

/** The `m.room.power_levels` key for the level that may name any thread. */
export const THREAD_NAME_POWER_LEVEL_KEY = "moe.crafty.matrix.thread_name";
export const DEFAULT_THREAD_NAME_LEVEL = 50;

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
 * The root a naming event targets, or null when `wireContent` has no naming
 * relation. Takes the wire content because that is where the relation lives
 * on an encrypted event. A missing or malformed `name` doesn't make the event
 * invalid: it means the thread has no name.
 */
export function threadNameTarget(wireContent: unknown): string | null {
    if (!wireContent || typeof wireContent !== "object") return null;
    const rel = (wireContent as Record<string, unknown>)["m.relates_to"] as
        Record<string, unknown> | undefined;
    if (!rel || rel.rel_type !== THREAD_NAME_REL_TYPE) return null;
    return typeof rel.event_id === "string" ? rel.event_id : null;
}

/**
 * The room's level for naming any thread, from its `m.room.power_levels`
 * content. Unlike `redact`, this is the same default with or without the event.
 */
export function threadNameLevel(powerLevels: unknown): number {
    const value = (powerLevels as Record<string, unknown> | null | undefined)?.[
        THREAD_NAME_POWER_LEVEL_KEY
    ];
    return coercePl(value, DEFAULT_THREAD_NAME_LEVEL);
}

/**
 * Whose naming events count: the root's sender (it's their thread), or anyone
 * at the room's thread name level.
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

/**
 * The first valid naming event for `rootEventId` in `events`, or null when
 * there is none. `events` must be newest first, which is how /relations
 * returns them (topological order). Nothing here reads the name, so this works
 * on events that are still encrypted.
 */
export function latestThreadNameEvent<
    T extends { sender?: string; content?: unknown },
>(
    rootEventId: string,
    events: T[],
    isAllowed: (senderId: string) => boolean,
): T | null {
    for (const event of events) {
        if (threadNameTarget(event.content) !== rootEventId) continue;
        if (isAllowed(event.sender ?? "")) return event;
    }
    return null;
}

/**
 * MSC4558's `.m.rule.thread_name`, as a rule of the user's own: servers don't
 * ship the default yet. An encrypted naming event otherwise matches
 * `.m.rule.encrypted`, and every rename would notify every member. It matches
 * the relation, which the server can see without decrypting anything.
 */
export function buildThreadNamePushRule() {
    return {
        ruleId: THREAD_NAME_PUSH_RULE_ID,
        kind: "override" as const,
        body: {
            conditions: [
                {
                    kind: "event_property_is",
                    key: "content.m\\.relates_to.rel_type",
                    value: THREAD_NAME_REL_TYPE,
                },
            ],
            actions: [],
        },
    };
}
