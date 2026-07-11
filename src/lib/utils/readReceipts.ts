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
