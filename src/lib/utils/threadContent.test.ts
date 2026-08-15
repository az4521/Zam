import { describe, it, expect } from "vitest";
import {
    buildThreadReplyContent,
    isThreadReplyContent,
    withThreadRelation,
    composerThreadKey,
} from "./threadContent";

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

    it("always emits an m.mentions key, defaulting to empty when none given", () => {
        const c = buildThreadReplyContent({ rootEventId: "$r", text: "hi" });
        expect("m.mentions" in c).toBe(true);
        expect(c["m.mentions"]).toEqual({});
    });
});

describe("withThreadRelation — decorate arbitrary content for a thread", () => {
    it("attaches the m.thread relation with latest as the in_reply_to fallback", () => {
        const out = withThreadRelation(
            { msgtype: "m.image", body: "pic.png", url: "mxc://x" },
            { rootEventId: "$root", latestEventId: "$latest" },
        );
        expect(out["m.relates_to"]).toEqual({
            rel_type: "m.thread",
            event_id: "$root",
            is_falling_back: true,
            "m.in_reply_to": { event_id: "$latest" },
        });
        // original fields preserved
        expect(out.msgtype).toBe("m.image");
        expect(out.url).toBe("mxc://x");
    });

    it("falls back the in_reply_to to the root when latestEventId is absent", () => {
        const out = withThreadRelation(
            { msgtype: "m.text", body: "hi" },
            { rootEventId: "$root" },
        );
        expect(out["m.relates_to"]["m.in_reply_to"].event_id).toBe("$root");
    });

    it("does not mutate the input object", () => {
        const input = { msgtype: "m.sticker", body: "s" };
        withThreadRelation(input, { rootEventId: "$root" });
        expect("m.relates_to" in input).toBe(false);
    });

    it("replaces a pre-existing m.relates_to (thread membership wins)", () => {
        const out = withThreadRelation(
            {
                msgtype: "m.text",
                body: "x",
                "m.relates_to": { rel_type: "m.annotation" },
            },
            { rootEventId: "$root", latestEventId: "$l" },
        );
        expect(out["m.relates_to"].rel_type).toBe("m.thread");
    });
});

describe("composerThreadKey — instance key for thread draft/queue scoping", () => {
    it("namespaces per room + root", () => {
        expect(composerThreadKey("!r:s", "$root")).toBe("!r:s::thread::$root");
    });
    it("differs from the bare roomId (the main composer key)", () => {
        expect(composerThreadKey("!r:s", "$root")).not.toBe("!r:s");
    });
});
