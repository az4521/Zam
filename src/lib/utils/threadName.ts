// src/lib/utils/threadName.ts
/**
 * Thread names. The Matrix spec has no way to name a thread, so a name is a
 * room state event of our own: type THREAD_NAME_EVENT_TYPE, state_key the
 * thread root's event id, content `{ name }`. Being room state, it syncs to
 * every member, any member with the power level for the event type can rename
 * it, and other clients simply ignore it. An empty or missing name clears it.
 */

export const THREAD_NAME_EVENT_TYPE = "moe.crafty.matrix.thread_name";

/** Longest name kept; longer input is cut (names show in one-line headers). */
export const MAX_THREAD_NAME_LENGTH = 100;

/** Collapse whitespace, trim and cap the length of a name as typed. */
export function normalizeThreadName(input: string): string {
    return input
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_THREAD_NAME_LENGTH)
        .trim();
}

/** The name in a thread-name state event's content, or null when unnamed. */
export function parseThreadName(content: unknown): string | null {
    if (!content || typeof content !== "object") return null;
    const name = (content as Record<string, unknown>).name;
    if (typeof name !== "string") return null;
    const cleaned = normalizeThreadName(name);
    return cleaned.length > 0 ? cleaned : null;
}

/** State event content for a name; an empty name clears it. */
export function buildThreadNameContent(name: string): { name?: string } {
    const cleaned = normalizeThreadName(name);
    return cleaned.length > 0 ? { name: cleaned } : {};
}
