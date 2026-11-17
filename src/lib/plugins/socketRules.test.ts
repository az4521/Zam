import { describe, it, expect } from "vitest";
import { parseSocketRule, socketAllowed, type SocketRule } from "./socketRules";

describe("parseSocketRule", () => {
    it("parses a tcp rule", () => {
        expect(parseSocketRule("tcp:127.0.0.1:7656")).toEqual({
            protocol: "tcp",
            host: "127.0.0.1",
            port: 7656,
        });
    });

    it("parses a udp rule", () => {
        expect(parseSocketRule("udp:example.org:53")).toEqual({
            protocol: "udp",
            host: "example.org",
            port: 53,
        });
    });

    it("parses * for the host and for the port", () => {
        expect(parseSocketRule("udp:*:*")).toEqual({
            protocol: "udp",
            host: "*",
            port: "*",
        });
        expect(parseSocketRule("tcp:127.0.0.1:*")).toEqual({
            protocol: "tcp",
            host: "127.0.0.1",
            port: "*",
        });
        expect(parseSocketRule("tcp:*:443")).toEqual({
            protocol: "tcp",
            host: "*",
            port: 443,
        });
    });

    it("parses a bracketed IPv6 host without the brackets", () => {
        expect(parseSocketRule("tcp:[::1]:443")).toEqual({
            protocol: "tcp",
            host: "::1",
            port: 443,
        });
    });

    it("lowercases the host", () => {
        expect(parseSocketRule("tcp:LocalHost:80")?.host).toBe("localhost");
        expect(parseSocketRule("tcp:[FE80::1]:80")?.host).toBe("fe80::1");
    });

    it("accepts the port range edges 1 and 65535", () => {
        expect(parseSocketRule("tcp:h:1")?.port).toBe(1);
        expect(parseSocketRule("tcp:h:65535")?.port).toBe(65535);
    });

    it("rejects port 0 and port 65536", () => {
        expect(parseSocketRule("tcp:127.0.0.1:0")).toBeNull();
        expect(parseSocketRule("tcp:127.0.0.1:65536")).toBeNull();
        expect(parseSocketRule("tcp:127.0.0.1:99999")).toBeNull();
    });

    it("rejects garbage", () => {
        for (const raw of [
            "",
            "tcp",
            "tcp:127.0.0.1",
            "http:127.0.0.1:80",
            "tcp:127.0.0.1:http",
            "tcp:127.0.0.1:-1",
            "tcp::80",
            "tcp:host name:80",
            "tcp:127.0.0.1:80 ",
            " tcp:127.0.0.1:80",
            "TCP:127.0.0.1:80",
            "tcp:[::1:443",
        ])
            expect(parseSocketRule(raw), raw).toBeNull();
    });
});

describe("socketAllowed", () => {
    const rules: SocketRule[] = [
        { protocol: "tcp", host: "127.0.0.1", port: 7656 },
    ];

    it("allows an exact match", () => {
        expect(socketAllowed(rules, "tcp", "127.0.0.1", 7656)).toBe(true);
    });

    it("rejects a protocol mismatch", () => {
        expect(socketAllowed(rules, "udp", "127.0.0.1", 7656)).toBe(false);
    });

    it("rejects a different port or host", () => {
        expect(socketAllowed(rules, "tcp", "127.0.0.1", 7657)).toBe(false);
        expect(socketAllowed(rules, "tcp", "127.0.0.2", 7656)).toBe(false);
    });

    it("matches any host for a * host rule", () => {
        const any = [{ protocol: "udp", host: "*", port: 5000 }] as const;
        expect(socketAllowed(any, "udp", "10.1.2.3", 5000)).toBe(true);
        expect(socketAllowed(any, "udp", "example.org", 5000)).toBe(true);
        expect(socketAllowed(any, "udp", "example.org", 5001)).toBe(false);
    });

    it("matches any port for a * port rule", () => {
        const any = [
            { protocol: "tcp", host: "h.example", port: "*" },
        ] as const;
        expect(socketAllowed(any, "tcp", "h.example", 1)).toBe(true);
        expect(socketAllowed(any, "tcp", "h.example", 65535)).toBe(true);
        expect(socketAllowed(any, "tcp", "other.example", 80)).toBe(false);
    });

    it("compares hosts case-insensitively", () => {
        const named = [
            { protocol: "tcp", host: "example.org", port: 443 },
        ] as const;
        expect(socketAllowed(named, "tcp", "EXAMPLE.org", 443)).toBe(true);
    });

    it("ignores brackets around an IPv6 host", () => {
        const v6 = [{ protocol: "tcp", host: "::1", port: 443 }] as const;
        expect(socketAllowed(v6, "tcp", "[::1]", 443)).toBe(true);
        expect(socketAllowed(v6, "tcp", "::1", 443)).toBe(true);
        expect(socketAllowed(v6, "tcp", "[::2]", 443)).toBe(false);
    });

    it("allows nothing with no rules", () => {
        expect(socketAllowed([], "tcp", "127.0.0.1", 80)).toBe(false);
    });
});
