import { describe, it, expect } from "vitest";
import { findFailedRedactionEcho } from "./redactionEcho";

interface MockEvent {
    isRedaction(): boolean;
    getAssociatedId(): string | undefined;
    status: string | null;
}

function mockRedaction(targetId: string, status: string | null): MockEvent {
    return {
        isRedaction: () => true,
        getAssociatedId: () => targetId,
        status,
    };
}

function mockNormalEvent(status: string | null): MockEvent {
    return {
        isRedaction: () => false,
        getAssociatedId: () => undefined,
        status,
    };
}

describe("findFailedRedactionEcho", () => {
    it("returns the last failed redaction echo for the target event", () => {
        const pending: MockEvent[] = [
            mockNormalEvent("not_sent"),
            mockRedaction("$target", "not_sent"),
            mockNormalEvent("queued"),
            mockRedaction("$other", "not_sent"),
            mockRedaction("$target", "not_sent"), // last one
        ];
        const result = findFailedRedactionEcho(pending, "$target", "not_sent");
        expect(result).toBe(pending[4]);
    });

    it("returns undefined when no redaction matches the target", () => {
        const pending: MockEvent[] = [
            mockRedaction("$other1", "not_sent"),
            mockRedaction("$other2", "not_sent"),
        ];
        const result = findFailedRedactionEcho(pending, "$target", "not_sent");
        expect(result).toBeUndefined();
    });

    it("returns undefined when the redaction has a different status", () => {
        const pending: MockEvent[] = [
            mockRedaction("$target", "queued"),
            mockRedaction("$target", "sending"),
        ];
        const result = findFailedRedactionEcho(pending, "$target", "not_sent");
        expect(result).toBeUndefined();
    });

    it("returns undefined when the matching event is not a redaction", () => {
        const pending: MockEvent[] = [mockNormalEvent("not_sent")];
        const result = findFailedRedactionEcho(pending, "$target", "not_sent");
        expect(result).toBeUndefined();
    });

    it("returns undefined for an empty pending list", () => {
        const result = findFailedRedactionEcho([], "$target", "not_sent");
        expect(result).toBeUndefined();
    });

    it("picks the LAST match when multiple redactions meet all criteria", () => {
        const pending: MockEvent[] = [
            mockRedaction("$target", "not_sent"),
            mockNormalEvent("queued"),
            mockRedaction("$target", "not_sent"), // this one
        ];
        const result = findFailedRedactionEcho(pending, "$target", "not_sent");
        expect(result).toBe(pending[2]);
    });

    it("ignores redactions with null status", () => {
        const pending: MockEvent[] = [
            mockRedaction("$target", null),
            mockRedaction("$target", "not_sent"),
        ];
        const result = findFailedRedactionEcho(pending, "$target", "not_sent");
        expect(result).toBe(pending[1]);
    });
});
