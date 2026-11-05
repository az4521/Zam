import { describe, expect, it } from "vitest";
import type { MatrixEvent } from "matrix-js-sdk";
import { latestMessagePreview } from "./roomPreview";

function ev(opts: {
    type?: string;
    content?: Record<string, unknown>;
    sender?: string;
    state?: boolean;
    redacted?: boolean;
    failed?: boolean;
    id?: string;
}): MatrixEvent {
    const content = opts.content ?? {};
    return {
        getType: () => opts.type ?? "m.room.message",
        getContent: () => content,
        getOriginalContent: () => content,
        getSender: () => opts.sender ?? "@them:x",
        getId: () => opts.id ?? "$e",
        isState: () => !!opts.state,
        isRedacted: () => !!opts.redacted,
        isDecryptionFailure: () => !!opts.failed,
    } as unknown as MatrixEvent;
}

const msg = (body: string, extra: Record<string, unknown> = {}) =>
    ev({ content: { msgtype: "m.text", body, ...extra } });

describe("latestMessagePreview", () => {
    it("returns the newest message body", () => {
        expect(latestMessagePreview([msg("old"), msg("new")], "@me:x")).toBe(
            "new",
        );
    });

    it("skips state, redactions, reactions, edits and thread replies", () => {
        const events = [
            msg("visible"),
            ev({ type: "m.room.member", state: true }),
            ev({ content: { body: "gone" }, redacted: true }),
            ev({ type: "m.reaction", content: {} }),
            msg("* fixed", { "m.relates_to": { rel_type: "m.replace" } }),
            msg("in thread", {
                "m.relates_to": { rel_type: "m.thread", event_id: "$root" },
            }),
        ];
        expect(latestMessagePreview(events, "@me:x")).toBe("visible");
    });

    it("prefixes own messages", () => {
        const mine = ev({
            content: { msgtype: "m.text", body: "hi" },
            sender: "@me:x",
        });
        expect(latestMessagePreview([mine], "@me:x")).toBe("You: hi");
    });

    it("collapses newlines and strips reply fallbacks", () => {
        expect(
            latestMessagePreview(
                [msg("> <@a:x> quoted\n\nline one\nline two")],
                null,
            ),
        ).toBe("line one line two");
    });

    it("marks emotes and stands in for media and encrypted events", () => {
        expect(
            latestMessagePreview(
                [ev({ content: { msgtype: "m.emote", body: "waves" } })],
                null,
            ),
        ).toBe("* waves");
        expect(
            latestMessagePreview(
                [ev({ content: { msgtype: "m.image", body: "" } })],
                null,
            ),
        ).toBe("Image");
        expect(
            latestMessagePreview([ev({ type: "m.room.encrypted" })], null),
        ).toMatch(/encrypt/i);
        const failed = ev({
            content: {
                msgtype: "m.bad.encrypted",
                body: "** Unable to decrypt **",
            },
            failed: true,
        });
        expect(latestMessagePreview([failed], null)).toMatch(/🔒/);
    });

    it("returns null when nothing is showable", () => {
        expect(latestMessagePreview([], null)).toBeNull();
    });
});
