import { describe, it, expect } from "vitest";
import {
    MAX_THREAD_NAME_LENGTH,
    buildThreadNameContent,
    normalizeThreadName,
    parseThreadName,
} from "./threadName";

describe("normalizeThreadName", () => {
    it("collapses whitespace and trims", () => {
        expect(normalizeThreadName("  release \n  plan\t")).toBe(
            "release plan",
        );
    });

    it("caps the length", () => {
        const long = "a".repeat(MAX_THREAD_NAME_LENGTH + 20);
        expect(normalizeThreadName(long)).toHaveLength(MAX_THREAD_NAME_LENGTH);
    });
});

describe("parseThreadName", () => {
    it("reads a string name", () => {
        expect(parseThreadName({ name: "Release plan" })).toBe("Release plan");
    });

    it("treats empty, blank, missing and junk content as unnamed", () => {
        expect(parseThreadName({})).toBeNull();
        expect(parseThreadName({ name: "" })).toBeNull();
        expect(parseThreadName({ name: "   " })).toBeNull();
        expect(parseThreadName({ name: 42 })).toBeNull();
        expect(parseThreadName(null)).toBeNull();
        expect(parseThreadName("name")).toBeNull();
    });

    it("normalises what another client wrote", () => {
        expect(parseThreadName({ name: " a\n b " })).toBe("a b");
    });
});

describe("buildThreadNameContent", () => {
    it("writes the cleaned name", () => {
        expect(buildThreadNameContent("  Release  plan ")).toEqual({
            name: "Release plan",
        });
    });

    it("writes empty content to clear the name", () => {
        expect(buildThreadNameContent("   ")).toEqual({});
    });
});
