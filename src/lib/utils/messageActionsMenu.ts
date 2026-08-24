// Pure model for the mobile message-actions overflow ("⋯ More") sheet.
//
// On a phone the floating action bar cannot hold ~8 buttons and still sit over
// the message, so only the four everyday actions stay inline — react, reply,
// forward, thread — and the rest move into a bottom sheet. Which rows the sheet
// shows, in what order, and how they label lives here so it can be tested
// without a DOM; MessageItem supplies the gating flags and renders the result.
//
// Desktop is unaffected: it keeps every button inline. This model only drives
// the touch layout.

/** The actions that move off the inline bar and into the overflow sheet. */
export type MessageActionKey =
    | "edit"
    | "pin"
    | "copy-link"
    | "report"
    | "redact"
    | "delete";

export interface MessageActionContext {
    /** Own text message that can be edited in place. */
    canEdit: boolean;
    /** The viewer may pin/unpin in this room. */
    canPin: boolean;
    /** The message is currently pinned (flips the pin row's label). */
    isPinned: boolean;
    /** A sent event with a shareable permalink (a real `$`-id, not a failure). */
    hasLink: boolean;
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
     * uses this: unlike `redact`, deleting your own message has no follow-up
     * dialog of its own, so the confirmation lives in the sheet.
     */
    confirm?: boolean;
}

/**
 * Build the overflow rows for one message. Order is fixed and mirrors the
 * desktop bar's left-to-right order (edit, pin, copy-link, report, redact,
 * delete) so the two layouts stay learnable; the two destructive rows land at
 * the bottom. `delete` and `redact` never both appear — delete is own-message
 * only, redact is other-message only.
 */
export function messageActionsMenu(
    ctx: MessageActionContext,
): MessageActionRow[] {
    const rows: MessageActionRow[] = [];
    if (ctx.canEdit) rows.push({ key: "edit", label: "Edit" });
    if (ctx.canPin)
        rows.push({ key: "pin", label: ctx.isPinned ? "Unpin" : "Pin" });
    if (ctx.hasLink) rows.push({ key: "copy-link", label: "Copy link" });
    if (ctx.canReport) rows.push({ key: "report", label: "Report" });
    if (ctx.canRedact)
        rows.push({ key: "redact", label: "Remove", danger: true });
    if (ctx.canDelete)
        rows.push({
            key: "delete",
            label: "Delete",
            danger: true,
            confirm: true,
        });
    return rows;
}
