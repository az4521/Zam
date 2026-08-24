// Read-receipt wire types (Matrix spec §11.6). Kept SDK-free — client.ts casts
// the returned literal to matrix-js-sdk's ReceiptType enum (same string values).

export type ReadReceiptType = "m.read" | "m.read.private";

/**
 * Map the "private read receipts" client setting to the receipt type sent to
 * the homeserver. Private receipts (m.read.private) still clear the user's own
 * unread counts but are not shared with other room members.
 */
export function receiptTypeForSetting(
    privateReadReceipts: boolean,
): ReadReceiptType {
    return privateReadReceipts ? "m.read.private" : "m.read";
}

/**
 * Presentation ordering for read receipts: exclude the viewer, dedupe by userId
 * (keeping the latest ts), sort by ts descending (most recent first), tie-break
 * equal ts by userId ascending for determinism, then cap the visible list and
 * report overflow.
 *
 * Kept pure and SDK-free so it is unit-testable without a Room. Generic so it
 * preserves name/avatar fields while ordering by ts.
 */
export interface OrderedReadReceipts<T> {
    /** Receipts to display, most recent first, at most `cap`. */
    shown: T[];
    /** How many receipts are beyond `cap` (>= 0). */
    overflow: number;
}

export function orderReadReceipts<T extends { userId: string; ts: number }>(
    receipts: T[],
    ownUserId: string | null,
    cap = 3,
): OrderedReadReceipts<T> {
    // Exclude own user defensively (caller should already exclude, but be defensive).
    const withoutSelf = receipts.filter((r) => r.userId !== ownUserId);

    // Dedupe by userId, keeping the entry with the LATEST ts for that user.
    const deduped = new Map<string, T>();
    for (const receipt of withoutSelf) {
        const existing = deduped.get(receipt.userId);
        if (!existing || receipt.ts > existing.ts) {
            deduped.set(receipt.userId, receipt);
        }
    }

    // Sort by ts descending (most recent first), tie-break by userId ascending.
    const sorted = Array.from(deduped.values()).sort((a, b) => {
        if (a.ts !== b.ts) {
            return b.ts - a.ts; // descending
        }
        return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
    });

    return {
        shown: sorted.slice(0, cap),
        overflow: Math.max(0, sorted.length - cap),
    };
}
