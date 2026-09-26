import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    swReceiptTypeFor,
    ringNotificationTag,
    messageNotificationTag,
    roomNotificationTags,
    isRingToDismiss,
    buildReadReceiptPath,
    quickReplyStashKey,
    buildQuickReplyStash,
    QUICK_REPLY_STASH_PREFIX,
} from "./notifActions";
import {
    RECEIPT_TYPE_CASES,
    SW_RECEIPT_TYPE_CASES,
    RING_DISMISS_CASES,
} from "./notifActions.test";

// static/sw.js is hand-written and un-bundled, so it hand-mirrors
// notifActions.ts. This test EXECUTES the mirrored region and runs
// the real case table against it.
const SW_SOURCE = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "../../../static/sw.js"),
    "utf-8",
);

function regionSource(name: string): string {
    const startMarker = `// #region mirrored:${name}`;
    const endMarker = `// #endregion mirrored:${name}`;
    const start = SW_SOURCE.indexOf(startMarker);
    const end = SW_SOURCE.indexOf(endMarker);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return SW_SOURCE.slice(start + startMarker.length, end);
}

const mirrored = new Function(
    `${regionSource("notifActions")}
    return {
        buildReadReceiptPath,
        swReceiptTypeFor,
        ringNotificationTag,
        messageNotificationTag,
        roomNotificationTags,
        isRingToDismiss,
        QUICK_REPLY_STASH_PREFIX,
        quickReplyStashKey,
        buildQuickReplyStash,
    };`,
)() as {
    buildReadReceiptPath: (
        roomId: string,
        eventId: string,
        receiptType: string,
    ) => string;
    swReceiptTypeFor: (
        privacyByUser: Record<string, boolean> | null | undefined,
        userId: string | null | undefined,
    ) => string;
    ringNotificationTag: (roomId: string) => string;
    messageNotificationTag: (roomId: string) => string;
    roomNotificationTags: (roomId: string) => string[];
    isRingToDismiss: (data: unknown, ringEventId: string) => boolean;
    QUICK_REPLY_STASH_PREFIX: string;
    quickReplyStashKey: (id: string) => string;
    buildQuickReplyStash: (params: {
        id: string;
        roomId: string;
        eventId: string | null;
        text: string;
        userId: string;
        ts: number;
    }) => unknown;
};

describe("static/sw.js mirrors notifActions.ts", () => {
    it("mirrors QUICK_REPLY_STASH_PREFIX", () => {
        expect(mirrored.QUICK_REPLY_STASH_PREFIX).toBe(
            QUICK_REPLY_STASH_PREFIX,
        );
    });

    for (const c of RECEIPT_TYPE_CASES) {
        it(`buildReadReceiptPath: ${c.name}`, () => {
            expect(
                mirrored.buildReadReceiptPath(c.roomId, c.eventId, c.receiptType),
            ).toBe(c.expected);
        });
    }

    for (const c of SW_RECEIPT_TYPE_CASES) {
        it(`swReceiptTypeFor: ${c.name}`, () => {
            expect(mirrored.swReceiptTypeFor(c.privacyByUser, c.userId)).toBe(
                c.expected,
            );
        });
    }

    for (const c of RING_DISMISS_CASES) {
        it(`isRingToDismiss: ${c.name}`, () => {
            expect(mirrored.isRingToDismiss(c.data, c.ringEventId)).toBe(
                c.expected,
            );
        });
    }

    it("ringNotificationTag prefixes call:", () => {
        const roomId = "!test:hs";
        expect(mirrored.ringNotificationTag(roomId)).toBe(
            ringNotificationTag(roomId),
        );
    });

    it("messageNotificationTag returns roomId", () => {
        const roomId = "!test:hs";
        expect(mirrored.messageNotificationTag(roomId)).toBe(
            messageNotificationTag(roomId),
        );
    });

    it("roomNotificationTags returns both tags", () => {
        const roomId = "!test:hs";
        expect(mirrored.roomNotificationTags(roomId)).toEqual(
            roomNotificationTags(roomId),
        );
    });

    it("quickReplyStashKey prefixes correctly", () => {
        const id = "abc123";
        expect(mirrored.quickReplyStashKey(id)).toBe(quickReplyStashKey(id));
    });

    describe("buildQuickReplyStash", () => {
        it("builds valid stash matching TS version", () => {
            const params = {
                id: "1",
                roomId: "!r:s",
                eventId: "$e",
                text: "  hello  ",
                userId: "@u:s",
                ts: 1000,
            };
            expect(mirrored.buildQuickReplyStash(params)).toEqual(
                buildQuickReplyStash(params),
            );
        });

        it("returns null for blank text", () => {
            const params = {
                id: "1",
                roomId: "!r:s",
                eventId: "$e",
                text: "   ",
                userId: "@u:s",
                ts: 1000,
            };
            expect(mirrored.buildQuickReplyStash(params)).toBe(null);
        });

        it("accepts null eventId", () => {
            const params = {
                id: "1",
                roomId: "!r:s",
                eventId: null,
                text: "hello",
                userId: "@u:s",
                ts: 1000,
            };
            expect(mirrored.buildQuickReplyStash(params)).toEqual(
                buildQuickReplyStash(params),
            );
        });
    });
});
