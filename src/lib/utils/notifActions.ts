// Canonical notification-action shapes. static/sw.js is NOT bundled and hand-mirrors messageNotificationActions()/classifyNotificationAction — change one, change both.

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
            title: "Reply",
            placeholder: "Reply…",
        },
        { action: "markread", title: "Mark as read" },
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

export function buildReadReceiptPath(roomId: string, eventId: string): string {
    return `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/receipt/m.read/${encodeURIComponent(eventId)}`;
}
