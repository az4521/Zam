import { describe, it, expect } from "vitest";
import { buildThreadReplyContent, isThreadReplyContent } from "./threadContent";

describe("isThreadReplyContent — thread-membership predicate", () => {
    const forRoot = (
        over: Partial<Parameters<typeof isThreadReplyContent>[0]>,
    ) =>
        isThreadReplyContent({
            type: "m.room.message",
            isRedacted: false,
            relatesTo: { rel_type: "m.thread", event_id: "$root" },
            rootEventId: "$root",
            ...over,
        });

    it("accepts a thread reply to the given root", () => {
        expect(forRoot({})).toBe(true);
    });

    it("rejects a thread reply to a different root", () => {
        expect(
            forRoot({
                relatesTo: { rel_type: "m.thread", event_id: "$other" },
            }),
        ).toBe(false);
    });

    it("rejects non-thread relations and unrelated messages", () => {
        expect(
            forRoot({
                relatesTo: { rel_type: "m.replace", event_id: "$root" },
            }),
        ).toBe(false);
        expect(forRoot({ relatesTo: undefined })).toBe(false);
    });

    it("rejects redacted events and non-message types", () => {
        expect(forRoot({ isRedacted: true })).toBe(false);
        expect(forRoot({ type: "m.reaction" })).toBe(false);
    });

    it("accepts stickers in a thread", () => {
        expect(forRoot({ type: "m.sticker" })).toBe(true);
    });
});

describe("buildThreadReplyContent — spec-compliant m.thread relation", () => {
    it("builds a thread relation pointing at the root", () => {
        const c = buildThreadReplyContent({
            rootEventId: "$root",
            latestEventId: "$latest",
            text: "hi",
        });
        const rel = c["m.relates_to"];
        expect(rel.rel_type).toBe("m.thread");
        expect(rel.event_id).toBe("$root");
        expect(rel.is_falling_back).toBe(true);
        expect(rel["m.in_reply_to"].event_id).toBe("$latest");
        expect(c.msgtype).toBe("m.text");
        expect(c.body).toBe("hi");
    });

    it("falls back the in-reply-to to the root when no latest event is given", () => {
        const c = buildThreadReplyContent({ rootEventId: "$root", text: "hi" });
        expect(c["m.relates_to"]["m.in_reply_to"].event_id).toBe("$root");
    });

    it("includes formatted_body only when formattedText is provided", () => {
        const plain = buildThreadReplyContent({
            rootEventId: "$r",
            text: "hi",
        });
        expect("formatted_body" in plain).toBe(false);
        expect("format" in plain).toBe(false);

        const rich = buildThreadReplyContent({
            rootEventId: "$r",
            text: "**hi**",
            formattedText: "<strong>hi</strong>",
        });
        expect(rich.format).toBe("org.matrix.custom.html");
        expect(rich.formatted_body).toBe("<strong>hi</strong>");
    });

    it("passes mentions through", () => {
        const c = buildThreadReplyContent({
            rootEventId: "$r",
            text: "hi",
            mentions: { user_ids: ["@bob:hs"] },
        });
        expect(c["m.mentions"]).toEqual({ user_ids: ["@bob:hs"] });
    });
});
