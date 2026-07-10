import { describe, it, expect } from "vitest";
import { buildReplyContent } from "./replyContent";

const base = {
    roomId: "!room:hs",
    replyEventId: "$evt",
    replySender: "@alice:hs",
    replyBody: "hello",
};

describe("buildReplyContent — outgoing HTML safety", () => {
    it("escapes plain-text replies that contain HTML", () => {
        const c = buildReplyContent({ ...base, text: "<b>hi</b>" });
        expect(c.formatted_body).not.toContain("<b>hi</b>");
        expect(c.formatted_body).toContain("&lt;b&gt;hi&lt;/b&gt;");
    });

    it("uses the pre-rendered formattedText verbatim when provided", () => {
        const c = buildReplyContent({
            ...base,
            text: "**hi**",
            formattedText: "<strong>hi</strong>",
        });
        expect(c.formatted_body).toContain("<strong>hi</strong>");
    });

    it("escapes the quoted body when the replied-to message has no formatted_body", () => {
        const c = buildReplyContent({
            ...base,
            replyBody: "<img src=x onerror=alert(1)>",
            text: "ok",
        });
        expect(c.formatted_body).not.toContain("<img src=x onerror");
        expect(c.formatted_body).toContain("&lt;img");
    });

    it("prefers the replied-to formatted_body when present (already spec HTML)", () => {
        const c = buildReplyContent({
            ...base,
            replyFormattedBody: "<em>quoted</em>",
            text: "ok",
        });
        expect(c.formatted_body).toContain("<em>quoted</em>");
    });

    it("escapes the sender in the mx-reply anchor", () => {
        const c = buildReplyContent({
            ...base,
            replySender: '@x"><script>:hs',
            text: "ok",
        });
        expect(c.formatted_body).not.toContain('"><script>');
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
        expect(c.format).toBe("org.matrix.custom.html");
    });

    it("builds the plain-text fallback body with quoted lines", () => {
        const c = buildReplyContent({
            ...base,
            replyBody: "line1\nline2",
            text: "reply",
        });
        expect(c.body).toBe("> <@alice:hs> > line1\n> line2\n\nreply");
    });
});
