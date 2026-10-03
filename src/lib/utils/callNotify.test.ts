import { describe, it, expect } from "vitest";
import { ringRequested, shouldRingPeers } from "./callNotify";

describe("ringRequested", () => {
    const RTC = "org.matrix.msc4075.rtc.notification";
    it("rings for an SDK rtc.notification ring within its lifetime", () => {
        expect(
            ringRequested(
                RTC,
                {
                    notification_type: "ring",
                    sender_ts: 1000,
                    lifetime: 30_000,
                },
                20_000,
            ),
        ).toBe(true);
    });
    it("stops ringing once the lifetime has passed", () => {
        expect(
            ringRequested(
                RTC,
                {
                    notification_type: "ring",
                    sender_ts: 1000,
                    lifetime: 30_000,
                },
                40_000,
            ),
        ).toBe(false);
    });
    it("rings for an rtc.notification without timing fields", () => {
        expect(ringRequested(RTC, { notification_type: "ring" })).toBe(true);
    });
    it("does not ring for a plain notification", () => {
        expect(ringRequested(RTC, { notification_type: "notification" })).toBe(
            false,
        );
    });
    it("keeps the old call-notify rules", () => {
        expect(ringRequested("org.matrix.msc4075.call.notify", {})).toBe(true);
        expect(ringRequested("m.call.notify", { notify_type: "notify" })).toBe(
            false,
        );
    });
    it("ignores other event types", () => {
        expect(
            ringRequested("m.room.message", { notification_type: "ring" }),
        ).toBe(false);
    });
});

describe("shouldRingPeers", () => {
    it("rings when the local join is first into a DM call", () => {
        expect(shouldRingPeers(true, [])).toBe(true);
    });

    it("stays silent when a peer is already in the DM call (answering)", () => {
        expect(shouldRingPeers(true, ["@dev:hs"])).toBe(false);
    });

    it("never rings outside a DM", () => {
        expect(shouldRingPeers(false, [])).toBe(false);
    });
});
