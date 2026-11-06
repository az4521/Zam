import { describe, it, expect } from "vitest";
import { pickViaServers } from "./roomVia";

describe("pickViaServers", () => {
    it("puts our own server first", () => {
        expect(pickViaServers("mine.org", ["@a:other.org"])).toEqual([
            "mine.org",
            "other.org",
        ]);
    });

    it("returns only our server when no members are known", () => {
        expect(pickViaServers("mine.org", [])).toEqual(["mine.org"]);
    });

    it("orders other servers by how many joined members they have", () => {
        const members = [
            "@a:one.org",
            "@b:two.org",
            "@c:two.org",
            "@d:three.org",
            "@e:two.org",
            "@f:three.org",
        ];
        expect(pickViaServers("mine.org", members, 10)).toEqual([
            "mine.org",
            "two.org",
            "three.org",
            "one.org",
        ]);
        expect(pickViaServers("mine.org", members)).toEqual([
            "mine.org",
            "two.org",
            "three.org",
        ]);
    });

    it("caps the result at max", () => {
        const members = ["@a:one.org", "@b:two.org", "@c:three.org"];
        expect(pickViaServers("mine.org", members, 2)).toEqual([
            "mine.org",
            "one.org",
        ]);
        expect(pickViaServers("mine.org", members, 1)).toEqual(["mine.org"]);
    });

    it("does not count our own server again among members", () => {
        const members = ["@a:mine.org", "@b:mine.org", "@c:other.org"];
        expect(pickViaServers("mine.org", members)).toEqual([
            "mine.org",
            "other.org",
        ]);
    });

    it("skips empty and malformed user ids", () => {
        const members = ["", "nocolon", "@a:", "@b:other.org"];
        expect(pickViaServers("mine.org", members)).toEqual([
            "mine.org",
            "other.org",
        ]);
    });

    it("omits our server when it is unknown", () => {
        expect(pickViaServers("", ["@a:one.org", "@b:two.org"])).toEqual([
            "one.org",
            "two.org",
        ]);
    });

    it("keeps the server part after the first colon only", () => {
        expect(pickViaServers("mine.org", ["@a:host.org:8448"])).toEqual([
            "mine.org",
            "host.org:8448",
        ]);
    });
});
