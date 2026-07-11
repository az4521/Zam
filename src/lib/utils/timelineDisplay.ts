// Pure display logic for the message timeline, written against events in
// chronological order (oldest first) — the natural DOM order of the list.

/** Structural subset of MatrixEvent the timeline display logic needs. */
export interface TimelineDisplayEvent {
    getId(): string | undefined;
    getSender(): string | undefined;
    getTs(): number;
}

const GROUP_WINDOW_MS = 5 * 60 * 1000;

/**
 * Whether the message at `index` starts a new visual group (avatar + name +
 * timestamp header). Consecutive messages from the same sender within five
 * minutes are grouped under one header.
 */
export function shouldShowHeader(
    events: TimelineDisplayEvent[],
    index: number,
): boolean {
    if (index === 0) return true;
    const prev = events[index - 1];
    const curr = events[index];
    if (prev.getSender() !== curr.getSender()) return true;
    return curr.getTs() - prev.getTs() > GROUP_WINDOW_MS;
}

function dayLabel(ts: number, now: Date): string {
    const d = new Date(ts);
    if (d.toDateString() === now.toDateString()) return "Today";
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

/**
 * Label for a date separator rendered ABOVE the message at `index`, or null
 * when the message continues the previous message's day. The label names the
 * day starting below the separator.
 */
export function dateSeparatorLabel(
    events: TimelineDisplayEvent[],
    index: number,
    now: Date = new Date(),
): string | null {
    const curr = events[index];
    if (index > 0) {
        const prev = events[index - 1];
        const sameDay =
            new Date(prev.getTs()).toDateString() ===
            new Date(curr.getTs()).toDateString();
        if (sameDay) return null;
    }
    return dayLabel(curr.getTs(), now);
}

/**
 * Whether the "New Messages" divider belongs directly above the message at
 * `index` — i.e. the previous message is the one the user has read up to.
 */
export function unreadDividerBefore(
    events: TimelineDisplayEvent[],
    index: number,
    readUpToEventId: string | null,
): boolean {
    if (!readUpToEventId || index === 0) return false;
    return events[index - 1].getId() === readUpToEventId;
}

/**
 * Whether a scroll position counts as "at the bottom" of a normal
 * top-to-bottom scroll container, within `slack` pixels.
 */
export function isNearBottom(
    scrollTop: number,
    clientHeight: number,
    scrollHeight: number,
    slack = 100,
): boolean {
    return scrollHeight - scrollTop - clientHeight < slack;
}
