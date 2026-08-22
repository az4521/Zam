import { describe, it, expect } from "vitest";
import { mayRedactEvent, normalizeRedactionReason } from "./redaction";

describe("mayRedactEvent", () => {
    it("always allows redacting your own event, whatever your power level", () => {
        expect(
            mayRedactEvent({
                isOwnEvent: true,
                myPowerLevel: 0,
                redactLevel: 50,
            }),
        ).toBe(true);
    });

    it("allows redacting another's event at exactly the redact level", () => {
        expect(
            mayRedactEvent({
                isOwnEvent: false,
                myPowerLevel: 50,
                redactLevel: 50,
            }),
        ).toBe(true);
    });

    it("allows redacting another's event above the redact level", () => {
        expect(
            mayRedactEvent({
                isOwnEvent: false,
                myPowerLevel: 100,
                redactLevel: 50,
            }),
        ).toBe(true);
    });

    it("denies redacting another's event below the redact level", () => {
        expect(
            mayRedactEvent({
                isOwnEvent: false,
                myPowerLevel: 49,
                redactLevel: 50,
            }),
        ).toBe(false);
    });

    it("allows anyone to redact others when the redact level is 0", () => {
        expect(
            mayRedactEvent({
                isOwnEvent: false,
                myPowerLevel: 0,
                redactLevel: 0,
            }),
        ).toBe(true);
    });
});

describe("normalizeRedactionReason", () => {
    it("trims surrounding whitespace", () => {
        expect(normalizeRedactionReason("  spam  ")).toBe("spam");
    });

    it("returns undefined for an empty string", () => {
        expect(normalizeRedactionReason("")).toBeUndefined();
    });

    it("returns undefined for whitespace only", () => {
        expect(normalizeRedactionReason("   ")).toBeUndefined();
    });

    it("passes a normal reason through", () => {
        expect(normalizeRedactionReason("off topic")).toBe("off topic");
    });
});
