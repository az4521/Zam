import { describe, it, expect, afterEach, vi } from "vitest";
import {
    LogRing,
    redact,
    formatLine,
    installLogCapture,
    getCapturedLogs,
} from "./logCapture";

describe("redact", () => {
    it("removes bearer tokens from Authorization headers", () => {
        expect(redact("Authorization: Bearer abc.DEF-123_xyz")).toBe(
            "Authorization: Bearer <redacted>",
        );
        expect(redact('{"Authorization":"Bearer abc123"}')).toBe(
            '{"Authorization":"Bearer <redacted>"}',
        );
    });

    it("removes access_token and friends from query strings", () => {
        expect(
            redact(
                "GET https://hs/_matrix/client/v3/sync?since=s1&access_token=secret123&timeout=0",
            ),
        ).toBe(
            "GET https://hs/_matrix/client/v3/sync?since=s1&access_token=<redacted>&timeout=0",
        );
        expect(redact("/login?loginToken=abc&x=1")).toBe(
            "/login?loginToken=<redacted>&x=1",
        );
    });

    it("removes secret fields from JSON", () => {
        const out = redact(
            '{"type":"m.login.password","password":"hunter\\"2","user":"@a:b","refresh_token":"r1"}',
        );
        expect(out).toBe(
            '{"type":"m.login.password","password":"<redacted>","user":"@a:b","refresh_token":"<redacted>"}',
        );
    });

    it("removes secret fields written as prose", () => {
        expect(redact("got access_token: abc123, expires soon")).toBe(
            "got access_token: <redacted>, expires soon",
        );
        expect(redact("passphrase=open sesame")).toBe(
            "passphrase=<redacted> sesame",
        );
    });

    it("removes bare Matrix tokens anywhere", () => {
        expect(redact("token is syt_YWxpY2U_AbCdEfGhIjKl_0a1b2c")).toBe(
            "token is <redacted>",
        );
        expect(redact("using mat_0123456789abcdef in a header")).toBe(
            "using <redacted> in a header",
        );
    });

    it("removes recovery keys, spaced or not", () => {
        const key =
            "EsTc 5rr1 4Jhp Uc18 hwCn 2b9T LSvj 5h4T 7ZPe 7Jvu 7hHT eqP4 X2hL";
        // 12 groups after the "EsTc" head is one too many: only a real
        // 12-group key matches.
        const real = key.split(" ").slice(0, 12).join(" ");
        expect(redact(`key: ${real} done`)).toBe("key: <redacted> done");
        expect(redact(`k=${real.replace(/ /g, "")}!`)).toBe("k=<redacted>!");
    });

    it("leaves ordinary lines alone", () => {
        const line =
            "[matrix] rust-crypto init failed for device ABCDEFGH: Error: boom";
        expect(redact(line)).toBe(line);
        expect(redact("sync token s72594_4483_1934 ok")).toBe(
            "sync token s72594_4483_1934 ok",
        );
    });
});

describe("LogRing", () => {
    it("keeps only the newest maxLines lines", () => {
        const ring = new LogRing(3, 1_000);
        for (let i = 1; i <= 5; i++) ring.push(`line ${i}`);
        expect(ring.snapshot()).toEqual(["line 3", "line 4", "line 5"]);
        expect(ring.droppedCount).toBe(2);
        expect(ring.size).toBe(3);
    });

    it("drops old lines to stay under maxChars", () => {
        const ring = new LogRing(100, 10);
        ring.push("aaaa");
        ring.push("bbbb");
        ring.push("cccc");
        expect(ring.snapshot()).toEqual(["bbbb", "cccc"]);
    });

    it("cuts a single line longer than maxChars", () => {
        const ring = new LogRing(10, 5);
        ring.push("abcdefgh");
        expect(ring.snapshot()).toEqual(["abcde"]);
    });

    it("stays correct across internal compaction", () => {
        const ring = new LogRing(10, 1_000_000);
        for (let i = 0; i < 5_000; i++) ring.push(String(i));
        expect(ring.snapshot()).toEqual(
            Array.from({ length: 10 }, (_, i) => String(4_990 + i)),
        );
        ring.clear();
        expect(ring.snapshot()).toEqual([]);
        expect(ring.droppedCount).toBe(0);
    });

    it("returns a copy", () => {
        const ring = new LogRing(10, 100);
        ring.push("a");
        ring.snapshot().push("b");
        expect(ring.snapshot()).toEqual(["a"]);
    });
});

describe("formatLine", () => {
    const now = new Date("2026-10-20T12:34:56.789Z");

    it("prefixes the timestamp and level", () => {
        expect(formatLine("warn", ["hello", 42], now)).toBe(
            "2026-10-20T12:34:56.789Z WARN  hello 42",
        );
    });

    it("formats errors with their message, and objects as JSON", () => {
        const err = new Error("boom");
        const line = formatLine("error", ["failed", err, { a: 1 }], now);
        expect(line).toContain("ERROR failed Error: boom");
        expect(line).toContain('{"a":1}');
    });

    it("survives circular objects", () => {
        const o: Record<string, unknown> = { a: 1 };
        o.self = o;
        expect(formatLine("log", [o], now)).toContain('"self":"[circular]"');
    });

    it("redacts what it formats", () => {
        expect(
            formatLine("info", [{ access_token: "abc", user: "@a:b" }], now),
        ).toContain('"access_token":"<redacted>"');
    });
});

describe("installLogCapture", () => {
    afterEach(() => vi.restoreAllMocks());

    it("records console output, redacted, and still calls the console", () => {
        const spy = vi.spyOn(console, "info").mockImplementation(() => {});
        installLogCapture();
        console.info("login with password=hunter2");
        expect(spy).toHaveBeenCalledWith("login with password=hunter2");
        const last = getCapturedLogs().at(-1)!;
        expect(last).toMatch(/ INFO  login with password=<redacted>$/);
    });
});
