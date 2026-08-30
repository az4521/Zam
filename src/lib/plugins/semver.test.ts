import { describe, it, expect } from "vitest";
import {
    parseSemver,
    isValidSemver,
    compareVersions,
    satisfiesMinAppVersion,
} from "./semver";

describe("parseSemver", () => {
    it("parses a basic semver string", () => {
        expect(parseSemver("1.2.3")).toEqual({
            major: 1,
            minor: 2,
            patch: 3,
            prerelease: [],
        });
    });

    it("parses a semver string with leading v", () => {
        expect(parseSemver("v1.2.3")).toEqual({
            major: 1,
            minor: 2,
            patch: 3,
            prerelease: [],
        });
    });

    it("parses a semver with prerelease", () => {
        expect(parseSemver("1.0.0-beta.1")).toEqual({
            major: 1,
            minor: 0,
            patch: 0,
            prerelease: ["beta", "1"],
        });
    });

    it("parses a semver with build metadata (ignored)", () => {
        expect(parseSemver("1.2.3+build")).toEqual({
            major: 1,
            minor: 2,
            patch: 3,
            prerelease: [],
        });
    });

    it("parses a semver with prerelease and build", () => {
        expect(parseSemver("1.0.0-alpha.1+build.456")).toEqual({
            major: 1,
            minor: 0,
            patch: 0,
            prerelease: ["alpha", "1"],
        });
    });

    it("returns null for incomplete version", () => {
        expect(parseSemver("1.0")).toBeNull();
    });

    it("returns null for too many parts", () => {
        expect(parseSemver("1.2.3.4")).toBeNull();
    });

    it("returns null for non-numeric parts", () => {
        expect(parseSemver("abc")).toBeNull();
        expect(parseSemver("1.x.3")).toBeNull();
    });

    it("returns null for empty string", () => {
        expect(parseSemver("")).toBeNull();
    });

    it("returns null for non-string input", () => {
        expect(parseSemver(123 as any)).toBeNull();
        expect(parseSemver(null as any)).toBeNull();
        expect(parseSemver(undefined as any)).toBeNull();
    });

    it("parses version 0.0.0", () => {
        expect(parseSemver("0.0.0")).toEqual({
            major: 0,
            minor: 0,
            patch: 0,
            prerelease: [],
        });
    });

    it("parses double-digit version numbers", () => {
        expect(parseSemver("1.10.20")).toEqual({
            major: 1,
            minor: 10,
            patch: 20,
            prerelease: [],
        });
    });
});

describe("isValidSemver", () => {
    it("returns true for valid semver strings", () => {
        expect(isValidSemver("1.2.3")).toBe(true);
        expect(isValidSemver("v1.0.0")).toBe(true);
        expect(isValidSemver("2.0.0-beta.1")).toBe(true);
    });

    it("returns false for invalid semver strings", () => {
        expect(isValidSemver("1.0")).toBe(false);
        expect(isValidSemver("1.2.3.4")).toBe(false);
        expect(isValidSemver("abc")).toBe(false);
        expect(isValidSemver("")).toBe(false);
    });

    it("returns false for non-string input", () => {
        expect(isValidSemver(123)).toBe(false);
        expect(isValidSemver(null)).toBe(false);
        expect(isValidSemver(undefined)).toBe(false);
        expect(isValidSemver({})).toBe(false);
        expect(isValidSemver([])).toBe(false);
    });
});

describe("compareVersions", () => {
    it("compares patch versions", () => {
        expect(compareVersions("1.0.0", "1.0.1")).toBe(-1);
        expect(compareVersions("1.0.1", "1.0.0")).toBe(1);
    });

    it("compares minor versions", () => {
        expect(compareVersions("1.1.0", "1.2.0")).toBe(-1);
        expect(compareVersions("1.2.0", "1.1.0")).toBe(1);
    });

    it("compares major versions", () => {
        expect(compareVersions("1.0.0", "2.0.0")).toBe(-1);
        expect(compareVersions("2.0.0", "1.0.0")).toBe(1);
    });

    it("returns 0 for equal versions", () => {
        expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
        expect(compareVersions("v1.2.3", "1.2.3")).toBe(0);
    });

    it("handles numeric ordering correctly (1.9.0 < 1.10.0)", () => {
        expect(compareVersions("1.9.0", "1.10.0")).toBe(-1);
        expect(compareVersions("1.10.0", "1.9.0")).toBe(1);
    });

    it("compares major before minor and patch", () => {
        expect(compareVersions("2.0.0", "1.9.9")).toBe(1);
        expect(compareVersions("1.9.9", "2.0.0")).toBe(-1);
    });

    it("treats prerelease as less than release", () => {
        expect(compareVersions("1.0.0-beta", "1.0.0")).toBe(-1);
        expect(compareVersions("1.0.0", "1.0.0-beta")).toBe(1);
    });

    it("compares prerelease versions", () => {
        expect(compareVersions("1.0.0-alpha", "1.0.0-beta")).toBe(-1);
        expect(compareVersions("1.0.0-beta", "1.0.0-alpha")).toBe(1);
    });

    it("compares numeric prerelease identifiers numerically", () => {
        expect(compareVersions("1.0.0-1", "1.0.0-2")).toBe(-1);
        expect(compareVersions("1.0.0-2", "1.0.0-10")).toBe(-1);
    });

    it("compares prerelease length when all prior equal", () => {
        expect(compareVersions("1.0.0-1", "1.0.0-1.1")).toBe(-1);
        expect(compareVersions("1.0.0-1.1", "1.0.0-1")).toBe(1);
    });

    it("treats numeric identifiers as less than non-numeric", () => {
        expect(compareVersions("1.0.0-1", "1.0.0-alpha")).toBe(-1);
        expect(compareVersions("1.0.0-alpha", "1.0.0-1")).toBe(1);
    });

    it("throws on invalid first argument", () => {
        expect(() => compareVersions("invalid", "1.0.0")).toThrow();
    });

    it("throws on invalid second argument", () => {
        expect(() => compareVersions("1.0.0", "invalid")).toThrow();
    });

    it("ignores build metadata", () => {
        expect(compareVersions("1.0.0+build1", "1.0.0+build2")).toBe(0);
    });
});

describe("satisfiesMinAppVersion", () => {
    it("returns true when min is undefined", () => {
        expect(satisfiesMinAppVersion("1.4.0", undefined)).toBe(true);
    });

    it("returns true when min is null", () => {
        expect(satisfiesMinAppVersion("1.4.0", null)).toBe(true);
    });

    it("returns true when min is empty string", () => {
        expect(satisfiesMinAppVersion("1.4.0", "")).toBe(true);
    });

    it("returns false when appVersion is below min", () => {
        expect(satisfiesMinAppVersion("1.4.0", "1.5.0")).toBe(false);
    });

    it("returns true when appVersion equals min", () => {
        expect(satisfiesMinAppVersion("1.5.0", "1.5.0")).toBe(true);
    });

    it("returns true when appVersion is above min", () => {
        expect(satisfiesMinAppVersion("1.6.0", "1.5.0")).toBe(true);
    });

    it("throws when appVersion is invalid", () => {
        expect(() => satisfiesMinAppVersion("invalid", "1.0.0")).toThrow();
    });

    it("throws when min is present but invalid", () => {
        expect(() => satisfiesMinAppVersion("1.4.0", "invalid")).toThrow();
    });
});
