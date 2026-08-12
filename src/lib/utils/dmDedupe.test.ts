import { describe, it, expect } from "vitest";
import { dmDedupeKey, createDmEncryptIntent } from "./dmDedupe";

describe("dmDedupeKey", () => {
    it("builds an account-scoped key when the owner is known", () => {
        expect(dmDedupeKey("@me:hs", "@them:hs")).toBe("@me:hs|@them:hs");
    });

    it("returns null when the owner id is empty (not logged in / whoami pending)", () => {
        expect(dmDedupeKey("", "@them:hs")).toBeNull();
    });

    it("returns null when the owner id is only whitespace", () => {
        expect(dmDedupeKey("   ", "@them:hs")).toBeNull();
    });
});

describe("createDmEncryptIntent", () => {
    it("resolves to the fallback when nothing was raised", () => {
        const ledger = createDmEncryptIntent();
        expect(ledger.resolve("k", false)).toBe(false);
        expect(ledger.resolve("k", true)).toBe(true);
    });

    it("prefers a raised true over a false fallback (true wins a race)", () => {
        const ledger = createDmEncryptIntent();
        ledger.raise("k", true);
        expect(ledger.resolve("k", false)).toBe(true);
    });

    it("treats raise(false) as a no-op (never pins a DM to plaintext)", () => {
        const ledger = createDmEncryptIntent();
        ledger.raise("k", false);
        expect(ledger.resolve("k", true)).toBe(true); // fallback still wins
        ledger.raise("k", true);
        ledger.raise("k", false); // must not lower it
        expect(ledger.resolve("k", false)).toBe(true);
    });

    it("clear() forgets the raised intent", () => {
        const ledger = createDmEncryptIntent();
        ledger.raise("k", true);
        ledger.clear("k");
        expect(ledger.resolve("k", false)).toBe(false);
    });

    it("keys are independent", () => {
        const ledger = createDmEncryptIntent();
        ledger.raise("a", true);
        expect(ledger.resolve("b", false)).toBe(false);
    });
});
