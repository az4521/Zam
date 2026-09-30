// Reconciling the SDK's pending (local echo) list against the live timeline.
//
// With PendingEventOrdering.Detached the SDK keeps our own sends in a separate
// pending list and moves them into the timeline only when the remote echo is
// matched by `unsigned.transaction_id`. Two things break that:
//
//   1. The SDK persists the pending list to localStorage on every status
//      change, INCLUDING the SENT transition that rewrites the echo's id to the
//      real server event id. If the app is closed/killed before the remote echo
//      lands (a phone backgrounding the PWA right after sending is enough), the
//      reload restores that echo as NOT_SENT. It then renders as "failed" even
//      though the server has it, and once sync or pagination brings in the real
//      event both carry the same id.
//   2. Servers / sliding sync that omit `transaction_id` on the remote echo: the
//      SDK adds it to the timeline as a new event while the SENT echo (already
//      carrying the same real id) stays pending forever.
//
// Either way the rendered list gets two rows keyed by the same event id, and
// Svelte's keyed {#each} throws `each_key_duplicate`, taking the whole room's
// timeline down with it.
//
// Pure so it can be tested without an SDK; the caller applies the verdicts.

/** Local echo ids are `~<roomId>:<txnId>` until the server assigns a real one. */
export function isLocalEchoId(id: string | undefined | null): boolean {
    return !id || id.startsWith("~");
}

export type PendingEchoVerdict =
    /** Genuinely pending (or genuinely failed): render it. */
    | "keep"
    /** Already delivered; drop it from the SDK's pending list for good. */
    | "drop";

export function classifyPendingEcho(echo: {
    id: string | undefined | null;
    /** EventStatus value ("sending", "sent", "not_sent", ...). */
    status: string | null;
    /** The same event id is already present in the room's timeline. */
    inTimeline: boolean;
}): PendingEchoVerdict {
    // Still a local id: the server never confirmed it, nothing to reconcile.
    if (isLocalEchoId(echo.id)) return "keep";
    // The real copy is in the timeline: the echo is a stale duplicate.
    if (echo.inTimeline) return "drop";
    // A server-assigned id on a NOT_SENT echo can only come from the reload
    // restore described above: the send succeeded, so retrying would be wrong
    // and showing it as failed is a lie. It will arrive via sync/pagination.
    if (echo.status === "not_sent") return "drop";
    // SENT and waiting for its remote echo: the normal short-lived case.
    return "keep";
}

/** Keep the first occurrence of each event id, preserving order. A keyed
 *  {#each} over the result can never throw a duplicate-key error. */
export function dedupeById<T>(
    items: T[],
    idOf: (item: T) => string | undefined | null,
): T[] {
    const seen = new Set<string>();
    let dup = false;
    for (const item of items) {
        const id = idOf(item) ?? "";
        if (seen.has(id)) {
            dup = true;
            break;
        }
        seen.add(id);
    }
    if (!dup) return items;
    seen.clear();
    return items.filter((item) => {
        const id = idOf(item) ?? "";
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    });
}
