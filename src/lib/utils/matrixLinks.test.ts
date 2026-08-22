import { describe, it, expect } from "vitest";
import {
    parseMatrixLink,
    linkifyMatrixIdentifiers,
    linkifyPlainText,
    mergeViaServers,
    matrixToUrl,
    matrixLinkTitle,
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
    it("appends an event id segment for a room-id permalink", () => {
        expect(matrixToUrl("!abc:example.org", ["one.org"], "$evt123")).toBe(
            "https://matrix.to/#/%21abc%3Aexample.org/%24evt123?via=one.org",
        );
    });
    it("appends via for an ALIAS event permalink (event links need a routing server)", () => {
        expect(matrixToUrl("#dev:example.org", ["one.org"], "$evt123")).toBe(
            "https://matrix.to/#/%23dev%3Aexample.org/%24evt123?via=one.org",
        );
    });
    it("emits an event permalink with no via when none given", () => {
        expect(matrixToUrl("!abc:example.org", [], "$evt123")).toBe(
            "https://matrix.to/#/%21abc%3Aexample.org/%24evt123",
        );
    });
    it("caps via at 5 on an event permalink", () => {
        const url = matrixToUrl(
            "!r:s.org",
            ["a", "b", "c", "d", "e", "f"],
            "$e",
        );
        expect(url.match(/via=/g)?.length).toBe(5);
    });
    it("round-trips a room event permalink through parseMatrixLink", () => {
        const url = matrixToUrl("!abc:example.org", ["one.org"], "$evt123");
        expect(parseMatrixLink(url)).toEqual({
            kind: "room",
            roomId: "!abc:example.org",
            eventId: "$evt123",
            via: ["one.org"],
        });
    });
    it("round-trips an alias event permalink through parseMatrixLink", () => {
        const url = matrixToUrl("#dev:example.org", ["one.org"], "$evt123");
        expect(parseMatrixLink(url)).toEqual({
            kind: "alias",
            alias: "#dev:example.org",
            eventId: "$evt123",
            via: ["one.org"],
        });
    });
});

describe("linkifyPlainText — URLs in received plain-text bodies", () => {
    // Reported 2026-07-25: a matrix.to room link pasted into a DM rendered as
    // dead text. Only bare @user/#alias mentions were linkified, so plain URLs
    // produced no anchor at all — and with no anchor, the in-app matrix.to
    // click handler had nothing to intercept.
    it("anchors a matrix.to room link so the click handler can join it", () => {
        const html = linkifyPlainText(
            "https://matrix.to/#/!piTs4GiwT9oGJ5hg8y:matrix.crafty.moe",
        );
        expect(html).toBe(
            '<a href="https://matrix.to/#/!piTs4GiwT9oGJ5hg8y:matrix.crafty.moe">' +
                "https://matrix.to/#/!piTs4GiwT9oGJ5hg8y:matrix.crafty.moe</a>",
        );
        // …and the href it produces must be one the app can route.
        expect(
            parseMatrixLink(
                "https://matrix.to/#/!piTs4GiwT9oGJ5hg8y:matrix.crafty.moe",
            ),
        ).toEqual({
            kind: "room",
            roomId: "!piTs4GiwT9oGJ5hg8y:matrix.crafty.moe",
            via: [],
        });
    });

    it("keeps ?via= servers intact through HTML escaping", () => {
        // The body arrives escaped, so & is already &amp; — the href must keep
        // it (browsers decode it back) or the join loses its via servers.
        const escaped =
            "https://matrix.to/#/!r:crafty.moe?via=matrix.crafty.moe&amp;via=matrix.org";
        const html = linkifyPlainText(escaped);
        expect(html).toContain('href="' + escaped + '"');
        expect(
            parseMatrixLink(
                "https://matrix.to/#/!r:crafty.moe?via=matrix.crafty.moe&via=matrix.org",
            ),
        ).toEqual({
            kind: "room",
            roomId: "!r:crafty.moe",
            via: ["matrix.crafty.moe", "matrix.org"],
        });
    });

    it("anchors ordinary web links too", () => {
        expect(linkifyPlainText("see https://example.org/x for more")).toBe(
            'see <a href="https://example.org/x">https://example.org/x</a> for more',
        );
    });

    it("still linkifies bare mentions alongside URLs", () => {
        const html = linkifyPlainText(
            "ping @alice:example.org see https://a.io",
        );
        expect(html).toContain(
            'href="https://matrix.to/#/%40alice%3Aexample.org"',
        );
        expect(html).toContain('href="https://a.io"');
    });

    it("does not linkify inside a URL that contains an alias", () => {
        // A single anchor, not a mention anchor nested inside a URL anchor.
        const html = linkifyPlainText("https://matrix.to/#/#dev:example.org");
        expect(html.match(/<a /g)?.length).toBe(1);
    });

    it("leaves text with no links untouched", () => {
        expect(linkifyPlainText("just talking about 1:30pm")).toBe(
            "just talking about 1:30pm",
        );
    });

    it("never introduces a tag from already-escaped markup", () => {
        // Input is HTML-escaped; a would-be tag must stay inert.
        const html = linkifyPlainText(
            "&lt;img src=x onerror=1&gt; https://a.io",
        );
        expect(html).not.toContain("<img");
        expect(html).toContain('<a href="https://a.io">');
    });
});

describe("matrixLinkTitle", () => {
    it("returns the full user id for a user permalink", () => {
        expect(matrixLinkTitle("https://matrix.to/#/@alice:example.org")).toBe(
            "@alice:example.org",
        );
    });

    it("returns the full user id for a matrix: user URI", () => {
        expect(matrixLinkTitle("matrix:u/alice:example.org")).toBe(
            "@alice:example.org",
        );
    });

    it("returns null for a room link", () => {
        expect(
            matrixLinkTitle("https://matrix.to/#/!abc123:example.org"),
        ).toBeNull();
    });

    it("returns null for a non-matrix link", () => {
        expect(matrixLinkTitle("https://example.com/page")).toBeNull();
    });

    it("returns null for a missing or empty href", () => {
        expect(matrixLinkTitle(null)).toBeNull();
        expect(matrixLinkTitle(undefined)).toBeNull();
        expect(matrixLinkTitle("")).toBeNull();
    });
});
