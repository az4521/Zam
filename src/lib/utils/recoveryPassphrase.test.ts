import { describe, it, expect } from "vitest";
import {
    passphraseParams,
    passphraseIssue,
    MIN_PASSPHRASE_LENGTH,
} from "./recoveryPassphrase";

describe("passphraseParams", () => {
    it("returns salt/iterations/bits for a well-formed pbkdf2 key info", () => {
        expect(
            passphraseParams({
                passphrase: {
                    algorithm: "m.pbkdf2",
                    salt: "abc",
                    iterations: 500000,
                    bits: 256,
                },
            }),
        ).toEqual({ salt: "abc", iterations: 500000, bits: 256 });
    });

    it("defaults bits to 256 when the server omits it", () => {
        expect(
            passphraseParams({
                passphrase: {
                    algorithm: "m.pbkdf2",
                    salt: "abc",
                    iterations: 500000,
                },
            }),
        ).toEqual({ salt: "abc", iterations: 500000, bits: 256 });
    });

    it("returns null when the key has no passphrase info (random key)", () => {
        expect(passphraseParams({})).toBeNull();
    });

    it("returns null for null/undefined key info", () => {
        expect(passphraseParams(null)).toBeNull();
        expect(passphraseParams(undefined)).toBeNull();
    });

    it("returns null for an unknown derivation algorithm", () => {
        expect(
            passphraseParams({
                passphrase: {
                    algorithm: "m.something_else",
                    salt: "abc",
                    iterations: 500000,
                },
            }),
        ).toBeNull();
    });

    it("returns null when iterations are missing or non-positive", () => {
        expect(
            passphraseParams({
                passphrase: { algorithm: "m.pbkdf2", salt: "abc" },
            }),
        ).toBeNull();
        expect(
            passphraseParams({
                passphrase: {
                    algorithm: "m.pbkdf2",
                    salt: "abc",
                    iterations: 0,
                },
            }),
        ).toBeNull();
    });

    it("returns null when the salt is missing or empty", () => {
        expect(
            passphraseParams({
                passphrase: { algorithm: "m.pbkdf2", iterations: 10 },
            }),
        ).toBeNull();
        expect(
            passphraseParams({
                passphrase: {
                    algorithm: "m.pbkdf2",
                    salt: "",
                    iterations: 10,
                },
            }),
        ).toBeNull();
    });

    it("returns null for non-positive bits rather than deriving a useless key", () => {
        expect(
            passphraseParams({
                passphrase: {
                    algorithm: "m.pbkdf2",
                    salt: "abc",
                    iterations: 10,
                    bits: 0,
                },
            }),
        ).toBeNull();
    });
});

describe("passphraseIssue", () => {
    it("accepts a long-enough passphrase", () => {
        expect(passphraseIssue("correct horse battery")).toBeNull();
    });

    it("rejects an empty or whitespace-only passphrase", () => {
        expect(passphraseIssue("")).toBe("Enter a passphrase.");
        expect(passphraseIssue("   ")).toBe("Enter a passphrase.");
    });

    it("rejects a passphrase shorter than the minimum", () => {
        expect(passphraseIssue("short")).toBe(
            `Use at least ${MIN_PASSPHRASE_LENGTH} characters.`,
        );
    });

    it("counts leading/trailing spaces as part of the passphrase", () => {
        // The passphrase is used verbatim for derivation, so it must not be
        // trimmed — only the "is it blank" check ignores whitespace.
        expect(passphraseIssue("  abcdef  ")).toBeNull();
    });
});
