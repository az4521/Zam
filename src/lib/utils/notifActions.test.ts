import { describe, it, expect } from "vitest";
import {
    messageNotificationActions,
    classifyNotificationAction,
    buildReadReceiptPath,
} from "./notifActions";

describe("messageNotificationActions", () => {
    it("returns a Chromium text-reply action and a mark-read action", () => {
        const a = messageNotificationActions();
        expect(a).toEqual([
            {
                action: "reply",
                type: "text",
                title: "Reply",
                placeholder: "Reply…",
            },
            { action: "markread", title: "Mark as read" },
        ]);
    });
});

describe("classifyNotificationAction", () => {
    it("reply with text → reply (trimmed)", () => {
        expect(classifyNotificationAction("reply", "  hi there  ")).toEqual({
            kind: "reply",
            text: "hi there",
        });
    });
    it("reply with empty/whitespace text → open (compose)", () => {
        expect(classifyNotificationAction("reply", "   ")).toEqual({
            kind: "open",
        });
        expect(classifyNotificationAction("reply", "")).toEqual({
            kind: "open",
        });
        expect(classifyNotificationAction("reply", undefined)).toEqual({
            kind: "open",
        });
    });
    it("markread → markread", () => {
        expect(classifyNotificationAction("markread", undefined)).toEqual({
            kind: "markread",
        });
    });
    it("call/plain/unknown actions → other", () => {
        expect(classifyNotificationAction("accept", undefined)).toEqual({
            kind: "other",
        });
        expect(classifyNotificationAction("decline", undefined)).toEqual({
            kind: "other",
        });
        expect(classifyNotificationAction("", undefined)).toEqual({
            kind: "other",
        });
        expect(classifyNotificationAction(undefined, undefined)).toEqual({
            kind: "other",
        });
    });
});

describe("buildReadReceiptPath", () => {
    it("URL-encodes the room and event ids", () => {
        expect(buildReadReceiptPath("!abc:hs.tld", "$evt:hs.tld")).toBe(
            "/_matrix/client/v3/rooms/!abc%3Ahs.tld/receipt/m.read/%24evt%3Ahs.tld",
        );
    });
});
