import { describe, expect, it } from "vitest";
import {
    CALL_KICK_MAX_AGE_MS,
    callKickKey,
    canDisconnectFromVoice,
    isLiveCallKick,
    kickCoversDevice,
    parseCallKickContent,
} from "./callKick";

describe("canDisconnectFromVoice", () => {
    it("allows a moderator at the kick level who outranks the target", () => {
        expect(canDisconnectFromVoice(50, 0, 50)).toBe(true);
    });

    it("refuses below the room kick level", () => {
        expect(canDisconnectFromVoice(49, 0, 50)).toBe(false);
    });

    it("refuses a target at the same rank or higher", () => {
        expect(canDisconnectFromVoice(50, 50, 50)).toBe(false);
        expect(canDisconnectFromVoice(50, 100, 50)).toBe(false);
    });

    it("refuses acting on oneself", () => {
        expect(canDisconnectFromVoice(100, 100, 50)).toBe(false);
    });
});

describe("parseCallKickContent", () => {
    it("accepts a user-wide kick", () => {
        expect(parseCallKickContent({ user_id: "@a:x", call_id: "" })).toEqual({
            user_id: "@a:x",
            call_id: "",
        });
    });

    it("keeps a device id and reason when given", () => {
        expect(
            parseCallKickContent({
                user_id: "@a:x",
                device_id: "DEV",
                reason: "loud",
            }),
        ).toEqual({ user_id: "@a:x", device_id: "DEV", reason: "loud" });
    });

    it("rejects a missing or non-user id", () => {
        expect(parseCallKickContent({})).toBeNull();
        expect(parseCallKickContent({ user_id: "a:x" })).toBeNull();
        expect(parseCallKickContent({ user_id: 5 })).toBeNull();
    });

    it("rejects an empty or non-string device id", () => {
        expect(
            parseCallKickContent({ user_id: "@a:x", device_id: "" }),
        ).toBeNull();
        expect(
            parseCallKickContent({ user_id: "@a:x", device_id: 1 }),
        ).toBeNull();
    });
});

describe("isLiveCallKick", () => {
    const now = 1_000_000_000;

    it("accepts a kick sent just now", () => {
        expect(isLiveCallKick(now - 1000, now)).toBe(true);
    });

    it("rejects history older than the live window", () => {
        expect(isLiveCallKick(now - CALL_KICK_MAX_AGE_MS - 1, now)).toBe(false);
    });

    it("tolerates small skew but not a far-future timestamp", () => {
        expect(isLiveCallKick(now + 10_000, now)).toBe(true);
        expect(isLiveCallKick(now + 10 * 60_000, now)).toBe(false);
    });
});

describe("kickCoversDevice", () => {
    it("covers every device when no device id is given", () => {
        expect(kickCoversDevice({ user_id: "@a:x" }, "@a:x", "D1")).toBe(true);
    });

    it("covers only the named device", () => {
        const kick = { user_id: "@a:x", device_id: "D1" };
        expect(kickCoversDevice(kick, "@a:x", "D1")).toBe(true);
        expect(kickCoversDevice(kick, "@a:x", "D2")).toBe(false);
    });

    it("never covers another user", () => {
        expect(kickCoversDevice({ user_id: "@a:x" }, "@b:x", "D1")).toBe(false);
    });
});

describe("callKickKey", () => {
    it("separates rooms, users and devices", () => {
        expect(callKickKey("!r", "@a:x", "D1")).not.toBe(
            callKickKey("!s", "@a:x", "D1"),
        );
        expect(callKickKey("!r", "@a:x", "D1")).not.toBe(
            callKickKey("!r", "@a:x", "D2"),
        );
        expect(callKickKey("!r", "@a:x")).toBe(
            callKickKey("!r", "@a:x", undefined),
        );
    });
});
