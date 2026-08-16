/**
 * Decide whether a stored loud-notification counts as read (and so should be
 * dropped from the red-dot store).
 *
 * `hasReadEvent` (the SDK's `Room.hasUserReadEvent`) is authoritative WHILE the
 * event is still in a loaded timeline. But it returns false for any event that
 * has aged out of the loaded window — the SDK can't locate it to compare
 * against the read receipt — so on its own it leaves those entries stuck
 * forever, keeping a room's red mention dot lit even after it's been read and
 * "mark as read" pressed. The ts fallback fixes that: the user's latest read
 * receipt carries a timestamp, and any notification whose event predates it has
 * necessarily been read past, no loaded event required.
 */
export function isLoudNotificationRead(
    n: { eventId: string; ts: number },
    ctx: {
        hasReadEvent: (eventId: string) => boolean;
        readReceiptTs: number | null;
    },
): boolean {
    let read = false;
    try {
        read = ctx.hasReadEvent(n.eventId);
    } catch {
        read = false;
    }
    if (!read && ctx.readReceiptTs != null && n.ts <= ctx.readReceiptTs) {
        read = true;
    }
    return read;
}
