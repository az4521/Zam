/**
 * Local "read mark" for a room whose server notification counts have not caught
 * up with our own read receipt yet.
 *
 * The server's unread and highlight counts only drop after the receipt POST
 * lands AND a later sync reports the new counts. On a high-latency link that
 * can be seconds, during which a room the user just read keeps showing unread.
 * The mark remembers the counts we saw when the receipt went out, and the
 * verdict says whether those counts are still the stale ones.
 */
export interface LocalReadMark {
    total: number;
    highlight: number;
    /** Timestamp (ms) of the event the receipt pointed at. */
    ts: number;
}

/**
 * "suppress": the server counts are the ones we saw when we read the room and no
 * newer message has come in, so they are stale and should be ignored.
 * "settled": the server has moved on (or a newer message arrived); drop the mark
 * and trust the counts.
 *
 * The test is "unchanged". A sync that predates our receipt still reports the
 * old counts, so they match the mark and stay suppressed. A sync that follows
 * the receipt reports lower counts, and a new message raises them; either way
 * they differ from the mark, so the server has caught up. A receipt and a new
 * message landing in the same sync can leave the counts unchanged, so the
 * newest message from someone else is checked against the mark's timestamp too.
 * Zero counts are always settled: there is nothing left to suppress.
 */
export function localReadVerdict(
    mark: LocalReadMark,
    counts: { total: number; highlight: number },
    newestOtherNotificationTs: number | null,
): "suppress" | "settled" {
    if (counts.total === 0 && counts.highlight === 0) return "settled";
    if (counts.total !== mark.total || counts.highlight !== mark.highlight)
        return "settled";
    if (
        newestOtherNotificationTs !== null &&
        newestOtherNotificationTs > mark.ts
    )
        return "settled";
    return "suppress";
}
