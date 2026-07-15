import { describe, it, expect } from "vitest";
import {
    parseMatrixLink,
    linkifyMatrixIdentifiers,
    mergeViaServers,
    matrixToUrl,
} from "./matrixLinks";

describe("parseMatrixLink — matrix.to URLs", () => {
    it("parses a user link", () => {
        expect(
            parseMatrixLink("https://matrix.to/#/@alice:example.org"),
        ).toEqual({
            kind: "user",
            userId: "@alice:example.org",
        });
    });

    it("parses a percent-encoded user link", () => {
        expect(
            parseMatrixLink("https://matrix.to/#/%40alice%3Aexample.org"),
        ).toEqual({ kind: "user", userId: "@alice:example.org" });
    });

    it("parses a room id link", () => {
        expect(
            parseMatrixLink("https://matrix.to/#/!abc123:example.org"),
        ).toEqual({
            kind: "room",
            roomId: "!abc123:example.org",
            via: [],
        });
    });

    it("parses a room id link with an event id", () => {
        expect(
            parseMatrixLink("https://matrix.to/#/!abc:example.org/$ev123"),
        ).toEqual({
            kind: "room",
            roomId: "!abc:example.org",
            eventId: "$ev123",
            via: [],
        });
    });

    it("parses a percent-encoded room + event link", () => {
        expect(
            parseMatrixLink(
                "https://matrix.to/#/%21abc%3Aexample.org/%24ev123",
            ),
        ).toEqual({
            kind: "room",
            roomId: "!abc:example.org",
            eventId: "$ev123",
            via: [],
        });
    });

    it("collects via query parameters", () => {
        expect(
            parseMatrixLink(
                "https://matrix.to/#/!abc:example.org?via=one.org&via=two.org",
            ),
        ).toEqual({
            kind: "room",
            roomId: "!abc:example.org",
            via: ["one.org", "two.org"],
        });
    });

    it("collects via parameters that follow an event id", () => {
        expect(
            parseMatrixLink(
                "https://matrix.to/#/!abc:example.org/$ev?via=one.org",
            ),
        ).toEqual({
            kind: "room",
            roomId: "!abc:example.org",
            eventId: "$ev",
            via: ["one.org"],
        });
    });

    it("parses an alias link", () => {
        expect(parseMatrixLink("https://matrix.to/#/#dev:example.org")).toEqual(
            {
                kind: "alias",
                alias: "#dev:example.org",
                via: [],
            },
        );
    });

    it("parses a percent-encoded alias link", () => {
        expect(
            parseMatrixLink("https://matrix.to/#/%23dev%3Aexample.org"),
        ).toEqual({ kind: "alias", alias: "#dev:example.org", via: [] });
    });

    it("parses an alias link with an event id", () => {
        expect(
            parseMatrixLink("https://matrix.to/#/#dev:example.org/$ev123"),
        ).toEqual({
            kind: "alias",
            alias: "#dev:example.org",
            eventId: "$ev123",
            via: [],
        });
    });

    it("accepts http and a case-insensitive host", () => {
        expect(
            parseMatrixLink("HTTPS://MATRIX.TO/#/@alice:example.org"),
        ).toEqual({ kind: "user", userId: "@alice:example.org" });
        expect(
            parseMatrixLink("http://matrix.to/#/@alice:example.org"),
        ).toEqual({
            kind: "user",
            userId: "@alice:example.org",
        });
    });

    it("trims surrounding whitespace", () => {
        expect(
            parseMatrixLink("  https://matrix.to/#/@alice:example.org "),
        ).toEqual({ kind: "user", userId: "@alice:example.org" });
    });

    it("accepts a v12-style room id without a server part", () => {
        expect(
            parseMatrixLink(
                "https://matrix.to/#/!31bytesofbase64goeshere00000",
            ),
        ).toEqual({
            kind: "room",
            roomId: "!31bytesofbase64goeshere00000",
            via: [],
        });
    });
});

