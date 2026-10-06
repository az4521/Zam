import { describe, expect, it } from "vitest";
import {
    hasMediaCaption,
    isEditableContent,
    lastEditableOwnMessage,
    mediaEditBase,
} from "./editableMessage";

const captioned = {
    msgtype: "m.image",
    body: "look at this",
    format: "org.matrix.custom.html",
    formatted_body: "<b>look</b> at this",
    filename: "cat.png",
    url: "mxc://hs/abc",
    info: { mimetype: "image/png", w: 10, h: 10 },
    "m.mentions": {},
    "m.relates_to": { "m.in_reply_to": { event_id: "$p" } },
};

describe("editableMessage", () => {
    it("detects a media caption only when filename differs from body", () => {
        expect(hasMediaCaption(captioned)).toBe(true);
        expect(
            hasMediaCaption({
                msgtype: "m.image",
                body: "cat.png",
                filename: "cat.png",
            }),
        ).toBe(false);
        expect(hasMediaCaption({ msgtype: "m.image", body: "cat.png" })).toBe(
            false,
        );
        expect(
            hasMediaCaption({ msgtype: "m.text", body: "hi", filename: "x" }),
        ).toBe(false);
    });

    it("allows editing text and captioned media only", () => {
        expect(isEditableContent({ msgtype: "m.text", body: "hi" })).toBe(true);
        expect(isEditableContent(captioned)).toBe(true);
        expect(isEditableContent({ msgtype: "m.image", body: "cat.png" })).toBe(
            false,
        );
        expect(isEditableContent({ msgtype: "m.notice", body: "x" })).toBe(
            false,
        );
        expect(isEditableContent(undefined)).toBe(false);
    });

    it("keeps media fields and drops caption, mentions and relations", () => {
        expect(mediaEditBase(captioned)).toEqual({
            msgtype: "m.image",
            filename: "cat.png",
            url: "mxc://hs/abc",
            info: { mimetype: "image/png", w: 10, h: 10 },
        });
        expect(
            mediaEditBase({ msgtype: "m.text", body: "hi" }),
        ).toBeUndefined();
    });
});

describe("lastEditableOwnMessage", () => {
    const ME = "@me:hs";
    const ev = (
        id: string,
        over: {
            sender?: string;
            type?: string;
            content?: Record<string, unknown>;
            replaces?: boolean;
        } = {},
    ) => ({
        id,
        getId: () => id,
        getSender: () => over.sender ?? ME,
        getType: () => over.type ?? "m.room.message",
        getContent: () => over.content ?? { msgtype: "m.text", body: id },
        isRelation: (rel?: string) => !!over.replaces && rel === "m.replace",
    });

    it("finds your newest editable message", () => {
        const events = [ev("$a"), ev("$b"), ev("$c", { sender: "@you:hs" })];
        expect(lastEditableOwnMessage(events, ME)?.id).toBe("$b");
    });

    it("skips edit events, so a second edit targets the message", () => {
        const events = [
            ev("$msg"),
            ev("$edit", {
                content: { msgtype: "m.text", body: "* fixed" },
                replaces: true,
            }),
        ];
        expect(lastEditableOwnMessage(events, ME)?.id).toBe("$msg");
    });

    it("skips non-messages and uneditable content", () => {
        const events = [
            ev("$msg"),
            ev("$reaction", { type: "m.reaction" }),
            ev("$notice", { content: { msgtype: "m.image", body: "x.png" } }),
            ev("$redacted", { content: {} }),
        ];
        expect(lastEditableOwnMessage(events, ME)?.id).toBe("$msg");
    });

    it("returns undefined when there is nothing of yours", () => {
        expect(
            lastEditableOwnMessage([ev("$a", { sender: "@you:hs" })], ME),
        ).toBeUndefined();
        expect(lastEditableOwnMessage([], ME)).toBeUndefined();
    });
});
