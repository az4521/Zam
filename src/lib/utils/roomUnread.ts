/** One loaded live-timeline event, as the unread check sees it. */
export interface UnreadEventView {
    id: string;
    ts: number;
    fromMe: boolean;
    /** A message-like event that makes a room unread (see isNotificationEvent). */
    isNotification: boolean;
}

/**
 * Whether a room has unread messages, for rooms the server counts nothing in
 * (muted, mentions-only), where only the timeline and our read receipt can
 * tell.
 *
 * `readUpToId` is the receipt's event when it is loaded. When it isn't, the
 * receipt points at an event outside the loaded window: usually an older one
 * (sliding sync loads a single event per list room, so this is the norm
 * there, and classic sync hits it after more than a page of new messages), or
 * one kept out of the timeline (a reaction). Either way the receipt's own
 * timestamp still says when we last read, so a message from someone else that
 * is newer than it is unread. A receipt without a timestamp keeps the old
 * answer: read.
 */
export function hasUnreadMessages(input: {
    /** The loaded live timeline, oldest first. */
    events: UnreadEventView[];
    readUpToId: string | null;
    /** Newest timestamp among our receipts, or null when we have none. */
    receiptTs: number | null;
}): boolean {
    const { events, readUpToId, receiptTs } = input;
    if (events[events.length - 1]?.fromMe) return false;

    if (!readUpToId && receiptTs !== null) {
        if (!(receiptTs > 0)) return false;
        for (let i = events.length - 1; i >= 0; i--) {
            const event = events[i];
            if (event.isNotification && !event.fromMe)
                return event.ts > receiptTs;
        }
        return false;
    }

    for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i];
        if (event.id === readUpToId) return false;
        if (event.isNotification) return true;
    }
    return false;
}
