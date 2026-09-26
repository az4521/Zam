import { describe, it, expect } from "vitest";
import {
    messageNotificationActions,
    classifyNotificationAction,
    buildReadReceiptPath,
    swReceiptTypeFor,
    ringNotificationTag,
    messageNotificationTag,
    roomNotificationTags,
    isRingToDismiss,
    quickReplyStashKey,
    buildQuickReplyStash,
    parseQuickReplyStash,
    partitionQuickReplyStashes,
    QUICK_REPLY_STASH_PREFIX,
    QUICK_REPLY_STASH_TTL_MS,
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

// Export case tables for mirror test
export const RECEIPT_TYPE_CASES = [
    {
        name: "m.read",
        roomId: "!abc:hs.tld",
        eventId: "$evt:hs.tld",
        receiptType: "m.read" as const,
        expected:
            "/_matrix/client/v3/rooms/!abc%3Ahs.tld/receipt/m.read/%24evt%3Ahs.tld",
    },
    {
        name: "m.read.private",
        roomId: "!abc:hs.tld",
        eventId: "$evt:hs.tld",
        receiptType: "m.read.private" as const,
        expected:
            "/_matrix/client/v3/rooms/!abc%3Ahs.tld/receipt/m.read.private/%24evt%3Ahs.tld",
    },
];

export const SW_RECEIPT_TYPE_CASES: Array<{
    name: string;
    privacyByUser: Record<string, boolean> | null | undefined;
    userId: string | null | undefined;
    expected: "m.read" | "m.read.private";
}> = [
    {
        name: "public when explicitly false",
        privacyByUser: { "@alice:hs": false },
        userId: "@alice:hs",
        expected: "m.read",
    },
    {
        name: "private when true",
        privacyByUser: { "@alice:hs": true },
        userId: "@alice:hs",
        expected: "m.read.private",
    },
    {
        name: "private when unknown user",
        privacyByUser: { "@bob:hs": false },
        userId: "@alice:hs",
        expected: "m.read.private",
    },
    {
        name: "private when null map",
        privacyByUser: null,
        userId: "@alice:hs",
        expected: "m.read.private",
    },
    {
        name: "private when undefined map",
        privacyByUser: undefined,
        userId: "@alice:hs",
        expected: "m.read.private",
    },
    {
        name: "private when null userId",
        privacyByUser: { "@alice:hs": false },
        userId: null,
        expected: "m.read.private",
    },
    {
        name: "private when junk value",
        privacyByUser: { "@alice:hs": "yes" as unknown as boolean },
        userId: "@alice:hs",
        expected: "m.read.private",
    },
];

export const RING_DISMISS_CASES = [
    {
        name: "matches isCall=true + eventId",
        data: { isCall: true, eventId: "$ring123" },
        ringEventId: "$ring123",
        expected: true,
    },
    {
        name: "rejects wrong eventId",
        data: { isCall: true, eventId: "$ring456" },
        ringEventId: "$ring123",
        expected: false,
    },
    {
        name: "rejects isCall=false",
        data: { isCall: false, eventId: "$ring123" },
        ringEventId: "$ring123",
        expected: false,
    },
    {
        name: "rejects missing isCall",
        data: { eventId: "$ring123" },
        ringEventId: "$ring123",
        expected: false,
    },
    {
        name: "rejects null data",
        data: null,
        ringEventId: "$ring123",
        expected: false,
    },
    {
        name: "rejects non-object data",
        data: "string",
        ringEventId: "$ring123",
        expected: false,
    },
];

export const STASH_PARSE_CASES = [
    {
        name: "valid stash",
        raw: {
            id: "1",
            roomId: "!r:s",
            eventId: "$e",
            text: "hello",
            userId: "@u:s",
            ts: 1000,
        },
        now: 2000,
        expected: {
            id: "1",
            roomId: "!r:s",
            eventId: "$e",
            text: "hello",
            userId: "@u:s",
            ts: 1000,
        },
    },
    {
        name: "null eventId is valid",
        raw: {
            id: "1",
            roomId: "!r:s",
            eventId: null,
            text: "hello",
            userId: "@u:s",
            ts: 1000,
        },
        now: 2000,
        expected: {
            id: "1",
            roomId: "!r:s",
            eventId: null,
            text: "hello",
            userId: "@u:s",
            ts: 1000,
        },
    },
    {
        name: "trims text",
        raw: {
            id: "1",
            roomId: "!r:s",
            eventId: "$e",
            text: "  hello  ",
            userId: "@u:s",
            ts: 1000,
        },
        now: 2000,
        expected: {
            id: "1",
            roomId: "!r:s",
            eventId: "$e",
            text: "hello",
            userId: "@u:s",
            ts: 1000,
        },
    },
    {
        name: "rejects blank text",
        raw: {
            id: "1",
            roomId: "!r:s",
            eventId: "$e",
            text: "   ",
            userId: "@u:s",
            ts: 1000,
        },
        now: 2000,
        expected: null,
    },
    {
        name: "rejects expired (older than TTL)",
        raw: {
            id: "1",
            roomId: "!r:s",
            eventId: "$e",
            text: "hello",
            userId: "@u:s",
            ts: 1000,
        },
        now: 1000 + QUICK_REPLY_STASH_TTL_MS + 1,
        expected: null,
    },
    {
        name: "rejects future timestamp (> 5 min ahead)",
        raw: {
            id: "1",
            roomId: "!r:s",
            eventId: "$e",
            text: "hello",
            userId: "@u:s",
            ts: 1000 + 6 * 60 * 1000,
        },
        now: 1000,
        expected: null,
    },
    {
        name: "accepts timestamp up to 5 min ahead",
        raw: {
            id: "1",
            roomId: "!r:s",
            eventId: "$e",
            text: "hello",
            userId: "@u:s",
            ts: 1000 + 4 * 60 * 1000,
        },
        now: 1000,
        expected: {
            id: "1",
            roomId: "!r:s",
            eventId: "$e",
            text: "hello",
            userId: "@u:s",
            ts: 1000 + 4 * 60 * 1000,
        },
    },
    {
        name: "rejects null raw",
        raw: null,
        now: 1000,
        expected: null,
    },
    {
        name: "rejects wrong types",
        raw: {
            id: 123,
            roomId: "!r:s",
            eventId: "$e",
            text: "hello",
            userId: "@u:s",
            ts: 1000,
        },
        now: 2000,
        expected: null,
    },
];

describe("buildReadReceiptPath", () => {
    for (const c of RECEIPT_TYPE_CASES) {
        it(`URL-encodes room/event ids with ${c.name}`, () => {
            expect(
                buildReadReceiptPath(c.roomId, c.eventId, c.receiptType),
            ).toBe(c.expected);
        });
    }
});

describe("swReceiptTypeFor", () => {
    for (const c of SW_RECEIPT_TYPE_CASES) {
        it(c.name, () => {
            expect(swReceiptTypeFor(c.privacyByUser, c.userId)).toBe(
                c.expected,
            );
        });
    }
});

describe("notification tags", () => {
    it("ringNotificationTag prefixes call:", () => {
        expect(ringNotificationTag("!room:s")).toBe("call:!room:s");
    });

    it("messageNotificationTag is the roomId", () => {
        expect(messageNotificationTag("!room:s")).toBe("!room:s");
    });

    it("roomNotificationTags returns both message and ring tags", () => {
        expect(roomNotificationTags("!room:s")).toEqual([
            "!room:s",
            "call:!room:s",
        ]);
    });
});

describe("isRingToDismiss", () => {
    for (const c of RING_DISMISS_CASES) {
        it(c.name, () => {
            expect(isRingToDismiss(c.data, c.ringEventId)).toBe(c.expected);
        });
    }
});

describe("quick-reply stash", () => {
    it("quickReplyStashKey prefixes with constant", () => {
        expect(quickReplyStashKey("abc123")).toBe(
            `${QUICK_REPLY_STASH_PREFIX}abc123`,
        );
    });

    describe("buildQuickReplyStash", () => {
        it("builds valid stash and trims text", () => {
            const result = buildQuickReplyStash({
                id: "1",
                roomId: "!r:s",
                eventId: "$e",
                text: "  hello  ",
                userId: "@u:s",
                ts: 1000,
            });
            expect(result).toEqual({
                id: "1",
                roomId: "!r:s",
                eventId: "$e",
                text: "hello",
                userId: "@u:s",
                ts: 1000,
            });
        });

        it("accepts null eventId", () => {
            const result = buildQuickReplyStash({
                id: "1",
                roomId: "!r:s",
                eventId: null,
                text: "hello",
                userId: "@u:s",
                ts: 1000,
            });
            expect(result?.eventId).toBe(null);
        });

        it("returns null if roomId is missing", () => {
            const result = buildQuickReplyStash({
                id: "1",
                roomId: "",
                eventId: "$e",
                text: "hello",
                userId: "@u:s",
                ts: 1000,
            });
            expect(result).toBe(null);
        });

        it("returns null if text is blank after trim", () => {
            const result = buildQuickReplyStash({
                id: "1",
                roomId: "!r:s",
                eventId: "$e",
                text: "   ",
                userId: "@u:s",
                ts: 1000,
            });
            expect(result).toBe(null);
        });

        it("returns null if userId is missing", () => {
            const result = buildQuickReplyStash({
                id: "1",
                roomId: "!r:s",
                eventId: "$e",
                text: "hello",
                userId: "",
                ts: 1000,
            });
            expect(result).toBe(null);
        });
    });

    describe("parseQuickReplyStash", () => {
        for (const c of STASH_PARSE_CASES) {
            it(c.name, () => {
                expect(parseQuickReplyStash(c.raw, c.now)).toEqual(c.expected);
            });
        }
    });

    describe("partitionQuickReplyStashes", () => {
        it("takes valid entries for the given user sorted by ts", () => {
            const entries = [
                {
                    key: "notif_reply:3",
                    value: {
                        id: "3",
                        roomId: "!r:s",
                        eventId: null,
                        text: "third",
                        userId: "@alice:s",
                        ts: 3000,
                    },
                },
                {
                    key: "notif_reply:1",
                    value: {
                        id: "1",
                        roomId: "!r:s",
                        eventId: "$e",
                        text: "first",
                        userId: "@alice:s",
                        ts: 1000,
                    },
                },
                {
                    key: "notif_reply:2",
                    value: {
                        id: "2",
                        roomId: "!r:s",
                        eventId: "$e2",
                        text: "second",
                        userId: "@alice:s",
                        ts: 2000,
                    },
                },
            ];
            const result = partitionQuickReplyStashes(
                entries,
                "@alice:s",
                4000,
            );
            expect(result.take).toHaveLength(3);
            expect(result.take[0].id).toBe("1");
            expect(result.take[1].id).toBe("2");
            expect(result.take[2].id).toBe("3");
            expect(result.deleteKeys).toEqual([
                "notif_reply:3",
                "notif_reply:1",
                "notif_reply:2",
            ]);
        });

        it("deletes invalid/expired entries", () => {
            const now = 1000 + QUICK_REPLY_STASH_TTL_MS + 1;
            const entries = [
                {
                    key: "notif_reply:expired",
                    value: {
                        id: "expired",
                        roomId: "!r:s",
                        eventId: null,
                        text: "old",
                        userId: "@alice:s",
                        ts: 1000,
                    },
                },
                {
                    key: "notif_reply:invalid",
                    value: { junk: true },
                },
            ];
            const result = partitionQuickReplyStashes(entries, "@alice:s", now);
            expect(result.take).toHaveLength(0);
            expect(result.deleteKeys).toEqual([
                "notif_reply:expired",
                "notif_reply:invalid",
            ]);
        });

        it("leaves other users' valid entries untouched", () => {
            const entries = [
                {
                    key: "notif_reply:alice",
                    value: {
                        id: "alice",
                        roomId: "!r:s",
                        eventId: null,
                        text: "alice msg",
                        userId: "@alice:s",
                        ts: 2000,
                    },
                },
                {
                    key: "notif_reply:bob",
                    value: {
                        id: "bob",
                        roomId: "!r:s",
                        eventId: null,
                        text: "bob msg",
                        userId: "@bob:s",
                        ts: 2000,
                    },
                },
            ];
            const result = partitionQuickReplyStashes(
                entries,
                "@alice:s",
                3000,
            );
            expect(result.take).toHaveLength(1);
            expect(result.take[0].userId).toBe("@alice:s");
            expect(result.deleteKeys).toEqual(["notif_reply:alice"]);
        });
    });
});
