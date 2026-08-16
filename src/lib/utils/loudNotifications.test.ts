import { describe, it, expect } from "vitest";
import { isLoudNotificationRead } from "./loudNotifications";

const RECEIPT = 1_000; // ms

describe("isLoudNotificationRead — decide if a stored notification is read", () => {
    it("is read when the SDK confirms the event was read", () => {
        expect(
            isLoudNotificationRead(
                { eventId: "$a", ts: 5_000 },
                { hasReadEvent: () => true, readReceiptTs: RECEIPT },
            ),
        ).toBe(true);
    });

    it("is NOT read for a newer event the SDK hasn't seen read", () => {
        expect(
            isLoudNotificationRead(
                { eventId: "$a", ts: 5_000 },
                { hasReadEvent: () => false, readReceiptTs: RECEIPT },
            ),
        ).toBe(false);
    });

    it("is read via ts fallback when the event aged out but predates the receipt", () => {
        // hasReadEvent can't locate an unloaded event → false, but the event is
        // older than the read receipt, so the user has read past it.
        expect(
            isLoudNotificationRead(
                { eventId: "$aged", ts: 500 },
                { hasReadEvent: () => false, readReceiptTs: RECEIPT },
            ),
        ).toBe(true);
    });

    it("treats an event exactly at the receipt ts as read", () => {
        expect(
            isLoudNotificationRead(
                { eventId: "$eq", ts: RECEIPT },
                { hasReadEvent: () => false, readReceiptTs: RECEIPT },
            ),
        ).toBe(true);
    });

    it("keeps the entry (unread) when there is no read receipt yet", () => {
        expect(
            isLoudNotificationRead(
                { eventId: "$a", ts: 500 },
                { hasReadEvent: () => false, readReceiptTs: null },
            ),
        ).toBe(false);
    });

    it("falls back to ts when hasReadEvent throws (unloaded/foreign event)", () => {
        expect(
            isLoudNotificationRead(
                { eventId: "$boom", ts: 500 },
                {
                    hasReadEvent: () => {
                        throw new Error("not in timeline");
                    },
                    readReceiptTs: RECEIPT,
                },
            ),
        ).toBe(true);
    });

    it("a throw with no receipt keeps the entry unread (no crash)", () => {
        expect(
            isLoudNotificationRead(
                { eventId: "$boom", ts: 500 },
                {
                    hasReadEvent: () => {
                        throw new Error("not in timeline");
                    },
                    readReceiptTs: null,
                },
            ),
        ).toBe(false);
    });
});
