import { describe, expect, it } from "vitest";
import { requestRefusal } from "./fileTransferRules";

const good = {
    known: true,
    expired: false,
    requesterBlocked: false,
    requesterJoined: true,
    deviceAllowed: true,
    receivers: 0,
    maxReceivers: 3,
};

describe("requestRefusal", () => {
    it("lets a joined member's allowed device in", () => {
        expect(requestRefusal(good)).toBeNull();
    });

    it.each([
        ["unknown-offer", { known: false }],
        ["expired", { expired: true }],
        ["blocked", { requesterBlocked: true }],
        ["not-joined", { requesterJoined: false }],
        ["device-not-allowed", { deviceAllowed: false }],
        ["busy", { receivers: 3 }],
    ])("refuses as %s", (reason, change) => {
        expect(requestRefusal({ ...good, ...change })).toBe(reason);
    });

    it("hides a blocked user's request behind nothing else", () => {
        expect(
            requestRefusal({
                ...good,
                requesterBlocked: true,
                requesterJoined: false,
            }),
        ).toBe("blocked");
    });
});
