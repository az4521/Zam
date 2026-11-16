import { describe, expect, it } from "vitest";
import {
    FORWARDED_SEND_KEY,
    buildForwardContent,
    forwardDisplayContent,
    forwardEventPermalink,
    readForward,
    type ForwardSource,
} from "./forwarded";
import { displayContent } from "./displayContent";

const via = () => ["example.org"];

function source(over: Partial<ForwardSource>): ForwardSource {
    const content = over.content ?? { msgtype: "m.text", body: "hi" };
    return {
        type: "m.room.message",
        originalContent: content,
        eventId: "$original:example.org",
        roomId: "!source:example.org",
        sender: "@alice:example.org",
        ts: 1722451200000,
        ...over,
        content,
    };
}

describe("buildForwardContent (MSC4553 examples)", () => {
    it("forwards a text message with full attribution", () => {
        const out = buildForwardContent(
            source({
                roomName: "Meeting Announcements",
                roomAvatarUrl: "mxc://example.org/abc123",
                content: {
                    msgtype: "m.text",
                    body: "Meeting starts at noon.",
                    format: "org.matrix.custom.html",
                    formatted_body: "<p>Meeting starts at noon.</p>",
                },
            }),
            { via },
        );
        expect(out).toEqual({
            msgtype: "m.text",
            body: "Forwarded from @alice:example.org - view original message: https://matrix.to/#/!source%3Aexample.org/%24original%3Aexample.org?via=example.org\nMeeting starts at noon.",
            format: "org.matrix.custom.html",
            formatted_body:
                '<strong>Forwarded from <a href="https://matrix.to/#/%40alice%3Aexample.org">@alice:example.org</a> - <a href="https://matrix.to/#/!source%3Aexample.org/%24original%3Aexample.org?via=example.org">view original message</a></strong><br><blockquote><p>Meeting starts at noon.</p></blockquote>',
            "m.mentions": {},
            [FORWARDED_SEND_KEY]: {
                event_id: "$original:example.org",
                room_id: "!source:example.org",
                room_name: "Meeting Announcements",
                room_avatar_url: "mxc://example.org/abc123",
                sender: "@alice:example.org",
                origin_server_ts: 1722451200000,
                content: {
                    msgtype: "m.text",
                    body: "Meeting starts at noon.",
                    format: "org.matrix.custom.html",
                    formatted_body: "<p>Meeting starts at noon.</p>",
                },
            },
        });
    });

    it("uses the generic label when no attribution is known", () => {
        const out = buildForwardContent(
            source({
                eventId: undefined,
                roomId: undefined,
                sender: undefined,
                ts: undefined,
                content: { msgtype: "m.text", body: "a < b\nc" },
            }),
        );
        expect(out.body).toBe("Forwarded message\na < b\nc");
        expect(out.formatted_body).toBe(
            "<strong>Forwarded message</strong><br><blockquote>a &lt; b<br>c</blockquote>",
        );
        expect(out[FORWARDED_SEND_KEY]).toEqual({
            content: { msgtype: "m.text", body: "a < b\nc" },
        });
    });

    it("forwards an emote as m.text in the fallback, keeping m.emote inside", () => {
        const out = buildForwardContent(
            source({
                eventId: "$emote:example.org",
                content: { msgtype: "m.emote", body: "waves" },
            }),
            { via, displayName: () => "Alice" },
        );
        expect(out.msgtype).toBe("m.text");
        expect(out.body).toBe(
            "Forwarded from @alice:example.org - view original message: https://matrix.to/#/!source%3Aexample.org/%24emote%3Aexample.org?via=example.org\nAlice waves",
        );
        expect(out.formatted_body).toContain(
            '<blockquote><em><strong><a href="https://matrix.to/#/%40alice%3Aexample.org">Alice</a></strong> waves</em></blockquote>',
        );
        expect(
            (out[FORWARDED_SEND_KEY] as { content: unknown }).content,
        ).toEqual({ msgtype: "m.emote", body: "waves" });
    });

    it("labels an emote with no sender generically", () => {
        const out = buildForwardContent(
            source({
                sender: undefined,
                eventId: undefined,
                content: { msgtype: "m.emote", body: "waves" },
            }),
        );
        expect(out.body).toBe("Forwarded message\nSender waves");
        expect(out.formatted_body).toBe(
            "<strong>Forwarded message</strong><br><blockquote><em><strong>Sender</strong> waves</em></blockquote>",
        );
    });

    it("moves an uncaptioned file's name to filename and quotes nothing", () => {
        const out = buildForwardContent(
            source({
                eventId: "$file:example.org",
                content: {
                    msgtype: "m.file",
                    body: "agenda.pdf",
                    url: "mxc://example.org/agenda",
                },
            }),
            { via },
        );
        expect(out.filename).toBe("agenda.pdf");
        expect(out.url).toBe("mxc://example.org/agenda");
        expect(out.body).toBe(
            "Forwarded from @alice:example.org - view original message: https://matrix.to/#/!source%3Aexample.org/%24file%3Aexample.org?via=example.org",
        );
        expect(out.formatted_body).not.toContain("<blockquote>");
    });

    it("quotes a media caption", () => {
        const out = buildForwardContent(
            source({
                content: {
                    msgtype: "m.image",
                    filename: "cat.png",
                    body: "look at him",
                    url: "mxc://hs/cat",
                },
            }),
        );
        expect(out.filename).toBe("cat.png");
        expect(out.body).toMatch(/\nlook at him$/);
        expect(out.formatted_body).toContain(
            "<blockquote>look at him</blockquote>",
        );
    });

    it("keeps a sticker's body and adds no fallback", () => {
        const sticker = {
            body: "A waving cat",
            url: "mxc://example.org/waving-cat",
            info: { mimetype: "image/png" },
        };
        const out = buildForwardContent(
            source({ type: "m.sticker", content: sticker }),
        );
        expect(out.body).toBe("A waving cat");
        expect(out).not.toHaveProperty("formatted_body");
        expect(out["m.mentions"]).toEqual({});
    });

    it("keeps m.location's body as is", () => {
        const out = buildForwardContent(
            source({
                content: {
                    msgtype: "m.location",
                    body: "Big Ben",
                    geo_uri: "geo:51.5,-0.12",
                },
            }),
        );
        expect(out.body).toBe("Big Ben");
        expect(out.geo_uri).toBe("geo:51.5,-0.12");
    });

    it("strips reply fallback and local relations from the top level", () => {
        const original = {
            msgtype: "m.text",
            body: "> <@bob:hs> question\n\nanswer",
            format: "org.matrix.custom.html",
            formatted_body:
                "<mx-reply><blockquote>question</blockquote></mx-reply>answer",
            "m.relates_to": { "m.in_reply_to": { event_id: "$q" } },
            "m.mentions": { user_ids: ["@bob:hs"] },
        };
        const out = buildForwardContent(source({ content: original }));
        const inner = (out[FORWARDED_SEND_KEY] as { content: typeof original })
            .content;
        expect(inner.body).toBe("answer");
        expect(inner.formatted_body).toBe("answer");
        expect(out).not.toHaveProperty("m.relates_to");
        expect(out["m.mentions"]).toEqual({});
        expect(JSON.stringify(out)).not.toContain("mx-reply");
        // The source object is untouched.
        expect(original.body).toContain("question");
    });

    it("copies a forward's object unchanged when forwarding it again", () => {
        const first = buildForwardContent(
            source({ content: { msgtype: "m.text", body: "hello" } }),
        );
        const again = buildForwardContent(
            source({
                content: first,
                originalContent: first,
                eventId: "$hop:example.org",
                roomId: "!middle:example.org",
                sender: "@carol:example.org",
            }),
        );
        expect(again[FORWARDED_SEND_KEY]).toEqual(first[FORWARDED_SEND_KEY]);
        expect(again.body).toMatch(/^Forwarded from @alice:example.org/);
    });

    it("fills in content when re-forwarding an MSC2723 forward", () => {
        const famedly = {
            msgtype: "m.text",
            body: "hello",
            "com.famedly.app.forwarded": {
                event_id: "$o:hs",
                room_id: "!r:hs",
                sender: "@a:hs",
            },
        };
        const out = buildForwardContent(
            source({ content: famedly, originalContent: famedly }),
        );
        expect(out).not.toHaveProperty("com.famedly.app.forwarded");
        expect(out[FORWARDED_SEND_KEY]).toEqual({
            event_id: "$o:hs",
            room_id: "!r:hs",
            sender: "@a:hs",
            content: { msgtype: "m.text", body: "hello" },
        });
    });

    it("drops the quote when the doubled content gets too big", () => {
        const big = "x".repeat(30_000);
        const out = buildForwardContent(
            source({ content: { msgtype: "m.text", body: big } }),
        );
        expect(out.body).toMatch(/^Forwarded from /);
        expect(out.body as string).not.toContain("xxx");
        expect(
            (out[FORWARDED_SEND_KEY] as { content: { body: string } }).content
                .body,
        ).toBe(big);
    });
});

