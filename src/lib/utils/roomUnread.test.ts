import { describe, it, expect } from "vitest";
import {
    hasUnreadMessages,
    isStaleLocalUnread,
    receiptCoversEvent,
    type UnreadEventView,
} from "./roomUnread";

const msg = (id: string, ts: number, fromMe = false): UnreadEventView => ({
    id,
    ts,
    fromMe,
    isNotification: true,
});
const reaction = (id: string, ts: number, fromMe = false): UnreadEventView => ({
    id,
    ts,
    fromMe,
    isNotification: false,
});

describe("hasUnreadMessages", () => {
    it("is read when the newest event is ours", () => {
        expect(
            hasUnreadMessages({
                events: [msg("$a", 1), msg("$b", 2, true)],
                readUpToId: null,
                receiptTs: null,
            }),
        ).toBe(false);
    });

    it("is unread when a message follows the loaded receipt", () => {
        expect(
            hasUnreadMessages({
                events: [msg("$a", 1), msg("$b", 2)],
                readUpToId: "$a",
                receiptTs: 1,
            }),
        ).toBe(true);
    });

    it("is read when the receipt is on the newest message", () => {
        expect(
            hasUnreadMessages({
                events: [msg("$a", 1), reaction("$r", 2)],
                readUpToId: "$a",
                receiptTs: 5,
            }),
        ).toBe(false);
    });

    it("is unread when there is no receipt at all and a message is loaded", () => {
        expect(
            hasUnreadMessages({
                events: [msg("$a", 1)],
                readUpToId: null,
                receiptTs: null,
            }),
        ).toBe(true);
    });

    describe("receipt outside the loaded window", () => {
        // Sliding sync: a list room holds one event and the receipt points
        // at an older, unloaded one.
        it("is unread when the newest message is newer than the receipt", () => {
            expect(
                hasUnreadMessages({
                    events: [msg("$new", 2_000)],
                    readUpToId: null,
                    receiptTs: 1_000,
                }),
            ).toBe(true);
        });

        it("is read when the receipt is newer than every loaded message", () => {
            // The receipt sits on an event kept out of the timeline, e.g. a
            // reaction to the loaded message.
            expect(
                hasUnreadMessages({
                    events: [msg("$a", 1_000)],
                    readUpToId: null,
                    receiptTs: 1_500,
                }),
            ).toBe(false);
        });

        it("looks past non-message events to the newest message", () => {
            expect(
                hasUnreadMessages({
                    events: [msg("$a", 2_000), reaction("$r", 3_000)],
                    readUpToId: null,
                    receiptTs: 1_000,
                }),
            ).toBe(true);
        });

        it("ignores our own messages when comparing", () => {
            expect(
                hasUnreadMessages({
                    events: [msg("$mine", 2_000, true), reaction("$r", 3_000)],
                    readUpToId: null,
                    receiptTs: 1_000,
                }),
            ).toBe(false);
        });

        it("is read for an empty timeline", () => {
            expect(
                hasUnreadMessages({
                    events: [],
                    readUpToId: null,
                    receiptTs: 1_000,
                }),
            ).toBe(false);
        });

        it("keeps the old answer, read, for a receipt without a timestamp", () => {
            expect(
                hasUnreadMessages({
                    events: [msg("$new", 2_000)],
                    readUpToId: null,
                    receiptTs: 0,
                }),
            ).toBe(false);
        });
    });
});

describe("isStaleLocalUnread", () => {
    const stale = {
        encrypted: true,
        total: 1,
        highlight: 0,
        newestNotificationRead: true,
    };

    it("is stale when our receipt covers the newest message but counts remain", () => {
        expect(isStaleLocalUnread(stale)).toBe(true);
    });

    it("is not stale in an unencrypted room", () => {
        expect(isStaleLocalUnread({ ...stale, encrypted: false })).toBe(false);
    });

    it("is not stale when both counts are zero", () => {
        expect(isStaleLocalUnread({ ...stale, total: 0, highlight: 0 })).toBe(
            false,
        );
    });

    it("is not stale when the newest message is still unread", () => {
        expect(
            isStaleLocalUnread({ ...stale, newestNotificationRead: false }),
        ).toBe(false);
    });

    it("is not stale when no notification is loaded", () => {
        expect(
            isStaleLocalUnread({ ...stale, newestNotificationRead: null }),
        ).toBe(false);
    });

    it("is stale for a highlight-only count", () => {
        expect(isStaleLocalUnread({ ...stale, total: 0, highlight: 1 })).toBe(
            true,
        );
    });
});

describe("receiptCoversEvent", () => {
    const base = {
        sdkRead: false,
        receiptPlaced: false,
        receiptTs: 2_000,
        eventTs: 1_000,
    };

    it("is covered when the SDK says the receipt is at or after the event", () => {
        expect(
            receiptCoversEvent({
                ...base,
                sdkRead: true,
                receiptPlaced: true,
                receiptTs: null,
            }),
        ).toBe(true);
    });

    it("is not covered when the receipt is placed and the SDK disagrees, even with a later timestamp", () => {
        expect(
            receiptCoversEvent({
                ...base,
                receiptPlaced: true,
                receiptTs: 9_999,
            }),
        ).toBe(false);
    });

    it("is covered by an unplaced receipt whose timestamp is not older than the event", () => {
        expect(receiptCoversEvent({ ...base, receiptTs: 1_000 })).toBe(true);
        expect(receiptCoversEvent({ ...base, receiptTs: 2_000 })).toBe(true);
    });

    it("is not covered by an unplaced receipt older than the event", () => {
        expect(receiptCoversEvent({ ...base, receiptTs: 999 })).toBe(false);
    });

    it("is not covered when there is no receipt timestamp", () => {
        expect(receiptCoversEvent({ ...base, receiptTs: null })).toBe(false);
    });

    it("is not covered by a zero receipt timestamp", () => {
        expect(receiptCoversEvent({ ...base, receiptTs: 0, eventTs: 0 })).toBe(
            false,
        );
    });
});
