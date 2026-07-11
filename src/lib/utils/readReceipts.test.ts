import { describe, it, expect } from "vitest";
import { receiptTypeForSetting } from "./readReceipts";

describe("receiptTypeForSetting — pick the read-receipt wire type", () => {
    it("sends public m.read receipts by default", () => {
        expect(receiptTypeForSetting(false)).toBe("m.read");
    });

    it("sends m.read.private when private read receipts are enabled", () => {
        expect(receiptTypeForSetting(true)).toBe("m.read.private");
    });
});
