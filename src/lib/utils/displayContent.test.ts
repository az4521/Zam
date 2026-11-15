import { describe, expect, it } from "vitest";
import { MatrixClient, type MatrixEvent } from "matrix-js-sdk";
import { displayContent } from "./displayContent";

const ROOM = "!r:example.org";

function mapped(editContent: Record<string, unknown>): MatrixEvent {
    const client = new MatrixClient({
        baseUrl: "https://hs.example.org",
        accessToken: "token",
        userId: "@me:example.org",
        deviceId: "DEV",
    });
    return client.getEventMapper({ decrypt: false })({
        event_id: "$orig",
        room_id: ROOM,
        sender: "@alice:example.org",
        type: "m.room.message",
        origin_server_ts: 1000,
        content: { msgtype: "m.text", body: "hello" },
        unsigned: {
            "m.relations": {
                "m.replace": {
                    event_id: "$edit",
                    room_id: ROOM,
                    sender: "@alice:example.org",
                    origin_server_ts: 2000,
                    ...editContent,
                },
            },
        },
    });
}

describe("displayContent", () => {
    it("falls back to the original when a bundled edit is still encrypted", () => {
        const ev = mapped({
            type: "m.room.encrypted",
            content: {
                algorithm: "m.megolm.v1.aes-sha2",
                ciphertext: "AAAA",
                device_id: "DEV",
                sender_key: "KEY",
                session_id: "SESS",
            },
        });
        // The SDK half of the bug: the effective content is empty.
        expect(ev.replacingEvent()).toBeTruthy();
        expect(ev.getContent()).toEqual({});
        expect(displayContent(ev)).toEqual({
            msgtype: "m.text",
            body: "hello",
        });
    });

    it("uses the edit when it is readable", () => {
        const ev = mapped({
            type: "m.room.message",
            content: {
                msgtype: "m.text",
                body: "* hi",
                "m.new_content": { msgtype: "m.text", body: "hi" },
                "m.relates_to": { rel_type: "m.replace", event_id: "$orig" },
            },
        });
        expect(displayContent(ev)).toEqual({ msgtype: "m.text", body: "hi" });
    });

    it("keeps a redaction empty", () => {
        const fake = {
            getContent: () => ({}),
            getOriginalContent: () => ({ body: "secret" }),
            replacingEvent: () => ({}),
            isRedacted: () => true,
        };
        expect(displayContent(fake)).toEqual({});
        expect(
            displayContent({
                ...fake,
                isRedacted: () => false,
                localRedactionEvent: () => ({}),
            }),
        ).toEqual({});
    });

    it("leaves unedited events alone", () => {
        const fake = {
            getContent: () => ({}),
            getOriginalContent: () => ({ body: "x" }),
            replacingEvent: () => null,
            isRedacted: () => false,
        };
        expect(displayContent(fake)).toEqual({});
    });
});