describe("parseMatrixLink — matrix: URIs", () => {
    it("parses a user URI", () => {
        expect(parseMatrixLink("matrix:u/alice:example.org")).toEqual({
            kind: "user",
            userId: "@alice:example.org",
        });
    });

    it("parses a room alias URI", () => {
        expect(parseMatrixLink("matrix:r/dev:example.org")).toEqual({
            kind: "alias",
            alias: "#dev:example.org",
            via: [],
        });
    });

    it("parses a room id URI", () => {
        expect(parseMatrixLink("matrix:roomid/abc:example.org")).toEqual({
            kind: "room",
            roomId: "!abc:example.org",
            via: [],
        });
    });

    it("parses an event URI and restores the $ sigil", () => {
        expect(
            parseMatrixLink("matrix:roomid/abc:example.org/e/ev123"),
        ).toEqual({
            kind: "room",
            roomId: "!abc:example.org",
            eventId: "$ev123",
            via: [],
        });
    });

    it("does not double the $ sigil on an encoded event id", () => {
        expect(
            parseMatrixLink("matrix:roomid/abc:example.org/e/%24ev123"),
        ).toEqual({
            kind: "room",
            roomId: "!abc:example.org",
            eventId: "$ev123",
            via: [],
        });
    });

    it("collects via parameters", () => {
        expect(
            parseMatrixLink("matrix:r/dev:example.org?via=one.org&via=two.org"),
        ).toEqual({
            kind: "alias",
            alias: "#dev:example.org",
            via: ["one.org", "two.org"],
        });
    });

    it("rejects unknown URI types and malformed paths", () => {
        expect(parseMatrixLink("matrix:group/foo:example.org")).toBeNull();
        expect(parseMatrixLink("matrix:roomid/abc:ex.org/wrong/ev")).toBeNull();
        expect(parseMatrixLink("matrix:u/alice:example.org/e/ev")).toBeNull();
        expect(parseMatrixLink("matrix:u/")).toBeNull();
        expect(parseMatrixLink("matrix:")).toBeNull();
    });
});

describe("parseMatrixLink — bare identifiers", () => {
    it("parses a bare user id", () => {
        expect(parseMatrixLink("@alice:example.org")).toEqual({
            kind: "user",
            userId: "@alice:example.org",
        });
    });

    it("parses a bare alias", () => {
        expect(parseMatrixLink("#dev:example.org")).toEqual({
            kind: "alias",
            alias: "#dev:example.org",
            via: [],
        });
    });

    it("parses identifiers with an explicit port", () => {
        expect(parseMatrixLink("@alice:example.org:8448")).toEqual({
            kind: "user",
            userId: "@alice:example.org:8448",
        });
    });

    it("rejects bare room ids (only reachable through URLs)", () => {
        expect(parseMatrixLink("!abc:example.org")).toBeNull();
    });

    it("rejects identifiers without a server part", () => {
        expect(parseMatrixLink("@nodomain")).toBeNull();
        expect(parseMatrixLink("#nocolon")).toBeNull();
        expect(parseMatrixLink("@:example.org")).toBeNull();
    });
});

describe("parseMatrixLink — junk input", () => {
    it("returns null for non-matrix input", () => {
        expect(parseMatrixLink("")).toBeNull();
        expect(parseMatrixLink("   ")).toBeNull();
        expect(parseMatrixLink("hello world")).toBeNull();
        expect(
            parseMatrixLink("https://example.com/#/@alice:example.org"),
        ).toBeNull();
        expect(parseMatrixLink("mailto:alice@example.org")).toBeNull();
    });

    it("returns null for empty or event-only matrix.to paths", () => {
        expect(parseMatrixLink("https://matrix.to/")).toBeNull();
        expect(parseMatrixLink("https://matrix.to/#/")).toBeNull();
        expect(parseMatrixLink("https://matrix.to/#/$ev123")).toBeNull();
    });

    it("returns null for malformed matrix.to paths", () => {
        // second segment must be an event id
        expect(
            parseMatrixLink("https://matrix.to/#/!abc:example.org/notanevent"),
        ).toBeNull();
        // too many segments
        expect(
            parseMatrixLink("https://matrix.to/#/!a:b.c/$ev/extra"),
        ).toBeNull();
        // invalid percent-encoding
        expect(parseMatrixLink("https://matrix.to/#/%E0%A4%A")).toBeNull();
        // event id on a user link is meaningless
        expect(
            parseMatrixLink("https://matrix.to/#/@alice:example.org/$ev"),
        ).toBeNull();
    });
});

