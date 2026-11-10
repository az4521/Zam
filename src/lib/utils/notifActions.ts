// Canonical notification-action shapes. static/sw.js is NOT bundled and hand-mirrors messageNotificationActions()/classifyNotificationAction — change one, change both.
import { t } from "$lib/i18n";

export interface NotifAction {
    action: string;
    title: string;
    type?: "text";
    placeholder?: string;
}

export type NotifClick =
    | { kind: "reply"; text: string }
    | { kind: "markread" }
    | { kind: "open" }
    | { kind: "other" };

export function messageNotificationActions(): NotifAction[] {
    return [
        {
            action: "reply",
            type: "text",
            title: t("notifActions.reply"),
            placeholder: t("notifActions.reply2"),
        },
        { action: "markread", title: t("notifActions.markAsRead") },
    ];
}

export function classifyNotificationAction(
    action: string | undefined,
    replyText: string | undefined,
): NotifClick {
    if (action === "reply") {
        const trimmed = replyText?.trim();
        if (trimmed) {
            return { kind: "reply", text: trimmed };
        }
        return { kind: "open" };
    }
    if (action === "markread") {
        return { kind: "markread" };
    }
    return { kind: "other" };
}

export type ReadReceiptType = "m.read" | "m.read.private";

export function buildReadReceiptPath(
    roomId: string,
    eventId: string,
    receiptType: ReadReceiptType,
): string {
    return `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/receipt/${receiptType}/${encodeURIComponent(eventId)}`;
}

export const RECEIPT_ROOM_PRIVACY_MAX = 5000;
export const RECEIPT_ROOM_ID_MAX = 255;

/**
 * Validate one account's per-room receipt privacy map ({ roomId: bool }, true =
 * private). Keeps only string keys starting with "!" (<= 255 chars) whose value
 * is a boolean; anything else is dropped. Not a plain object, or over the entry
 * cap → {}. Mirrors parseReceiptRoomPrivacy in static/sw.js.
 */
export function parseReceiptRoomPrivacy(raw: unknown): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
    const r = raw as Record<string, unknown>;
    const keys = Object.keys(r);
    if (keys.length > RECEIPT_ROOM_PRIVACY_MAX) return out;
    for (const key of keys) {
        const value = r[key];
        if (typeof value !== "boolean") continue;
        if (!key.startsWith("!") || key.length > RECEIPT_ROOM_ID_MAX) continue;
        out[key] = value;
    }
    return out;
}

/**
 * Determine the receipt type to use when sending a read receipt from the SW.
 * A per-room entry (roomPrivacy[roomId], this user's map) wins when present;
 * otherwise "m.read" ONLY when the user has explicitly opted for public receipts
 * (privacyByUser[userId] === false). Fail closed: unknown user, missing map,
 * junk value, or null userId → "m.read.private".
 */
export function swReceiptTypeFor(
    privacyByUser: Record<string, boolean> | null | undefined,
    userId: string | null | undefined,
    roomId?: string | null,
    roomPrivacy?: Record<string, boolean> | null,
): ReadReceiptType {
    if (!userId) return "m.read.private";
    if (
        typeof roomId === "string" &&
        roomPrivacy &&
        typeof roomPrivacy[roomId] === "boolean"
    ) {
        return roomPrivacy[roomId] ? "m.read.private" : "m.read";
    }
    if (!privacyByUser) return "m.read.private";
    return privacyByUser[userId] === false ? "m.read" : "m.read.private";
}

export function ringNotificationTag(roomId: string): string {
    return `call:${roomId}`;
}

export function messageNotificationTag(roomId: string): string {
    return roomId;
}

export function roomNotificationTags(roomId: string): string[] {
    return [roomId, `call:${roomId}`];
}

/**
 * Whether a notification's data matches a specific ring event (for auto-dismiss).
 */
export function isRingToDismiss(data: unknown, ringEventId: string): boolean {
    if (!data || typeof data !== "object") return false;
    const d = data as Record<string, unknown>;
    return d.isCall === true && d.eventId === ringEventId;
}

// Quick-reply stash: storing reply text in IDB when the page isn't open.
export const QUICK_REPLY_STASH_PREFIX = "notif_reply:";
export const QUICK_REPLY_STASH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function quickReplyStashKey(id: string): string {
    return `${QUICK_REPLY_STASH_PREFIX}${id}`;
}

export interface QuickReplyStash {
    id: string;
    roomId: string;
    eventId: string | null;
    text: string;
    userId: string;
    ts: number;
}

/**
 * Build a quick-reply stash record. Returns null if any required field is missing
 * or if text is blank after trimming.
 */
export function buildQuickReplyStash(params: {
    id: string;
    roomId: string;
    eventId: string | null | undefined;
    text: string;
    userId: string;
    ts: number;
}): QuickReplyStash | null {
    const trimmed = params.text.trim();
    if (!params.roomId || !trimmed || !params.userId) return null;
    return {
        id: params.id,
        roomId: params.roomId,
        // Normalise a missing event id to null so parseQuickReplyStash accepts it.
        eventId: params.eventId || null,
        text: trimmed,
        userId: params.userId,
        ts: params.ts,
    };
}

/**
 * Parse and validate a quick-reply stash from raw storage. Returns null if:
 * - wrong types
 * - blank text
 * - older than TTL
 * - timestamp in the future by > 5 minutes
 */
export function parseQuickReplyStash(
    raw: unknown,
    now: number,
): QuickReplyStash | null {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    if (
        typeof r.id !== "string" ||
        typeof r.roomId !== "string" ||
        (r.eventId !== null && typeof r.eventId !== "string") ||
        typeof r.text !== "string" ||
        typeof r.userId !== "string" ||
        typeof r.ts !== "number"
    ) {
        return null;
    }
    const trimmed = r.text.trim();
    if (!trimmed) return null;
    // Expired (older than TTL)
    if (now - r.ts > QUICK_REPLY_STASH_TTL_MS) return null;
    // Future timestamp (> 5 min ahead)
    if (r.ts - now > 5 * 60 * 1000) return null;
    return {
        id: r.id,
        roomId: r.roomId,
        eventId: r.eventId,
        text: trimmed,
        userId: r.userId,
        ts: r.ts,
    };
}

/**
 * Partition quick-reply stash entries: return valid entries for the given user
 * (sorted by ts) plus all keys to delete (taken entries + invalid/expired).
 * Other users' valid entries are left untouched.
 */
export function partitionQuickReplyStashes(
    entries: { key: string; value: unknown }[],
    userId: string,
    now: number,
): { take: QuickReplyStash[]; deleteKeys: string[] } {
    const take: QuickReplyStash[] = [];
    const deleteKeys: string[] = [];

    for (const { key, value } of entries) {
        const parsed = parseQuickReplyStash(value, now);
        if (!parsed) {
            // Invalid or expired → delete
            deleteKeys.push(key);
        } else if (parsed.userId === userId) {
            // Valid and for this user → take and delete
            take.push(parsed);
            deleteKeys.push(key);
        }
        // else: other user's valid entry → leave alone
    }

    // Sort by timestamp ascending (oldest first)
    take.sort((a, b) => a.ts - b.ts);
    return { take, deleteKeys };
}
