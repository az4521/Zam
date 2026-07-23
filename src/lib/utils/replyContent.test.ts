import { describe, it, expect } from "vitest";
import { buildReplyContent } from "./replyContent";

const base = {
    replyEventId: "$evt",
};

describe("buildReplyContent — v1.13 fallback-free replies", () => {
    it("emits the plain text as-is with no '> ' quote prefix", () => {
        const c = buildReplyContent({ ...base, text: "hello" });
        expect(c.body).toBe("hello");
        expect(c.body.startsWith("> ")).toBe(false);
    });

    it("never emits an <mx-reply> block in formatted_body", () => {
        const c = buildReplyContent({
            ...base,
            text: "hi",
            formattedText: "<strong>hi</strong>",
        });
        expect(c.formatted_body).toBe("<strong>hi</strong>");
        expect(c.formatted_body ?? "").not.toContain("<mx-reply");
    });

    it("omits format/formatted_body entirely for a plain-text reply", () => {
        const c = buildReplyContent({ ...base, text: "<b>hi</b>" });
        expect(c.format).toBeUndefined();
        expect(c.formatted_body).toBeUndefined();
        // The plain text is carried verbatim in body; no HTML re-serialization.
        expect(c.body).toBe("<b>hi</b>");
    });

    it("carries no foreign HTML from the replied-to event (no such params exist)", () => {
        // The old API accepted the parent's body/formatted_body and re-embedded
        // them; the new one only takes our own text. Building a reply cannot
        // leak another user's HTML because there is nowhere to pass it.
        const c = buildReplyContent({
            ...base,
            text: "ok",
            formattedText: "<em>ok</em>",
        });
        expect(c.formatted_body).toBe("<em>ok</em>");
        expect(JSON.stringify(c)).not.toContain("mx-reply");
    });

    it("sets the reply relation and passes mentions through", () => {
        const c = buildReplyContent({
            ...base,
            text: "ok",
            mentions: { user_ids: ["@bob:hs"] },
        });
        expect(c["m.relates_to"]["m.in_reply_to"].event_id).toBe("$evt");
        expect(c["m.mentions"]).toEqual({ user_ids: ["@bob:hs"] });
        expect(c.msgtype).toBe("m.text");
    });

    it("sets format only when a formatted body is supplied", () => {
        const c = buildReplyContent({
            ...base,
            text: "**hi**",
            formattedText: "<strong>hi</strong>",
        });
        expect(c.format).toBe("org.matrix.custom.html");
        expect(c.formatted_body).toBe("<strong>hi</strong>");
    });
});
