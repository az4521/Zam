import { describe, it, expect } from "vitest";
import {
    buildSnippetSegments,
    isSearchUnsupportedError,
} from "./messageSearch";

describe("buildSnippetSegments — split a body into highlightable segments", () => {
    it("returns the whole body as one plain segment when there are no highlights", () => {
        expect(buildSnippetSegments("hello world", [])).toEqual([
            { text: "hello world", highlight: false },
        ]);
    });

    it("returns an empty list for an empty body", () => {
        expect(buildSnippetSegments("", ["term"])).toEqual([]);
    });

    it("marks a matching term as a highlighted segment", () => {
        expect(buildSnippetSegments("say hello there", ["hello"])).toEqual([
            { text: "say ", highlight: false },
            { text: "hello", highlight: true },
            { text: " there", highlight: false },
        ]);
    });

    it("matches case-insensitively but preserves the original casing", () => {
        expect(buildSnippetSegments("Say HELLO there", ["hello"])).toEqual([
            { text: "Say ", highlight: false },
            { text: "HELLO", highlight: true },
            { text: " there", highlight: false },
        ]);
    });

    it("highlights every occurrence of the term", () => {
        expect(buildSnippetSegments("ha ha", ["ha"])).toEqual([
            { text: "ha", highlight: true },
            { text: " ", highlight: false },
            { text: "ha", highlight: true },
        ]);
    });

    it("highlights multiple distinct terms", () => {
        expect(buildSnippetSegments("foo and bar", ["foo", "bar"])).toEqual([
            { text: "foo", highlight: true },
            { text: " and ", highlight: false },
            { text: "bar", highlight: true },
        ]);
    });

    it("treats regex metacharacters in terms literally", () => {
        expect(buildSnippetSegments("i know c++ (well)", ["c++"])).toEqual([
            { text: "i know ", highlight: false },
            { text: "c++", highlight: true },
            { text: " (well)", highlight: false },
        ]);
    });

    it("ignores empty highlight terms", () => {
        expect(buildSnippetSegments("hello", ["", "hello"])).toEqual([
            { text: "hello", highlight: true },
        ]);
    });

    it("keeps HTML in the body as literal text, never markup", () => {
        const segments = buildSnippetSegments(
            '<b onmouseover="x()">bold</b>',
            ["bold"],
        );
        expect(segments).toEqual([
            { text: '<b onmouseover="x()">', highlight: false },
            { text: "bold", highlight: true },
            { text: "</b>", highlight: false },
        ]);
        // Reassembling the segments must reproduce the raw body verbatim —
        // proof that nothing was interpreted, stripped, or entity-decoded.
        expect(segments.map((s) => s.text).join("")).toBe(
            '<b onmouseover="x()">bold</b>',
        );
    });

    it("clips a long body around the first match, marking both cut ends", () => {
        const body = "a".repeat(300) + " needle " + "b".repeat(300);
        const segments = buildSnippetSegments(body, ["needle"], 100);
        const text = segments.map((s) => s.text).join("");
        expect(text.startsWith("…")).toBe(true);
        expect(text.endsWith("…")).toBe(true);
        expect(text.length).toBeLessThanOrEqual(102); // window + 2 ellipses
        expect(segments).toContainEqual({ text: "needle", highlight: true });
    });

    it("clips a long body with no match from the start only", () => {
        const body = "x".repeat(300);
        const segments = buildSnippetSegments(body, ["needle"], 100);
        const text = segments.map((s) => s.text).join("");
        expect(text.startsWith("x")).toBe(true);
        expect(text.endsWith("…")).toBe(true);
        expect(text.length).toBeLessThanOrEqual(101);
        expect(segments.every((s) => !s.highlight)).toBe(true);
    });

    it("leaves a short body unclipped", () => {
        expect(buildSnippetSegments("short", ["nope"], 100)).toEqual([
            { text: "short", highlight: false },
        ]);
    });
});

describe("isSearchUnsupportedError — detect servers without /search", () => {
    it("recognizes M_UNRECOGNIZED", () => {
        expect(isSearchUnsupportedError({ errcode: "M_UNRECOGNIZED" })).toBe(
            true,
        );
    });

    it("rejects other Matrix errcodes", () => {
        expect(isSearchUnsupportedError({ errcode: "M_FORBIDDEN" })).toBe(
            false,
        );
    });

    it("rejects non-error junk", () => {
        expect(isSearchUnsupportedError(null)).toBe(false);
        expect(isSearchUnsupportedError(undefined)).toBe(false);
        expect(isSearchUnsupportedError("M_UNRECOGNIZED")).toBe(false);
        expect(isSearchUnsupportedError({})).toBe(false);
    });
});
