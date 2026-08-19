import { describe, it, expect } from "vitest";
import { shouldQueueSend, classifySendError } from "./sendGating";

describe("shouldQueueSend", () => {
    it("queues when the browser is offline regardless of sync state", () => {
        expect(shouldQueueSend({ syncState: "SYNCING", online: false })).toBe(
            true,
        );
    });
    it("queues when sync state is STOPPED or ERROR", () => {
        expect(shouldQueueSend({ syncState: "STOPPED", online: true })).toBe(
            true,
        );
        expect(shouldQueueSend({ syncState: "ERROR", online: true })).toBe(
            true,
        );
    });
    it("does NOT queue on the healthy / recovering states when online", () => {
        for (const s of [
            "SYNCING",
            "PREPARED",
            "CATCHUP",
            "RECONNECTING",
            null,
            undefined,
        ]) {
            expect(shouldQueueSend({ syncState: s, online: true })).toBe(false);
        }
    });
});

describe("classifySendError", () => {
    it("429 is retriable", () => {
        expect(
            classifySendError({ httpStatus: 429, errcode: "M_LIMIT_EXCEEDED" }),
        ).toBe("retriable");
    });
    it("5xx is retriable", () => {
        expect(classifySendError({ httpStatus: 502 })).toBe("retriable");
    });
    it("4xx (not 429) is terminal", () => {
        expect(
            classifySendError({ httpStatus: 403, errcode: "M_FORBIDDEN" }),
        ).toBe("terminal");
        expect(
            classifySendError({ httpStatus: 413, errcode: "M_TOO_LARGE" }),
        ).toBe("terminal");
    });
    it("a network error with no httpStatus is retriable", () => {
        expect(classifySendError(new Error("Failed to fetch"))).toBe(
            "retriable",
        );
        expect(classifySendError({ name: "ConnectionError" })).toBe(
            "retriable",
        );
    });
    it("null/unknown is retriable", () => {
        expect(classifySendError(null)).toBe("retriable");
    });
});
