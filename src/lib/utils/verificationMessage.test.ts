import { describe, it, expect } from "vitest";
import {
    VERIFICATION_REQUEST_MSGTYPE,
    isVerificationRequestMessage,
    verificationRequestMessageView,
} from "./verificationMessage";

describe("isVerificationRequestMessage", () => {
    it("matches an in-room verification request", () => {
        // Verified against a real cross-server request event 2026-07-25: it is
        // an m.room.message whose msgtype carries the verification type.
        expect(
            isVerificationRequestMessage(
                "m.room.message",
                VERIFICATION_REQUEST_MSGTYPE,
            ),
        ).toBe(true);
    });

    it("ignores ordinary messages", () => {
        expect(isVerificationRequestMessage("m.room.message", "m.text")).toBe(
            false,
        );
    });

    it("ignores the to-device-style verification events that follow", () => {
        // m.key.verification.ready/start/accept/key/mac/done are their own
        // top-level types, not m.room.message — they must not render as cards.
        expect(
            isVerificationRequestMessage("m.key.verification.done", ""),
        ).toBe(false);
        expect(
            isVerificationRequestMessage(
                "m.key.verification.start",
                VERIFICATION_REQUEST_MSGTYPE,
            ),
        ).toBe(false);
    });
});

describe("verificationRequestMessageView", () => {
    it("offers Verify/Decline for a pending request from someone else", () => {
        const view = verificationRequestMessageView({
            isOwn: false,
            senderName: "az4521",
            pending: true,
        });
        expect(view.heading).toBe("az4521 wants to verify");
        expect(view.showActions).toBe(true);
    });

    it("never offers actions on our own request", () => {
        const view = verificationRequestMessageView({
            isOwn: true,
            senderName: "MYSTRAVIL",
            pending: true,
        });
        expect(view.heading).toBe("Verification request sent");
        expect(view.subtitle).toBe("Waiting for them to accept…");
        expect(view.showActions).toBe(false);
    });

    it("reports a settled request as no longer pending, without actions", () => {
        const theirs = verificationRequestMessageView({
            isOwn: false,
            senderName: "az4521",
            pending: false,
        });
        expect(theirs.heading).toBe("az4521 sent a verification request");
        expect(theirs.subtitle).toBe("No longer pending");
        expect(theirs.showActions).toBe(false);

        const ours = verificationRequestMessageView({
            isOwn: true,
            senderName: "MYSTRAVIL",
            pending: false,
        });
        expect(ours.subtitle).toBe("No longer pending");
        expect(ours.showActions).toBe(false);
    });

    it("never leaks the misleading spec fallback wording", () => {
        // The whole point: the event body says "your client does not support
        // in-chat key verification", which is false for this client.
        for (const isOwn of [true, false]) {
            for (const pending of [true, false]) {
                const view = verificationRequestMessageView({
                    isOwn,
                    senderName: "az4521",
                    pending,
                });
                expect(view.heading + view.subtitle).not.toMatch(
                    /does not support/i,
                );
            }
        }
    });
});
