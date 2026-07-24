import { describe, it, expect } from "vitest";
import { canSendReceipt } from "./receiptGate";

describe("canSendReceipt — only send read receipts for events the user could see", () => {
    it("requires focus AND visibility", () => {
        expect(canSendReceipt({ hasFocus: true, visible: true })).toBe(true);
        expect(canSendReceipt({ hasFocus: false, visible: true })).toBe(false);
        expect(canSendReceipt({ hasFocus: true, visible: false })).toBe(false);
    });

    it("returns false when neither focused nor visible", () => {
        expect(canSendReceipt({ hasFocus: false, visible: false })).toBe(false);
    });
});
