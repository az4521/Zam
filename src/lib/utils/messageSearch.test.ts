import { describe, it, expect } from "vitest";
import {
    buildSnippetSegments,
    isSearchUnsupportedError,
    parseSearchQuery,
    buildServerSearchFilter,
    matchesParsedQuery,
    parsedQueryNeedsClientRefine,
    isFullMxid,
    type SearchEventMeta,
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
        const segments = buildSnippetSegments('<b onmouseover="x()">bold</b>', [
            "bold",
        ]);
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

const meta = (o: Partial<SearchEventMeta>): SearchEventMeta => ({
    sender: "@a:x",
    msgtype: "m.text",
    body: "",
    isVoice: false,
    ...o,
});

describe("parseSearchQuery", () => {
    it("returns all-free-text for a plain query", () => {
        expect(parseSearchQuery("hello world")).toEqual({
            term: "hello world",
            senders: [],
            has: [],
        });
    });
    it("extracts from: and has: and keeps free text", () => {
        expect(parseSearchQuery("from:@bob:x has:image lunch")).toEqual({
            term: "lunch",
            senders: ["@bob:x"],
            has: ["image"],
        });
    });
    it("does NOT treat a URL as an operator", () => {
        const p = parseSearchQuery("look https://example.com/a:b");
        expect(p.senders).toEqual([]);
        expect(p.has).toEqual([]);
        expect(p.term).toBe("look https://example.com/a:b");
    });
    it("keeps an invalid has: value as free text", () => {
        const p = parseSearchQuery("has:sticker cat");
        expect(p.has).toEqual([]);
        expect(p.term).toBe("has:sticker cat");
    });
    it("drops an empty from: and empty has: from free text", () => {
        const p = parseSearchQuery("from: has: hi");
        expect(p).toEqual({ term: "hi", senders: [], has: [] });
    });
    it("dedupes repeated operators, preserves order", () => {
        const p = parseSearchQuery("from:@a:x from:@a:x has:image has:image");
        expect(p.senders).toEqual(["@a:x"]);
        expect(p.has).toEqual(["image"]);
    });
    it("collects multiple distinct senders and has values", () => {
        const p = parseSearchQuery("from:@a:x from:@b:y has:image has:video");
        expect(p.senders).toEqual(["@a:x", "@b:y"]);
        expect(p.has).toEqual(["image", "video"]);
    });
    it("is case-insensitive on the operator key and has value", () => {
        const p = parseSearchQuery("FROM:@a:x HAS:Image");
        expect(p.senders).toEqual(["@a:x"]);
        expect(p.has).toEqual(["image"]);
    });
    it("collapses to empty term when only operators are present", () => {
        expect(parseSearchQuery("from:@a:x has:link").term).toBe("");
    });
});

describe("isFullMxid", () => {
    it("accepts a full mxid", () =>
        expect(isFullMxid("@bob:example.com")).toBe(true));
    it("rejects a partial", () => expect(isFullMxid("bob")).toBe(false));
    it("rejects @user with no server", () =>
        expect(isFullMxid("@bob")).toBe(false));
});

describe("buildServerSearchFilter", () => {
    it("always scopes to the room", () => {
        expect(buildServerSearchFilter("!r:x", parseSearchQuery("hi"))).toEqual(
            {
                rooms: ["!r:x"],
            },
        );
    });
    it("sends full-mxid senders but not partials", () => {
        const f = buildServerSearchFilter(
            "!r:x",
            parseSearchQuery("from:@a:x from:bob"),
        );
        expect(f.senders).toEqual(["@a:x"]);
    });
    it("omits senders when none are full mxids", () => {
        const f = buildServerSearchFilter("!r:x", parseSearchQuery("from:bob"));
        expect(f.senders).toBeUndefined();
    });
    it("sets contains_url for media has but not for link-only", () => {
        expect(
            buildServerSearchFilter("!r:x", parseSearchQuery("has:image"))
                .contains_url,
        ).toBe(true);
        expect(
            buildServerSearchFilter("!r:x", parseSearchQuery("has:link"))
                .contains_url,
        ).toBeUndefined();
    });
});

describe("matchesParsedQuery", () => {
    const p = parseSearchQuery.bind(null);
    it("matches image msgtype for has:image, rejects video", () => {
        expect(
            matchesParsedQuery(meta({ msgtype: "m.image" }), p("has:image")),
        ).toBe(true);
        expect(
            matchesParsedQuery(meta({ msgtype: "m.video" }), p("has:image")),
        ).toBe(false);
    });
    it("distinguishes audio from voice", () => {
        expect(
            matchesParsedQuery(
                meta({ msgtype: "m.audio", isVoice: false }),
                p("has:audio"),
            ),
        ).toBe(true);
        expect(
            matchesParsedQuery(
                meta({ msgtype: "m.audio", isVoice: true }),
                p("has:audio"),
            ),
        ).toBe(false);
        expect(
            matchesParsedQuery(
                meta({ msgtype: "m.audio", isVoice: true }),
                p("has:voice"),
            ),
        ).toBe(true);
    });
    it("matches a link in the body", () => {
        expect(
            matchesParsedQuery(
                meta({ body: "see http://x.io" }),
                p("has:link"),
            ),
        ).toBe(true);
        expect(
            matchesParsedQuery(meta({ body: "no links here" }), p("has:link")),
        ).toBe(false);
    });
    it("full-mxid sender is exact; partial is substring", () => {
        expect(
            matchesParsedQuery(meta({ sender: "@bob:x" }), p("from:@bob:x")),
        ).toBe(true);
        expect(
            matchesParsedQuery(meta({ sender: "@bobby:x" }), p("from:@bob:x")),
        ).toBe(false);
        expect(
            matchesParsedQuery(meta({ sender: "@bobby:x" }), p("from:bob")),
        ).toBe(true);
    });
    it("ANDs across operators, ORs within", () => {
        const q = p("from:@a:x from:@b:x has:image has:video");
        expect(
            matchesParsedQuery(meta({ sender: "@a:x", msgtype: "m.image" }), q),
        ).toBe(true);
        expect(
            matchesParsedQuery(meta({ sender: "@c:x", msgtype: "m.image" }), q),
        ).toBe(false); // sender fails
        expect(
            matchesParsedQuery(meta({ sender: "@a:x", msgtype: "m.file" }), q),
        ).toBe(false); // has fails
    });
    it("empty parsed query matches anything", () => {
        expect(matchesParsedQuery(meta({}), p("hi"))).toBe(true);
    });
});

describe("parsedQueryNeedsClientRefine", () => {
    it("true for any has:", () =>
        expect(
            parsedQueryNeedsClientRefine(parseSearchQuery("has:image")),
        ).toBe(true));
    it("true for a partial sender", () =>
        expect(parsedQueryNeedsClientRefine(parseSearchQuery("from:bob"))).toBe(
            true,
        ));
    it("false for full-mxid-only from:", () =>
        expect(
            parsedQueryNeedsClientRefine(parseSearchQuery("from:@a:x")),
        ).toBe(false));
    it("false for plain text", () =>
        expect(parsedQueryNeedsClientRefine(parseSearchQuery("hi"))).toBe(
            false,
        ));
});
