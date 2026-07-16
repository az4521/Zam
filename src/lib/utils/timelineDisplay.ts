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

/**
 * The timestamp a date separator should be rendered for ABOVE the message at
 * `index`, or null when the message continues the previous message's day. The
 * caller formats it (see timeFormat.daySeparator) — this keeps only the "is
 * this a new day" decision, so timestamp-format settings don't reach here.
 */
export function dateSeparatorLabel(
    events: TimelineDisplayEvent[],
    index: number,
): number | null {
    const curr = events[index];
    if (index > 0) {
        const prev = events[index - 1];
        const sameDay =
            new Date(prev.getTs()).toDateString() ===
            new Date(curr.getTs()).toDateString();
        if (sameDay) return null;
    }
    return curr.getTs();
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