describe("linkifyMatrixIdentifiers — bare mentions in escaped plain text", () => {
    const link = (id: string) =>
        `<a href="https://matrix.to/#/${encodeURIComponent(id)}">${id}</a>`;

    it("wraps a user mention mid-sentence", () => {
        expect(linkifyMatrixIdentifiers("ping @alice:example.org now")).toBe(
            `ping ${link("@alice:example.org")} now`,
        );
    });

    it("wraps an alias mention", () => {
        expect(linkifyMatrixIdentifiers("join #dev:example.org")).toBe(
            `join ${link("#dev:example.org")}`,
        );
    });

    it("wraps a mention at the start of the string", () => {
        expect(linkifyMatrixIdentifiers("@alice:example.org hi")).toBe(
            `${link("@alice:example.org")} hi`,
        );
    });

    it("wraps multiple mentions", () => {
        expect(linkifyMatrixIdentifiers("@a:x.org and @b:y.org")).toBe(
            `${link("@a:x.org")} and ${link("@b:y.org")}`,
        );
    });

    it("keeps an explicit port in the identifier", () => {
        expect(linkifyMatrixIdentifiers("cc @alice:example.org:8448")).toBe(
            `cc ${link("@alice:example.org:8448")}`,
        );
    });

    it("excludes trailing punctuation", () => {
        expect(linkifyMatrixIdentifiers("ask @alice:example.org.")).toBe(
            `ask ${link("@alice:example.org")}.`,
        );
        expect(linkifyMatrixIdentifiers("(#dev:example.org)")).toBe(
            `(${link("#dev:example.org")})`,
        );
        expect(linkifyMatrixIdentifiers("ping @alice:example.org!")).toBe(
            `ping ${link("@alice:example.org")}!`,
        );
    });

    it("ignores identifiers glued to a preceding word (emails, URLs)", () => {
        const email = "mail bob@host.com:8080 today";
        expect(linkifyMatrixIdentifiers(email)).toBe(email);
        const url = "see https://matrix.to/#/@a:b.org there";
        expect(linkifyMatrixIdentifiers(url)).toBe(url);
    });

    it("ignores server-less colons like times or issue refs", () => {
        const text = "meet at #1:30pm";
        expect(linkifyMatrixIdentifiers(text)).toBe(text);
    });

    it("leaves text without mentions untouched, entities included", () => {
        const text = "Tom &amp; Jerry &lt;3";
        expect(linkifyMatrixIdentifiers(text)).toBe(text);
    });

    it("linkifies inside spoiler span content", () => {
        expect(
            linkifyMatrixIdentifiers("<span data-mx-spoiler>@a:x.org</span>"),
        ).toBe(`<span data-mx-spoiler>${link("@a:x.org")}</span>`);
    });
});

describe("mergeViaServers", () => {
    it("puts the link's explicit vias first, then resolution servers", () => {
        expect(
            mergeViaServers(["a.org", "b.org"], ["c.org", "d.org"], 5),
        ).toEqual(["a.org", "b.org", "c.org", "d.org"]);
    });

    it("dedupes servers that appear in both lists", () => {
        expect(
            mergeViaServers(["a.org", "b.org"], ["b.org", "a.org", "c.org"], 5),
        ).toEqual(["a.org", "b.org", "c.org"]);
    });

    it("caps the total number of candidates", () => {
        const resolved = Array.from({ length: 889 }, (_, i) => `s${i}.org`);
        const via = mergeViaServers(["a.org"], resolved, 5);
        expect(via).toEqual(["a.org", "s0.org", "s1.org", "s2.org", "s3.org"]);
    });

    it("handles empty inputs", () => {
        expect(mergeViaServers([], [], 5)).toEqual([]);
        expect(mergeViaServers([], ["a.org"], 5)).toEqual(["a.org"]);
    });

    it("defaults to a small cap", () => {
        const resolved = Array.from({ length: 20 }, (_, i) => `s${i}.org`);
        expect(mergeViaServers([], resolved).length).toBeLessThanOrEqual(5);
    });
});

describe("matrixToUrl — build permalinks", () => {
    it("encodes a user id with no via", () => {
        expect(matrixToUrl("@alice:example.org")).toBe(
            "https://matrix.to/#/%40alice%3Aexample.org",
        );
    });
    it("encodes an alias with no via (aliases self-route)", () => {
        expect(matrixToUrl("#dev:example.org", ["ignored.org"])).toBe(
            "https://matrix.to/#/%23dev%3Aexample.org",
        );
    });
    it("appends via params for a room id", () => {
        expect(matrixToUrl("!abc:example.org", ["one.org", "two.org"])).toBe(
            "https://matrix.to/#/%21abc%3Aexample.org?via=one.org&via=two.org",
        );
    });
    it("emits a bare (non-joinable) link for a room id with no via", () => {
        expect(matrixToUrl("!abc:example.org")).toBe(
            "https://matrix.to/#/%21abc%3Aexample.org",
        );
    });
    it("caps via servers at 5", () => {
        const via = ["a", "b", "c", "d", "e", "f", "g"];
        const url = matrixToUrl("!r:s.org", via);
        expect(url.match(/via=/g)?.length).toBe(5);
    });
});
