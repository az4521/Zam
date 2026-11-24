import { describe, expect, it } from "vitest";
import { isForOtherAccount } from "./nativeCallAccount";

describe("isForOtherAccount", () => {
    it("is true only when the event names a different account", () => {
        expect(isForOtherAccount("@b:hs", "@a:hs")).toBe(true);
        expect(isForOtherAccount("@a:hs", "@a:hs")).toBe(false);
    });
    it("treats an event naming no account as this window's", () => {
        expect(isForOtherAccount(null, "@a:hs")).toBe(false);
        expect(isForOtherAccount(undefined, "@a:hs")).toBe(false);
    });
});
