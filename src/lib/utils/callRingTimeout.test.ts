import { describe, it, expect } from "vitest";
import { CALL_RING_TIMEOUT_MS } from "./callRingTimeout";

describe("callRingTimeout", () => {
    it("exposes a 45s ring timeout", () => {
        expect(CALL_RING_TIMEOUT_MS).toBe(45000);
    });
});
