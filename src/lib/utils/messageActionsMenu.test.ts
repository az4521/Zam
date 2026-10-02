import { describe, it, expect } from "vitest";
import {
    messageActionsMenu,
    type MessageActionContext,
} from "./messageActionsMenu";

/** Everything off — the base every case overrides from. */
const NONE: MessageActionContext = {
    canEdit: false,
    thread: null,
    canPin: false,
    isPinned: false,
    hasLink: false,
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

    it("own editable message: edit goes inline, thread moves to the sheet", () => {
        expect(
            keys({
                ...NONE,
                canEdit: true,
                thread: "reply",
                hasLink: true,
                canDelete: true,
            }),
        ).toEqual(["thread", "copy-link", "delete"]);
    });

    it("thread stays inline when the message is not editable", () => {
        expect(keys({ ...NONE, thread: "reply", hasLink: true })).toEqual([
            "copy-link",
        ]);
    });

    it("thread row label reflects open vs reply", () => {
        expect(
            messageActionsMenu({ ...NONE, canEdit: true, thread: "open" })[0],
        ).toMatchObject({ key: "thread", label: "Open thread" });
        expect(
            messageActionsMenu({ ...NONE, canEdit: true, thread: "reply" })[0],
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
                canEdit: true,
                thread: "reply",
                canPin: true,
                isPinned: false,
                hasLink: true,
                canReport: true,
                canRedact: true,
                canDelete: true,
            }),
        ).toEqual(["thread", "pin", "copy-link", "report", "redact", "delete"]);
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
