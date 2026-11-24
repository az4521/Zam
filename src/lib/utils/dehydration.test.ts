import { describe, expect, it } from "vitest";
import { dehydrationOptions } from "./dehydration";

describe("dehydrationOptions", () => {
    it("startup only refreshes with a locally cached key and never rehydrates", () => {
        expect(dehydrationOptions("startup")).toEqual({
            createNewKey: false,
            onlyIfKeyCached: true,
            rehydrate: false,
        });
    });

    it("unlock on an already verified session reads 4S but does not rehydrate", () => {
        expect(dehydrationOptions("unlock")).toEqual({
            createNewKey: false,
            onlyIfKeyCached: false,
            rehydrate: false,
        });
    });

    it("unlock that verified a fresh session rehydrates", () => {
        expect(dehydrationOptions("unlock-new-session")).toEqual({
            createNewKey: false,
            onlyIfKeyCached: false,
            rehydrate: true,
        });
    });

    it("new recovery mints a new key", () => {
        expect(dehydrationOptions("recovery-created")).toEqual({
            createNewKey: true,
            onlyIfKeyCached: false,
            rehydrate: false,
        });
    });
});
