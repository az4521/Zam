import { describe, it, expect } from "vitest";
import { shouldRequestPersistence } from "./persistentStorage";

describe("shouldRequestPersistence", () => {
    it("requests when the API is available and not already persisted", () => {
        expect(
            shouldRequestPersistence({
                apiAvailable: true,
                alreadyPersisted: false,
            }),
        ).toBe(true);
    });

    it("short-circuits (no request) when already persisted", () => {
        expect(
            shouldRequestPersistence({
                apiAvailable: true,
                alreadyPersisted: true,
            }),
        ).toBe(false);
    });

    it("does not request when the API is unavailable", () => {
        expect(
            shouldRequestPersistence({
                apiAvailable: false,
                alreadyPersisted: false,
            }),
        ).toBe(false);
    });

    it("API-unavailable gate dominates even if flagged persisted", () => {
        expect(
            shouldRequestPersistence({
                apiAvailable: false,
                alreadyPersisted: true,
            }),
        ).toBe(false);
    });
});
