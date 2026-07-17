import { describe, it, expect } from "vitest";
import {
    normalizeRecoveryKey,
    formatRecoveryKey,
    isLikelyRecoveryKey,
} from "./recoveryKey";

// A plausible 48-char base58 encoded recovery key (grouped in fours the way the
// SDK's encodeRecoveryKey emits it). Not parity-valid — these helpers only do
// shape checks; the real decode/parity check is the SDK's in crypto.ts.
const SAMPLE = "EsTc 1v3k 9WpQ rStU vWxy zAbc dEfg hJKL MNPq RSTu VWXy zAbc";

describe("normalizeRecoveryKey", () => {
    it("strips all whitespace to the canonical form", () => {
        expect(normalizeRecoveryKey("ab cd\nef\tgh")).toBe("abcdefgh");
    });

    it("leaves an already-compact key unchanged", () => {
        expect(normalizeRecoveryKey("abcdefgh")).toBe("abcdefgh");
    });

    it("returns empty for whitespace-only input", () => {
        expect(normalizeRecoveryKey("   \n ")).toBe("");
    });
});

describe("formatRecoveryKey", () => {
    it("groups a compact key into space-separated blocks of four", () => {
        expect(formatRecoveryKey("abcdefghij")).toBe("abcd efgh ij");
    });

    it("is idempotent regardless of the input's existing spacing", () => {
        expect(formatRecoveryKey("ab cd efgh ij")).toBe("abcd efgh ij");
        expect(formatRecoveryKey("abcd efgh ij")).toBe("abcd efgh ij");
    });

    it("honours a custom block size", () => {
        expect(formatRecoveryKey("abcdef", 3)).toBe("abc def");
    });

    it("returns empty string for empty/whitespace input", () => {
        expect(formatRecoveryKey("")).toBe("");
        expect(formatRecoveryKey("   ")).toBe("");
    });
});

describe("isLikelyRecoveryKey", () => {
    it("accepts a plausible base58 key (with or without spacing)", () => {
        expect(isLikelyRecoveryKey(SAMPLE)).toBe(true);
        expect(isLikelyRecoveryKey(normalizeRecoveryKey(SAMPLE))).toBe(true);
    });

    it("rejects an empty or too-short key", () => {
        expect(isLikelyRecoveryKey("")).toBe(false);
        expect(isLikelyRecoveryKey("abcd efgh")).toBe(false);
    });

    it("rejects a too-long key", () => {
        expect(isLikelyRecoveryKey("a".repeat(80))).toBe(false);
    });

    it("rejects keys containing non-base58 characters (0, O, I, l)", () => {
        const base = normalizeRecoveryKey(SAMPLE);
        // Splice a forbidden char in without changing the length.
        expect(isLikelyRecoveryKey("0" + base.slice(1))).toBe(false);
        expect(isLikelyRecoveryKey("O" + base.slice(1))).toBe(false);
        expect(isLikelyRecoveryKey("l" + base.slice(1))).toBe(false);
        expect(isLikelyRecoveryKey("I" + base.slice(1))).toBe(false);
    });
});
