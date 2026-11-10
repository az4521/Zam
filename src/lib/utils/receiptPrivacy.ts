// Per-room / per-space read receipt privacy.
//
// "Read receipts off" means PRIVATE receipts (m.read.private): the server still
// tracks the read position, so unread counts and m.fully_read stay in sync, but
// other members cannot see it. The account-wide setting is the default
// (`privateReadReceipts`); a room or a space can override it either way. A
// space's override covers every room inside it.

/** A room's or space's choice. A missing entry means "use the default". */
export type ReceiptOverride = "public" | "private";

export type ReceiptOverrides = Record<string, ReceiptOverride>;

/** Parse the stored JSON, dropping anything that is not a known override. */
export function parseReceiptOverrides(raw: string | null): ReceiptOverrides {
    if (!raw) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
            return {};
        const out: ReceiptOverrides = {};
        for (const [id, v] of Object.entries(parsed)) {
            if (v === "public" || v === "private") out[id] = v;
        }
        return out;
    } catch {
        return {};
    }
}

/**
 * Whether receipts for `roomId` are private. The room's own override wins; else
 * its parent spaces' overrides (any "private" wins, so a room that sits in two
 * spaces with different choices fails closed); else `defaultPrivate`.
 */
export function isRoomReceiptPrivate(
    roomId: string,
    parentSpaceIds: readonly string[],
    overrides: ReceiptOverrides,
    defaultPrivate: boolean,
): boolean {
    const own = overrides[roomId];
    if (own) return own === "private";
    let sawPublic = false;
    for (const id of parentSpaceIds) {
        const o = overrides[id];
        if (o === "private") return true;
        if (o === "public") sawPublic = true;
    }
    return sawPublic ? false : defaultPrivate;
}

/**
 * The per-room map mirrored to the service worker and the Android notification
 * actions: only rooms whose effective value differs from `defaultPrivate`
 * (everything else follows the default they also receive).
 */
export function receiptPrivacyExceptions(
    rooms: readonly { roomId: string; parentSpaceIds: readonly string[] }[],
    overrides: ReceiptOverrides,
    defaultPrivate: boolean,
): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    if (Object.keys(overrides).length === 0) return out;
    for (const r of rooms) {
        const priv = isRoomReceiptPrivate(
            r.roomId,
            r.parentSpaceIds,
            overrides,
            defaultPrivate,
        );
        if (priv !== defaultPrivate) out[r.roomId] = priv;
    }
    return out;
}
