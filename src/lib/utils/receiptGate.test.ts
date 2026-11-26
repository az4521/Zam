import { describe, it, expect } from "vitest";
import { canSendReceipt } from "./receiptGate";
import { IDLE_LIMIT_MS } from "./activeSession";

const NOW = 1_000_000_000;
const here = {
    hasFocus: true,
    visible: true,
    lastInputTs: NOW - 1_000,
    now: NOW,
};

describe("canSendReceipt — only send read receipts for events the user could see", () => {
    it("sends when focused, visible and recently used", () => {
        expect(canSendReceipt(here)).toBe(true);
    });

    it("requires focus AND visibility", () => {
        expect(canSendReceipt({ ...here, hasFocus: false })).toBe(false);
        expect(canSendReceipt({ ...here, visible: false })).toBe(false);
        expect(
            canSendReceipt({ ...here, hasFocus: false, visible: false }),
        ).toBe(false);
    });

    it("holds receipts in a focused window nobody has touched for the idle limit", () => {
        // The phone-notification bug: a desktop left open on a room marked
        // every new message read, so the phone dropped each push.
        expect(
            canSendReceipt({ ...here, lastInputTs: NOW - IDLE_LIMIT_MS }),
        ).toBe(false);
        expect(
            canSendReceipt({ ...here, lastInputTs: NOW - IDLE_LIMIT_MS + 1 }),
        ).toBe(true);
    });

    it("holds receipts before any input is recorded", () => {
        expect(canSendReceipt({ ...here, lastInputTs: null })).toBe(false);
    });
});
