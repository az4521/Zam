/**
 * Which posted OS notifications should now be closed.
 *
 * Message notifications are collapsed per room (one live notification per
 * room, showing its most recent message), so the unit of dismissal is a room.
 * A room's notification is stale once the user has read everything it covers —
 * on ANY device, since read receipts are account-wide — or once they open that
 * room here.
 *
 * Pure by design: the caller resolves "has this been read" through the SDK
 * (`Room.hasUserReadEvent`) and passes the answers in, so the rule itself is
 * testable and lives in exactly one place.
 *
 * Direction of safety: failing to close a notification is what the app did
 * before this existed and is merely untidy. Closing one the user has NOT read
 * hides a message from them. Every ambiguous case below keeps it open.
 */

/**
 * How many event ids a single room-collapsed notification remembers.
 *
 * Bounded so a room the user never reads cannot grow without limit. Dropping
 * the OLDEST id is safe: Matrix read receipts are positional, so a receipt
 * that covers a newer event covers every dropped one too.
 */
export const POSTED_EVENT_CAP = 20;

export interface PostedNotificationEntry {
    roomId: string;
    /** Events this room's live notification has covered, oldest first. */
    eventIds: readonly string[];
}

export interface NotificationsToCloseInput {
    posted: readonly PostedNotificationEntry[];
    /** Of the ids in `posted`, the ones the user has demonstrably read. */
    readEventIds: ReadonlySet<string>;
    /** The room now on screen here, if any — opening it counts as reading it. */
    openRoomId?: string | null;
}

/** Room ids whose notification is now stale, deduped, in input order. */
export function notificationsToClose({
    posted,
    readEventIds,
    openRoomId = null,
}: NotificationsToCloseInput): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const entry of posted) {
        if (seen.has(entry.roomId)) continue;
        const isOpenHere = !!openRoomId && entry.roomId === openRoomId;
        // `every` on an empty list is true, which would close a notification
        // nothing proves is read — require at least one covered event.
        const allRead =
            entry.eventIds.length > 0 &&
            entry.eventIds.every((id) => readEventIds.has(id));
        if (!isOpenHere && !allRead) continue;
        seen.add(entry.roomId);
        out.push(entry.roomId);
    }
    return out;
}

/** Record one more event against a room's notification, oldest-first, capped. */
export function appendPostedEventId(
    existing: readonly string[],
    eventId: string,
    cap: number = POSTED_EVENT_CAP,
): string[] {
    if (existing.includes(eventId)) return [...existing];
    const next = [...existing, eventId];
    return next.length > cap ? next.slice(next.length - cap) : next;
}
