import { describe, expect, it } from "vitest";
import { iosNotificationHookCall } from "./iosNotificationAction";

const data = { room_id: "!r:x", user_id: "@u:x", event_id: "$e" };

describe("iosNotificationHookCall", () => {
    it("opens the room at the event on a plain tap", () => {
        expect(iosNotificationHookCall("tap", data)).toEqual({
            hook: "__matrixOpenRoom",
            args: ["!r:x", "@u:x", false, "$e"],
        });
    });

    it("routes a reply with its text and the poster account", () => {
        expect(iosNotificationHookCall("zam.reply", data, " hi ")).toEqual({
            hook: "__matrixReplyFromNotification",
            args: ["!r:x", "$e", "hi", "@u:x"],
        });
    });

    it("opens the room for an empty reply", () => {
        expect(iosNotificationHookCall("zam.reply", data, "  ")?.hook).toBe(
            "__matrixOpenRoom",
        );
    });

    it("accepts invites and joins calls", () => {
        expect(iosNotificationHookCall("zam.invite_accept", data)).toEqual({
            hook: "__matrixInviteFromNotification",
            args: ["!r:x", "@u:x", true],
        });
        expect(iosNotificationHookCall("zam.call_join", data)).toEqual({
            hook: "__matrixOpenRoom",
            args: ["!r:x", "@u:x", true, undefined],
        });
    });

    it("ignores native-only actions and payloads without a room", () => {
        expect(iosNotificationHookCall("zam.mark_read", data)).toBeNull();
        expect(iosNotificationHookCall("zam.invite_decline", data)).toBeNull();
        expect(iosNotificationHookCall("tap", { user_id: "@u:x" })).toBeNull();
        expect(iosNotificationHookCall("tap", null)).toBeNull();
    });
});
