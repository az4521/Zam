import { describe, it, expect } from "vitest";
import { parseMxc } from "./mxcUri";

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
