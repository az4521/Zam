// Pure model for the full message-actions menu: the mobile bottom sheet
// (opened by the "⋯" button or a long-press) and the desktop right-click menu.
//
// Both list EVERY action the message offers, with its full name, so nobody has
// to decode the action bar's icons. Which rows appear, in what order, and how
// they label lives here so it can be tested without a DOM; MessageItem supplies
// the gating flags and each surface renders the result.
import { t } from "$lib/i18n";

/** Every action the menu can offer. */
export type MessageActionKey =
    | "react"
    | "reply"
    | "thread"
    | "forward"
    | "edit"
    | "copy-text"
    | "pin"
    | "copy-link"
    | "view-source"
    | "report"
    | "redact"
    | "delete";

export interface MessageActionContext {
    /** Reactions apply (a sent, non-failed event). */
    canReact: boolean;
    /** Replying applies (every message the action bar is shown on). */
    canReply: boolean;
    /** Own message that can be edited in place. */
    canEdit: boolean;
    /**
     * The thread action this message offers: "reply" starts a thread on it,
     * "open" opens the thread it belongs to, null when threads don't apply.
     */
    thread: "reply" | "open" | null;
    /** A message or sticker that can be forwarded. */
    canForward: boolean;
    /** The message has body text worth copying. */
    canCopyText: boolean;
    /** The viewer may pin/unpin in this room. */
    canPin: boolean;
    /** The message is currently pinned (flips the pin row's label). */
    isPinned: boolean;
    /** A sent event with a shareable permalink (a real `$`-id, not a failure). */
    hasLink: boolean;
    /** The event's JSON can be inspected (every message the menu is shown on). */
    canViewSource: boolean;
    /** Someone else's non-failed message — reportable. */
    canReport: boolean;
    /** Someone else's non-failed message the viewer has redact power over. */
    canRedact: boolean;
    /** Own message — deletable by the sender. */
    canDelete: boolean;
}

export interface MessageActionRow {
    key: MessageActionKey;
    label: string;
    /** Destructive — rendered in the danger colour. */
    danger?: boolean;
    /**
     * Needs an in-sheet "are you sure?" step before it runs. Only `delete`
     * uses this on the sheet: unlike `redact`, deleting your own message has no
     * follow-up dialog of its own, so the confirmation lives in the sheet.
     */
    confirm?: boolean;
}

/**
 * Build the menu rows for one message. The everyday actions come first in the
 * action bar's order (react, reply, thread, forward, edit), then copy, pin and
 * inspection, with the destructive rows last. `delete` and `redact` never both
 * appear — delete is own-message only, redact is other-message only.
 */
export function messageActionsMenu(
    ctx: MessageActionContext,
): MessageActionRow[] {
    const rows: MessageActionRow[] = [];
    if (ctx.canReact)
        rows.push({ key: "react", label: t("messageItem.addReaction") });
    if (ctx.canReply)
        rows.push({ key: "reply", label: t("messageItem.reply") });
    if (ctx.thread)
        rows.push({
            key: "thread",
            label:
                ctx.thread === "open"
                    ? t("messageItem.openThread")
                    : t("messageItem.replyInThread"),
        });
    if (ctx.canForward)
        rows.push({ key: "forward", label: t("messageItem.forwardMessage") });
    if (ctx.canEdit)
        rows.push({ key: "edit", label: t("messageItem.editMessage") });
    if (ctx.canCopyText)
        rows.push({
            key: "copy-text",
            label: t("messageActionsMenu.copyText"),
        });
    if (ctx.canPin)
        rows.push({
            key: "pin",
            label: ctx.isPinned
                ? t("messageActionsMenu.unpin")
                : t("messageActionsMenu.pin"),
        });
    if (ctx.hasLink)
        rows.push({
            key: "copy-link",
            label: t("messageActionsMenu.copyLink"),
        });
    if (ctx.canViewSource)
        rows.push({ key: "view-source", label: t("messageItem.viewSource") });
    if (ctx.canReport)
        rows.push({ key: "report", label: t("messageActionsMenu.report") });
    if (ctx.canRedact)
        rows.push({ key: "redact", label: t("common.remove"), danger: true });
    if (ctx.canDelete)
        rows.push({
            key: "delete",
            label: t("common.delete"),
            danger: true,
            confirm: true,
        });
    return rows;
}
