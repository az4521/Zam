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

/**
 * Whether an encrypted room's own (main-timeline) unread counts are stale: the
 * newest notification is one our receipt already covers, yet the counts are
 * still non-zero. The SDK races here: when the newest event decrypts before
 * our receipt is applied, it counts that event as unread, and nothing lowers
 * the count when the receipt lands (the server's zero only arrives on a later
 * room update). Callers zero the counts when this returns true.
 */
export function isStaleLocalUnread(input: {
    encrypted: boolean;
    total: number;
    highlight: number;
    /** Whether our receipt covers the newest loaded main-timeline notification event; null when none is loaded. */
    newestNotificationRead: boolean | null;
}): boolean {
    const { encrypted, total, highlight, newestNotificationRead } = input;
    return (
        encrypted &&
        (total > 0 || highlight > 0) &&
        newestNotificationRead === true
    );
}

/**
 * Whether our read receipt covers `event`, when the SDK may not be able to say.
 *
 * The SDK answers `sdkRead` by ordering the receipt's event against `event`.
 * It can only do that when the receipt's event is in a loaded timeline. A
 * receipt on a reaction whose parent message is not loaded (sliding sync
 * cold-starts a room with one event) is "homeless": the SDK places nothing, so
 * `receiptPlaced` is false and `sdkRead` is false too. Then the receipt's own
 * timestamp is the only evidence, the same rule hasUnreadMessages uses: a
 * receipt made at or after the event's time was sent after we saw the event.
 * A receipt without a timestamp (or a zero one) keeps the answer: not read.
 */
export function receiptCoversEvent(input: {
    /** The SDK says our receipt is at or after `event`. */
    sdkRead: boolean;
    /** The SDK could place our receipt in a loaded timeline. */
    receiptPlaced: boolean;
    /** Newest timestamp among our receipts, or null when we have none. */
    receiptTs: number | null;
    /** The event's origin timestamp. */
    eventTs: number;
}): boolean {
    const { sdkRead, receiptPlaced, receiptTs, eventTs } = input;
    if (sdkRead) return true;
    if (receiptPlaced) return false;
    return receiptTs !== null && receiptTs > 0 && receiptTs >= eventTs;
}
