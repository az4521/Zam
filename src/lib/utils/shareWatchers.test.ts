import { describe, it, expect } from "vitest";
import {
    encodeWatchingAttribute,
    parseWatchingAttribute,
    shareViewers,
} from "./shareWatchers";

describe("encodeWatchingAttribute", () => {
    it("sorts and dedupes identities", () => {
        expect(encodeWatchingAttribute(["@b:x:D2", "@a:x:D1", "@b:x:D2"])).toBe(
            '["@a:x:D1","@b:x:D2"]',
        );
    });

    it("encodes an empty list as an empty array", () => {
        expect(encodeWatchingAttribute([])).toBe("[]");
    });
});

describe("parseWatchingAttribute", () => {
    it("reads a list back, sorted and deduped", () => {
        expect(parseWatchingAttribute('["@b:x:D","@a:x:D","@a:x:D"]')).toEqual([
            "@a:x:D",
            "@b:x:D",
        ]);
    });

    it("returns empty for unset, malformed or non-list values", () => {
        expect(parseWatchingAttribute(undefined)).toEqual([]);
        expect(parseWatchingAttribute("")).toEqual([]);
        expect(parseWatchingAttribute("not json")).toEqual([]);
        expect(parseWatchingAttribute('{"a":1}')).toEqual([]);
    });

    it("drops non-string entries", () => {
        expect(parseWatchingAttribute('["@a:x:D", 3, null]')).toEqual([
            "@a:x:D",
        ]);
    });

    it("round-trips what it encodes", () => {
        const ids = ["@c:x:D1", "@a:x:D2"];
        expect(parseWatchingAttribute(encodeWatchingAttribute(ids))).toEqual([
            "@a:x:D2",
            "@c:x:D1",
        ]);
    });
});

describe("shareViewers", () => {
    const share = "@sharer:x:S1";

    it("lists the distinct users watching the share", () => {
        const watching = {
            "@bob:x:B1": [share],
            "@bob:x:B2": [share],
            "@amy:x:A1": [share, "@other:x:O1"],
            "@cat:x:C1": ["@other:x:O1"],
        };
        expect(shareViewers(watching, share)).toEqual(["@amy:x", "@bob:x"]);
    });

    it("does not count the sharer as a viewer of their own share", () => {
        const watching = {
            "@sharer:x:S1": [share],
            "@sharer:x:S2": [share],
            "@bob:x:B1": [share],
        };
        expect(shareViewers(watching, share)).toEqual(["@bob:x"]);
    });

    it("is empty when nobody watches it", () => {
        expect(shareViewers({ "@bob:x:B1": [] }, share)).toEqual([]);
        expect(shareViewers({}, share)).toEqual([]);
    });
});
