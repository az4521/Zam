import { describe, it, expect } from "vitest";
import { decideNotificationRoute } from "./notificationRouting";

const SESSION = { userId: "@me:example.org" };

describe("decideNotificationRoute", () => {
    it("navigates when the poster is the account that is signed in", () => {
        expect(
            decideNotificationRoute(
                { roomId: "!r:example.org", userId: "@me:example.org" },
                SESSION,
            ),
        ).toEqual({ action: "navigate", roomId: "!r:example.org" });
    });

    it("drops a notification posted by a different account", () => {
        expect(
            decideNotificationRoute(
                { roomId: "!r:example.org", userId: "@other:example.org" },
                SESSION,
            ),
        ).toEqual({ action: "drop", reason: "other-account" });
    });

    it("drops everything when nobody is signed in", () => {
        for (const session of [{ userId: null }, { userId: undefined }, {}])
            expect(
                decideNotificationRoute(
                    { roomId: "!r:example.org", userId: "@me:example.org" },
                    session,
                ),
            ).toEqual({ action: "drop", reason: "signed-out" });
    });

    it("drops when there is no room to open", () => {
        for (const roomId of [undefined, null, ""])
            expect(
                decideNotificationRoute(
                    { roomId, userId: "@me:example.org" },
                    SESSION,
                ),
            ).toEqual({ action: "drop", reason: "no-room" });
    });

    it("checks the room BEFORE the session, so a signed-out click on a room-less notification still reports no-room", () => {
        expect(
            decideNotificationRoute({ roomId: "" }, { userId: null }),
        ).toEqual({ action: "drop", reason: "no-room" });
    });

    it("navigates when the poster is unknown but somebody is signed in (older builds did not stamp)", () => {
        for (const userId of [undefined, null, ""])
            expect(
                decideNotificationRoute(
                    { roomId: "!r:example.org", userId },
                    SESSION,
                ),
            ).toEqual({ action: "navigate", roomId: "!r:example.org" });
    });

    it("still drops an unknown-poster notification when nobody is signed in", () => {
        expect(
            decideNotificationRoute({ roomId: "!r:example.org" }, {}),
        ).toEqual({ action: "drop", reason: "signed-out" });
    });

    it("compares user ids exactly — no case folding, no trimming", () => {
        expect(
            decideNotificationRoute(
                { roomId: "!r:example.org", userId: "@ME:example.org" },
                SESSION,
            ),
        ).toEqual({ action: "drop", reason: "other-account" });
        expect(
            decideNotificationRoute(
                { roomId: "!r:example.org", userId: " @me:example.org" },
                SESSION,
            ),
        ).toEqual({ action: "drop", reason: "other-account" });
    });

    it("returns the room id it approved, so callers cannot navigate to a different one", () => {
        const decision = decideNotificationRoute(
            { roomId: "!approved:example.org", userId: "@me:example.org" },
            SESSION,
        );
        expect(decision).toEqual({
            action: "navigate",
            roomId: "!approved:example.org",
        });
    });
});
