import { describe, it, expect } from "vitest";
import {
    messageActionsMenu,
    type MessageActionContext,
} from "./messageActionsMenu";

/** Everything off — the base every case overrides from. */
const NONE: MessageActionContext = {
    canReact: false,
    canReply: false,
    canForward: false,
    canCopyText: false,
    canEdit: false,
    thread: null,
    canPin: false,
    isPinned: false,
    hasLink: false,
    canViewSource: false,
    canReport: false,
    canRedact: false,
    canDelete: false,
};

const keys = (ctx: MessageActionContext) =>
    messageActionsMenu(ctx).map((r) => r.key);

describe("messageActionsMenu", () => {
    it("returns nothing when no action applies", () => {
        expect(messageActionsMenu(NONE)).toEqual([]);
    });

    it("own editable message offers edit and thread as full rows", () => {
        expect(
            keys({
                ...NONE,
                canEdit: true,
                thread: "reply",
                hasLink: true,
                canDelete: true,
            }),
        ).toEqual(["thread", "edit", "copy-link", "delete"]);
    });

    it("lists the everyday actions with their full names", () => {
        expect(
            messageActionsMenu({
                ...NONE,
                canReact: true,
                canReply: true,
                canForward: true,
                canCopyText: true,
            }),
        ).toEqual([
            { key: "react", label: "Add reaction" },
            { key: "reply", label: "Reply" },
            { key: "forward", label: "Forward message" },
            { key: "copy-text", label: "Copy message text" },
        ]);
    });

    it("thread row label reflects open vs reply", () => {
        expect(
            messageActionsMenu({ ...NONE, thread: "open" })[0],
        ).toMatchObject({ key: "thread", label: "Open thread" });
        expect(
            messageActionsMenu({ ...NONE, thread: "reply" })[0],
        ).toMatchObject({ key: "thread", label: "Reply in thread" });
    });

    it("other's message: copy-link, report, redact (redact last)", () => {
        expect(
            keys({
                ...NONE,
                hasLink: true,
                canReport: true,
                canRedact: true,
            }),
        ).toEqual(["copy-link", "report", "redact"]);
    });

    it("keeps the fixed order regardless of which flags are on", () => {
        // Everything on at once (not a real message, but proves ordering).
        expect(
            keys({
                canReact: true,
                canReply: true,
                canForward: true,
                canCopyText: true,
                canEdit: true,
                thread: "reply",
                canPin: true,
                isPinned: false,
                hasLink: true,
                canViewSource: true,
                canReport: true,
                canRedact: true,
                canDelete: true,
            }),
        ).toEqual([
            "react",
            "reply",
            "thread",
            "forward",
            "edit",
            "copy-text",
            "pin",
            "copy-link",
            "view-source",
            "report",
            "redact",
            "delete",
        ]);
    });

    it("offers mark as unread after copy link", () => {
        expect(
            keys({
                ...NONE,
                hasLink: true,
                canMarkUnread: true,
                canViewSource: true,
            }),
        ).toEqual(["copy-link", "mark-unread", "view-source"]);
        expect(messageActionsMenu({ ...NONE, canMarkUnread: true })[0]).toEqual(
            { key: "mark-unread", label: "Mark as unread" },
        );
    });

    it("view source is offered on any message, with its own label", () => {
        expect(messageActionsMenu({ ...NONE, canViewSource: true })).toEqual([
            { key: "view-source", label: "View source" },
        ]);
    });

    it("pin row label reflects the pinned state", () => {
        expect(messageActionsMenu({ ...NONE, canPin: true })[0]).toMatchObject({
            key: "pin",
            label: "Pin",
        });
        expect(
            messageActionsMenu({ ...NONE, canPin: true, isPinned: true })[0],
        ).toMatchObject({ key: "pin", label: "Unpin" });
    });

    it("marks the destructive rows danger, and only delete needs a confirm step", () => {
        const rows = messageActionsMenu({
            ...NONE,
            canRedact: true,
            canDelete: true,
        });
        const redact = rows.find((r) => r.key === "redact");
        const del = rows.find((r) => r.key === "delete");
        expect(redact).toMatchObject({ danger: true });
        expect(redact?.confirm).toBeFalsy();
        expect(del).toMatchObject({ danger: true, confirm: true });
    });

    it("hides copy-link for a failed (unsendable) message", () => {
        // hasLink already folds in !isFailed at the call site; assert the model
        // simply omits the row when hasLink is false.
        expect(keys({ ...NONE, canDelete: true })).toEqual(["delete"]);
    });
});
