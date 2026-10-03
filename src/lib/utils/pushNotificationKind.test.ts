import { describe, it, expect } from "vitest";
import { pushNotificationKind } from "./pushNotificationKind";

const NOW = 1_800_000_000_000;
const RTC = "org.matrix.msc4075.rtc.notification";

describe("pushNotificationKind", () => {
    it("classifies an SDK rtc.notification ring as a call", () => {
        expect(
            pushNotificationKind(
                RTC,
                { notification_type: "ring", sender_ts: NOW, lifetime: 30_000 },
                true,
                NOW + 1000,
            ),
        ).toBe("call");
    });

    it("treats an rtc.notification that only notifies as a message", () => {
        expect(
            pushNotificationKind(RTC, { notification_type: "notification" }),
        ).toBe("message");
    });

    it("does not ring once an rtc.notification's lifetime has passed", () => {
        expect(
            pushNotificationKind(
                RTC,
                { notification_type: "ring", sender_ts: NOW, lifetime: 30_000 },
                true,
                NOW + 31_000,
            ),
        ).toBe("message");
    });

    it("caps an rtc.notification lifetime at two minutes", () => {
        expect(
            pushNotificationKind(
                RTC,
                {
                    notification_type: "ring",
                    sender_ts: NOW,
                    lifetime: 60 * 60_000,
                },
                true,
                NOW + 3 * 60_000,
            ),
        ).toBe("message");
    });

    it("classifies a ringing unstable MSC4075 call-notify as a call", () => {
        expect(
            pushNotificationKind("org.matrix.msc4075.call.notify", {
                notify_type: "ring",
            }),
        ).toBe("call");
    });

    it("also accepts the stable m.call.notify type", () => {
        expect(
            pushNotificationKind("m.call.notify", { notify_type: "ring" }),
        ).toBe("call");
    });

    it("treats an absent notify_type on a call-notify as a ring (call)", () => {
        expect(pushNotificationKind("org.matrix.msc4075.call.notify")).toBe(
            "call",
        );
    });

    it("treats a non-ring call-notify as a message", () => {
        expect(
            pushNotificationKind("org.matrix.msc4075.call.notify", {
                notify_type: "notify",
            }),
        ).toBe("message");
    });

    it("does not ring outside a DM", () => {
        expect(
            pushNotificationKind(
                "org.matrix.msc4075.call.notify",
                { notify_type: "ring" },
                false,
            ),
        ).toBe("message");
        expect(
            pushNotificationKind(RTC, { notification_type: "ring" }, false),
        ).toBe("message");
    });

    it("classifies a room message as a message", () => {
        expect(pushNotificationKind("m.room.message")).toBe("message");
    });

    it("classifies an undefined type as a message", () => {
        expect(pushNotificationKind(undefined)).toBe("message");
    });
});
