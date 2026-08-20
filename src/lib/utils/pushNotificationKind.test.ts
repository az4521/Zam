import { describe, it, expect } from "vitest";
import { pushNotificationKind } from "./pushNotificationKind";

describe("pushNotificationKind", () => {
    it("classifies a ringing m.call.notify as a call", () => {
        expect(pushNotificationKind("m.call.notify", "ring")).toBe("call");
    });

    it("treats an absent notify_type on m.call.notify as a ring (call)", () => {
        expect(pushNotificationKind("m.call.notify")).toBe("call");
    });

    it("treats a non-ring m.call.notify as a message", () => {
        expect(pushNotificationKind("m.call.notify", "notify")).toBe("message");
    });

    it("classifies a room message as a message", () => {
        expect(pushNotificationKind("m.room.message")).toBe("message");
    });

    it("classifies an undefined type as a message", () => {
        expect(pushNotificationKind(undefined)).toBe("message");
    });
});
