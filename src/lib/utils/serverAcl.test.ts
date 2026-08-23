import { describe, it, expect } from "vitest";
import {
    DEFAULT_SERVER_ACL,
    parseServerAcl,
    hasServerAcl,
    serverAclGlobToRegExp,
    isIpLiteralServerName,
    matchesServerAcl,
    validateServerAcl,
    serializeServerAcl,
    parseServerListInput,
    serverListToText,
    type ServerAcl,
} from "./serverAcl";

describe("parseServerAcl", () => {
    it("returns spec defaults for null content", () => {
        expect(parseServerAcl(null)).toEqual({
            allow: [],
            deny: [],
            allowIpLiterals: true,
        });
    });
    it("reads allow/deny/allow_ip_literals when present", () => {
        expect(
            parseServerAcl({
                allow: ["*.example.com", "matrix.org"],
                deny: ["evil.com"],
                allow_ip_literals: false,
            }),
        ).toEqual({
            allow: ["*.example.com", "matrix.org"],
            deny: ["evil.com"],
            allowIpLiterals: false,
        });
    });
    it("drops non-string array entries and defaults a non-boolean flag to true", () => {
        expect(
            parseServerAcl({
                allow: ["ok.com", 5, null],
                allow_ip_literals: "yes",
            }),
        ).toEqual({ allow: ["ok.com"], deny: [], allowIpLiterals: true });
    });
    it("treats a non-array allow as empty (spec: bans everyone)", () => {
        expect(parseServerAcl({ allow: "matrix.org" }).allow).toEqual([]);
    });
});

describe("hasServerAcl", () => {
    it("is false for null/undefined", () => {
        expect(hasServerAcl(null)).toBe(false);
        expect(hasServerAcl(undefined)).toBe(false);
    });
    it("is true for an object (even empty)", () => {
        expect(hasServerAcl({})).toBe(true);
    });
});

describe("serverAclGlobToRegExp", () => {
    it("matches * as zero-or-more and ? as exactly one", () => {
        expect(
            serverAclGlobToRegExp("*.example.com").test("a.b.example.com"),
        ).toBe(true);
        expect(serverAclGlobToRegExp("*.example.com").test("example.com")).toBe(
            false,
        );
        expect(serverAclGlobToRegExp("f?o.com").test("foo.com")).toBe(true);
        expect(serverAclGlobToRegExp("f?o.com").test("fooo.com")).toBe(false);
    });
    it("escapes regex metachars so a dot is literal", () => {
        expect(serverAclGlobToRegExp("a.com").test("axcom")).toBe(false);
        expect(serverAclGlobToRegExp("a.com").test("a.com")).toBe(true);
    });
    it("matches case-insensitively", () => {
        expect(serverAclGlobToRegExp("Matrix.ORG").test("matrix.org")).toBe(
            true,
        );
    });
});

describe("isIpLiteralServerName", () => {
    it("detects IPv4 and bracketed IPv6, with or without a port", () => {
        expect(isIpLiteralServerName("1.2.3.4")).toBe(true);
        expect(isIpLiteralServerName("1.2.3.4:8448")).toBe(true);
        expect(isIpLiteralServerName("[::1]")).toBe(true);
        expect(isIpLiteralServerName("[2001:db8::1]:8448")).toBe(true);
    });
    it("is false for a DNS name", () => {
        expect(isIpLiteralServerName("matrix.org")).toBe(false);
        expect(isIpLiteralServerName("matrix.org:8448")).toBe(false);
    });
});

describe("matchesServerAcl (true = allowed)", () => {
    const base: ServerAcl = { allow: ["*"], deny: [], allowIpLiterals: true };
    it("allows a server matched by allow and not denied", () => {
        expect(matchesServerAcl("matrix.org", base)).toBe(true);
    });
    it("denies a server that matches a deny glob even if allowed", () => {
        expect(
            matchesServerAcl("evil.com", {
                allow: ["*"],
                deny: ["evil.com"],
                allowIpLiterals: true,
            }),
        ).toBe(false);
    });
    it("denies a server not in allow", () => {
        expect(
            matchesServerAcl("other.com", {
                allow: ["matrix.org"],
                deny: [],
                allowIpLiterals: true,
            }),
        ).toBe(false);
    });
    it("denies an IP literal when allow_ip_literals is false", () => {
        expect(
            matchesServerAcl("1.2.3.4", {
                allow: ["*"],
                deny: [],
                allowIpLiterals: false,
            }),
        ).toBe(false);
    });
    it("ignores the port when matching the host", () => {
        expect(matchesServerAcl("matrix.org:8448", base)).toBe(true);
    });
    it("denies everyone when allow is empty", () => {
        expect(
            matchesServerAcl("matrix.org", {
                allow: [],
                deny: [],
                allowIpLiterals: true,
            }),
        ).toBe(false);
    });
});

describe("validateServerAcl warnings", () => {
    it("warns when the allow list is empty", () => {
        const w = validateServerAcl(
            { allow: [], deny: [], allowIpLiterals: true },
            "matrix.org",
        ).warnings;
        expect(w.some((s) => /allow/i.test(s))).toBe(true);
    });
    it("warns when deny contains '*'", () => {
        const w = validateServerAcl(
            { allow: ["*"], deny: ["*"], allowIpLiterals: true },
            "matrix.org",
        ).warnings;
        expect(
            w.some((s) => /\*/.test(s) && /deny|ban|all servers/i.test(s)),
        ).toBe(true);
    });
    it("warns when the config bans your own server", () => {
        const w = validateServerAcl(
            { allow: ["good.com"], deny: [], allowIpLiterals: true },
            "matrix.org",
        ).warnings;
        expect(w.some((s) => /matrix\.org/.test(s))).toBe(true);
    });
    it("no warnings for an allow-all, own-server-included config", () => {
        expect(
            validateServerAcl(
                { allow: ["*"], deny: [], allowIpLiterals: true },
                "matrix.org",
            ).warnings,
        ).toEqual([]);
    });
});

describe("serializeServerAcl", () => {
    it("trims, drops empties, dedupes, keeps the flag", () => {
        expect(
            serializeServerAcl({
                allow: [
                    " *.example.com ",
                    "",
                    "  ",
                    "matrix.org",
                    "matrix.org",
                ],
                deny: ["evil.com "],
                allowIpLiterals: false,
            }),
        ).toEqual({
            allow: ["*.example.com", "matrix.org"],
            deny: ["evil.com"],
            allow_ip_literals: false,
        });
    });
});

describe("parseServerListInput / serverListToText", () => {
    it("splits on newlines and commas, trims, drops empties, dedupes", () => {
        expect(parseServerListInput("a.com, b.com\n\n a.com \nc.com")).toEqual([
            "a.com",
            "b.com",
            "c.com",
        ]);
    });
    it("round-trips a list to newline-joined text", () => {
        expect(serverListToText(["a.com", "b.com"])).toBe("a.com\nb.com");
    });
});

describe("DEFAULT_SERVER_ACL", () => {
    it("is allow-all", () => {
        expect(DEFAULT_SERVER_ACL).toEqual({
            allow: ["*"],
            deny: [],
            allowIpLiterals: true,
        });
    });
});
