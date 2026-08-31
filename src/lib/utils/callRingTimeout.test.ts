import { describe, it, expect } from "vitest";
import { CALL_RING_TIMEOUT_MS, ringDismissDelayMs } from "./callRingTimeout";

describe("callRingTimeout", () => {
    it("exposes a 45s ring timeout", () => {
        expect(CALL_RING_TIMEOUT_MS).toBe(45000);
    });

    it("returns the ring timeout for a call", () => {
        expect(ringDismissDelayMs(true)).toBe(CALL_RING_TIMEOUT_MS);
    });

    it("returns null for a non-call (no auto-dismiss timer)", () => {
        expect(ringDismissDelayMs(false)).toBeNull();
    });
});
