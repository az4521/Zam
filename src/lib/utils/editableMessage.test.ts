import { describe, expect, it } from "vitest";
import {
    hasMediaCaption,
    isEditableContent,
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
