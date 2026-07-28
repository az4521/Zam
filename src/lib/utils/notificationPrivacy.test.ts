import { describe, it, expect } from "vitest";
import { notificationBody } from "./notificationPrivacy";

describe("notificationBody", () => {
    it("shows sender and body when privacy is off", () => {
        expect(
            notificationBody({
                sender: "Alice",
                body: "see you at 8",
                hideBody: false,
            }),
        ).toBe("Alice: see you at 8");
    });

    it("hides the body when privacy is on", () => {
        expect(
            notificationBody({
                sender: "Alice",
                body: "see you at 8",
                hideBody: true,
            }),
        ).toBe("Alice sent a message");
    });

    it("falls back to the generic line when there is no body", () => {
        expect(
            notificationBody({ sender: "Alice", body: "", hideBody: false }),
        ).toBe("Alice sent a message");
    });

    it("never leaks the body through a blank sender", () => {
        expect(
            notificationBody({ sender: "", body: "secret", hideBody: true }),
        ).toBe("New message");
    });

    it("never leaks the body through a whitespace-only sender", () => {
        expect(
            notificationBody({ sender: "   ", body: "secret", hideBody: true }),
        ).toBe("New message");
    });

    it("uses the bare body when the sender is whitespace-only and privacy is off", () => {
        expect(
            notificationBody({ sender: "   ", body: "hello", hideBody: false }),
        ).toBe("hello");
    });

    it("uses the bare body when the sender is unknown and privacy is off", () => {
        expect(
            notificationBody({ sender: "", body: "hello", hideBody: false }),
        ).toBe("hello");
    });

    it("returns the generic line when both sender and body are missing", () => {
        expect(
            notificationBody({ sender: "", body: "", hideBody: false }),
        ).toBe("New message");
    });

    it("treats a whitespace-only body as empty", () => {
        expect(
            notificationBody({ sender: "Alice", body: "   ", hideBody: false }),
        ).toBe("Alice sent a message");
    });

    it("hides an encrypted-message placeholder body too", () => {
        // previewForEvent() substitutes this for an undecryptable event; with
        // privacy on the notification must not advertise it either.
        expect(
            notificationBody({
                sender: "Alice",
                body: "🔒 Encrypted message",
                hideBody: true,
            }),
        ).toBe("Alice sent a message");
    });
});
