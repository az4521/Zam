import { describe, expect, it } from "vitest";
import { modalCapabilityGrant, modalOpenIdGrant } from "./widgetModal";

describe("modalCapabilityGrant", () => {
    it("grants only requested capabilities the opener holds", () => {
        const opener = { capabilities: ["a", "b"], openId: null };
        expect([...modalCapabilityGrant(opener, new Set(["b", "c"]))]).toEqual([
            "b",
        ]);
    });

    it("grants nothing without an opener approval", () => {
        expect(modalCapabilityGrant(null, new Set(["a"])).size).toBe(0);
    });
});

describe("modalOpenIdGrant", () => {
    it("allows OpenID only when the opener already allows it", () => {
        expect(modalOpenIdGrant({ capabilities: [], openId: true })).toBe(true);
        expect(modalOpenIdGrant({ capabilities: [], openId: false })).toBe(
            false,
        );
        expect(modalOpenIdGrant({ capabilities: [], openId: null })).toBe(
            false,
        );
        expect(modalOpenIdGrant(null)).toBe(false);
    });
});
