import { describe, it, expect } from "vitest";
import {
    activeSearchToken,
    filterMemberSuggestions,
    hasValueSuggestions,
    operatorSuggestions,
    applySuggestion,
} from "./searchAutocomplete";

describe("activeSearchToken", () => {
    it("returns null for empty input", () => {
        expect(activeSearchToken("", 0)).toBeNull();
    });
    it("returns null when caret is in whitespace between tokens", () => {
        expect(activeSearchToken("a h", 2)).not.toBeNull(); // caret at 'h'
        expect(activeSearchToken("a  h", 2)).toBeNull(); // caret between the spaces
    });
    it("classifies a from: token with its range", () => {
        const t = activeSearchToken("hi from:bo", 10);
        expect(t).toEqual({ kind: "from", query: "bo", start: 3, end: 10 });
    });
    it("classifies a has: token", () => {
        const t = activeSearchToken("has:im", 6);
        expect(t).toMatchObject({ kind: "has", query: "im", start: 0, end: 6 });
    });
    it("suggests operators for a bare prefix of from/has", () => {
        expect(activeSearchToken("fr", 2)).toMatchObject({
            kind: "operator",
            query: "fr",
        });
        expect(activeSearchToken("ha", 2)).toMatchObject({
            kind: "operator",
            query: "ha",
        });
    });
    it("returns null for a non-operator word", () => {
        expect(activeSearchToken("hello", 5)).toBeNull();
    });
    it("returns null for a URL token", () => {
        expect(activeSearchToken("https://x.io", 12)).toBeNull();
    });
});

describe("filterMemberSuggestions", () => {
    const members = [
        { userId: "@bob:x", displayName: "Bob" },
        { userId: "@alice:x", displayName: "Alice" },
        { userId: "@bobby:x", displayName: "Bobby" },
    ];
    it("matches by userId or display name", () => {
        expect(
            filterMemberSuggestions(members, "bob").map((m) => m.userId),
        ).toEqual(["@bob:x", "@bobby:x"]);
    });
    it("empty query returns all up to limit", () => {
        expect(filterMemberSuggestions(members, "", 2)).toHaveLength(2);
    });
});

describe("hasValueSuggestions", () => {
    it("prefix-filters the has values", () => {
        expect(hasValueSuggestions("i")).toEqual(["image"]);
        expect(hasValueSuggestions("")).toEqual([
            "image",
            "video",
            "file",
            "audio",
            "voice",
            "link",
        ]);
    });
});

describe("operatorSuggestions", () => {
    it("prefix-filters operators", () => {
        expect(operatorSuggestions("f")).toEqual(["from:"]);
        expect(operatorSuggestions("h")).toEqual(["has:"]);
        expect(operatorSuggestions("")).toEqual(["from:", "has:"]);
    });
});

describe("applySuggestion", () => {
    it("replaces the token range and appends a trailing space", () => {
        const token = activeSearchToken("hi from:bo", 10)!;
        const r = applySuggestion("hi from:bo", token, "from:@bob:x");
        expect(r.text).toBe("hi from:@bob:x ");
        expect(r.caret).toBe(r.text.length);
    });
    it("replaces a mid-string token without touching the tail", () => {
        const token = activeSearchToken("has:im lunch", 6)!;
        const r = applySuggestion("has:im lunch", token, "has:image");
        expect(r.text).toBe("has:image  lunch");
        expect(r.caret).toBe("has:image ".length);
    });
    it("omits the trailing space when spaceAfter is false (operator completion)", () => {
        const token = activeSearchToken("fr", 2)!;
        const r = applySuggestion("fr", token, "from:", false);
        expect(r.text).toBe("from:");
        expect(r.caret).toBe("from:".length);
    });
});
