import { describe, it, expect } from "vitest";
import { pushNotificationKind } from "./pushNotificationKind";

describe("pushNotificationKind", () => {
    it("classifies a ringing unstable MSC4075 call-notify as a call", () => {
        expect(
            pushNotificationKind("org.matrix.msc4075.call.notify", "ring"),
        ).toBe("call");
    });

    it("also accepts the stable m.call.notify type", () => {
        expect(pushNotificationKind("m.call.notify", "ring")).toBe("call");
    });

    it("treats an absent notify_type on a call-notify as a ring (call)", () => {
        expect(pushNotificationKind("org.matrix.msc4075.call.notify")).toBe(
            "call",
        );
    });

    it("treats a non-ring call-notify as a message", () => {
        expect(
            pushNotificationKind("org.matrix.msc4075.call.notify", "notify"),
        ).toBe("message");
    });

    it("classifies a room message as a message", () => {
        expect(pushNotificationKind("m.room.message")).toBe("message");
    });

    it("classifies an undefined type as a message", () => {
        expect(pushNotificationKind(undefined)).toBe("message");
    });
});
