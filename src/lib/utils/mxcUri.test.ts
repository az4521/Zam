import { describe, it, expect } from "vitest";
import { parseMxc, isSameOrigin } from "./mxcUri";

describe("parseMxc", () => {
    it("parses a valid mxc URI", () => {
        expect(parseMxc("mxc://matrix.org/AbC123_-")).toEqual({
            serverName: "matrix.org",
            mediaId: "AbC123_-",
        });
    });

    it("parses a server name with an explicit port", () => {
        expect(parseMxc("mxc://example.com:8448/abc")).toEqual({
            serverName: "example.com:8448",
            mediaId: "abc",
        });
    });

    it("parses an IPv6 literal server name", () => {
        expect(parseMxc("mxc://[::1]:8448/abc")).toEqual({
            serverName: "[::1]:8448",
            mediaId: "abc",
        });
    });

    it("rejects traversal, query, fragment, slash and non-grammar media ids (spec v1.12)", () => {
        for (const bad of [
            "mxc://hs/../secret",
            "mxc://hs/x?width=1",
            "mxc://hs/x#f",
            "mxc://hs/a/b",
            "mxc://hs/a b",
            "mxc://hs?x/y",
            "http://hs/x",
        ]) {
            expect(parseMxc(bad)).toBeNull();
        }
    });

    it("rejects an empty media id and a missing server", () => {
        expect(parseMxc("mxc://hs/")).toBeNull();
        expect(parseMxc("mxc:///abc")).toBeNull();
        expect(parseMxc("")).toBeNull();
    });
});

describe("isSameOrigin", () => {
    const base = "https://matrix.example.com";

    it("accepts a legitimate same-origin homeserver media URL", () => {
        expect(
            isSameOrigin(
                "https://matrix.example.com/_matrix/client/v1/media/download/matrix.example.com/AbC123",
                base,
            ),
        ).toBe(true);
    });

    it("accepts a same-origin URL on a different path (base-path deployment)", () => {
        // origin ignores path/port-default: same scheme+host+port → same origin,
        // so a homeserver mounted under a base path still passes. Base has no
        // trailing slash; the media URL is on a deeper path.
        expect(
            isSameOrigin(
                "https://matrix.example.com/matrix/_matrix/client/v1/media/download/x/y",
                base,
            ),
        ).toBe(true);
    });

    it("rejects a userinfo-smuggling URL whose real host is foreign", () => {
        // Real host is evil.com; `matrix.example.com` is only the userinfo.
        // A raw startsWith(baseUrl) would wrongly ACCEPT this.
        expect(
            isSameOrigin("https://matrix.example.com@evil.com/x.png", base),
        ).toBe(false);
    });

    it("rejects a host-suffix URL (matrix.example.com.evil.com)", () => {
        // A raw startsWith(baseUrl) would wrongly ACCEPT this too.
        expect(
            isSameOrigin("https://matrix.example.com.evil.com/x.png", base),
        ).toBe(false);
    });

    it("rejects a genuinely foreign URL", () => {
        expect(isSameOrigin("https://pbs.twimg.com/x.jpg", base)).toBe(false);
    });

    it("rejects a malformed URL (fail-closed)", () => {
        expect(isSameOrigin("not a url", base)).toBe(false);
        expect(
            isSameOrigin("https://matrix.example.com/x", "also not a url"),
        ).toBe(false);
    });
});