describe("readForward / forwardDisplayContent", () => {
    it("reads the stable, unstable and MSC2723 keys", () => {
        const inner = { msgtype: "m.text", body: "hi" };
        expect(
            readForward({ "m.forwarded": { content: inner } }, "m.room.message")
                ?.content,
        ).toEqual(inner);
        expect(
            readForward(
                { [FORWARDED_SEND_KEY]: { content: inner, sender: "@a:hs" } },
                "m.room.message",
            ),
        ).toMatchObject({ sender: "@a:hs", content: inner });
        const famedly = readForward(
            {
                "com.famedly.app.forwarded": {
                    sender: "@a:hs",
                    content: inner,
                },
            },
            "m.room.message",
        );
        expect(famedly?.sender).toBe("@a:hs");
        expect(famedly?.content).toBeNull();
        expect(readForward({ body: "x" }, "m.room.message")).toBeNull();
    });

    it("rejects invalid forwarded content and bogus fields", () => {
        const fwd = readForward(
            {
                [FORWARDED_SEND_KEY]: {
                    content: { body: "no msgtype" },
                    room_avatar_url: "https://evil.example/x.png",
                    origin_server_ts: "yesterday",
                },
            },
            "m.room.message",
        );
        expect(fwd?.content).toBeNull();
        expect(fwd?.roomAvatarUrl).toBeUndefined();
        expect(fwd?.ts).toBeUndefined();
    });

    it("draws the forwarded original with the forward's own relations", () => {
        const top = {
            msgtype: "m.text",
            body: "Forwarded message\nhi",
            "m.relates_to": { "m.in_reply_to": { event_id: "$mine" } },
            "m.mentions": {},
            [FORWARDED_SEND_KEY]: {
                content: {
                    msgtype: "m.emote",
                    body: "hi",
                    "m.relates_to": { rel_type: "m.thread", event_id: "$x" },
                    "m.mentions": { user_ids: ["@x:hs"] },
                },
            },
        };
        expect(forwardDisplayContent(top, "m.room.message")).toEqual({
            msgtype: "m.emote",
            body: "hi",
            "m.relates_to": { "m.in_reply_to": { event_id: "$mine" } },
            "m.mentions": {},
        });
    });

    it("falls back to the top level without valid content", () => {
        const top = {
            msgtype: "m.text",
            body: "hi",
            [FORWARDED_SEND_KEY]: { content: "nope" },
        };
        expect(forwardDisplayContent(top, "m.room.message")).toBe(top);
    });

    it("displayContent ignores edits on a forward", () => {
        const top = {
            msgtype: "m.text",
            body: "Forwarded message\nhi",
            [FORWARDED_SEND_KEY]: {
                content: { msgtype: "m.text", body: "hi" },
            },
        };
        const ev = {
            getType: () => "m.room.message",
            getContent: () => ({ msgtype: "m.text", body: "edited!" }),
            getOriginalContent: () => top,
            replacingEvent: () => ({}),
            isRedacted: () => false,
        };
        expect(displayContent(ev)).toEqual({ msgtype: "m.text", body: "hi" });
    });
});

describe("forwardEventPermalink", () => {
    it("percent-encodes both ids and dedupes via", () => {
        expect(forwardEventPermalink("!r:hs", "$e/x", ["a", "a", "b"])).toBe(
            "https://matrix.to/#/!r%3Ahs/%24e%2Fx?via=a&via=b",
        );
    });
});
