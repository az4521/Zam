import { describe, it, expect } from "vitest";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const serverGuardsPath = join(__dirname, "../../../electron/serverGuards.cjs");
const { resolveStaticPath, isSafeExternalUrl } = require(serverGuardsPath);

describe("resolveStaticPath", () => {
    const buildDir = "C:\\app\\build";

    it("returns null for malformed percent encoding (trailing %)", () => {
        expect(resolveStaticPath(buildDir, "/%")).toBeNull();
    });

    it("returns null for malformed percent encoding (incomplete sequence)", () => {
        expect(resolveStaticPath(buildDir, "/%E0%A4%A")).toBeNull();
    });

    it("returns null for path traversal to sibling directory", () => {
        expect(resolveStaticPath(buildDir, "/../buildX/secret")).toBeNull();
    });

    it("returns null for encoded path traversal", () => {
        expect(resolveStaticPath(buildDir, "/..%2f..%2fetc")).toBeNull();
    });

    it("allows a file whose name merely starts with two dots", () => {
        expect(resolveStaticPath(buildDir, "/..hidden.js")).toBe(
            join(buildDir, "..hidden.js"),
        );
    });

    it("returns buildDir for root path", () => {
        expect(resolveStaticPath(buildDir, "/")).toBe(buildDir);
    });

    it("strips query string and returns valid path", () => {
        expect(resolveStaticPath(buildDir, "/_app/x.js?v=1")).toBe(
            join(buildDir, "_app", "x.js"),
        );
    });

    it("strips fragment and returns valid path", () => {
        expect(resolveStaticPath(buildDir, "/index.html#frag")).toBe(
            join(buildDir, "index.html"),
        );
    });

    it("handles nested valid paths", () => {
        expect(resolveStaticPath(buildDir, "/assets/icons/app.svg")).toBe(
            join(buildDir, "assets", "icons", "app.svg"),
        );
    });

    it("returns null for absolute path traversal", () => {
        expect(resolveStaticPath(buildDir, "/C:/etc/passwd")).toBeNull();
    });

    it("returns null for Windows-style traversal", () => {
        expect(resolveStaticPath(buildDir, "/..\\..\\etc")).toBeNull();
    });
});

describe("isSafeExternalUrl", () => {
    // Valid public URLs
    it("allows https://example.com", () => {
        expect(isSafeExternalUrl("https://example.com")).toBe(true);
    });

    it("allows http://example.com", () => {
        expect(isSafeExternalUrl("http://example.com")).toBe(true);
    });

    it("allows public IPv4", () => {
        expect(isSafeExternalUrl("https://8.8.8.8")).toBe(true);
    });

    it("allows public IPv6", () => {
        expect(isSafeExternalUrl("https://[2001:4860:4860::8888]")).toBe(true);
    });

    // Invalid protocols
    it("blocks javascript: URLs", () => {
        expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    });

    it("blocks file: URLs", () => {
        expect(isSafeExternalUrl("file:///etc/passwd")).toBe(false);
    });

    it("blocks ftp: URLs", () => {
        expect(isSafeExternalUrl("ftp://example.com")).toBe(false);
    });

    // Malformed URLs
    it("blocks garbage URLs", () => {
        expect(isSafeExternalUrl("not a url")).toBe(false);
    });

    it("blocks empty strings", () => {
        expect(isSafeExternalUrl("")).toBe(false);
    });

    // Localhost variations
    it("blocks localhost", () => {
        expect(isSafeExternalUrl("http://localhost")).toBe(false);
    });

    it("blocks *.localhost", () => {
        expect(isSafeExternalUrl("http://foo.localhost")).toBe(false);
    });

    it("blocks a fully qualified localhost with a trailing dot", () => {
        expect(isSafeExternalUrl("http://localhost./")).toBe(false);
        expect(isSafeExternalUrl("http://foo.localhost./")).toBe(false);
    });

    it("blocks IPv4-compatible and NAT64 IPv6 forms of loopback", () => {
        expect(isSafeExternalUrl("http://[::127.0.0.1]/")).toBe(false);
        expect(isSafeExternalUrl("http://[::7f00:1]/")).toBe(false);
        expect(isSafeExternalUrl("http://[64:ff9b::7f00:1]/")).toBe(false);
        expect(isSafeExternalUrl("http://[64:ff9b::192.168.1.1]/")).toBe(false);
    });

    it("allows NAT64 forms of public addresses", () => {
        expect(isSafeExternalUrl("http://[64:ff9b::808:808]/")).toBe(true);
    });

    it("blocks empty host", () => {
        expect(isSafeExternalUrl("http://")).toBe(false);
    });

    // 127.0.0.0/8 (loopback)
    it("blocks 127.0.0.1", () => {
        expect(isSafeExternalUrl("http://127.0.0.1")).toBe(false);
    });

    it("blocks 127.0.0.2", () => {
        expect(isSafeExternalUrl("http://127.0.0.2")).toBe(false);
    });

    it("blocks 127.1.2.3", () => {
        expect(isSafeExternalUrl("http://127.1.2.3")).toBe(false);
    });

    it("blocks 127.255.255.255", () => {
        expect(isSafeExternalUrl("http://127.255.255.255")).toBe(false);
    });

    it("blocks IPv4 shorthand for 127.0.0.1 (2130706433)", () => {
        expect(isSafeExternalUrl("http://2130706433")).toBe(false);
    });

    it("blocks IPv4 shorthand 127.1", () => {
        expect(isSafeExternalUrl("http://127.1")).toBe(false);
    });

    // 0.0.0.0/8
    it("blocks 0.0.0.0", () => {
        expect(isSafeExternalUrl("http://0.0.0.0")).toBe(false);
    });

    it("blocks 0.1.2.3", () => {
        expect(isSafeExternalUrl("http://0.1.2.3")).toBe(false);
    });

    // 10.0.0.0/8 (private)
    it("blocks 10.0.0.1", () => {
        expect(isSafeExternalUrl("http://10.0.0.1")).toBe(false);
    });

    it("blocks 10.255.255.255", () => {
        expect(isSafeExternalUrl("http://10.255.255.255")).toBe(false);
    });

    // 172.16.0.0/12 (private)
    it("blocks 172.16.0.1", () => {
        expect(isSafeExternalUrl("http://172.16.0.1")).toBe(false);
    });

    it("blocks 172.31.255.255", () => {
        expect(isSafeExternalUrl("http://172.31.255.255")).toBe(false);
    });

    it("allows 172.15.0.1 (outside 172.16/12)", () => {
        expect(isSafeExternalUrl("http://172.15.0.1")).toBe(true);
    });

    it("allows 172.32.0.1 (outside 172.16/12)", () => {
        expect(isSafeExternalUrl("http://172.32.0.1")).toBe(true);
    });

    // 192.168.0.0/16 (private)
    it("blocks 192.168.0.1", () => {
        expect(isSafeExternalUrl("http://192.168.0.1")).toBe(false);
    });

    it("blocks 192.168.255.255", () => {
        expect(isSafeExternalUrl("http://192.168.255.255")).toBe(false);
    });

    // 169.254.0.0/16 (link-local)
    it("blocks 169.254.0.1", () => {
        expect(isSafeExternalUrl("http://169.254.0.1")).toBe(false);
    });

    it("blocks 169.254.255.255", () => {
        expect(isSafeExternalUrl("http://169.254.255.255")).toBe(false);
    });

    // 100.64.0.0/10 (CGNAT)
    it("blocks 100.64.0.1", () => {
        expect(isSafeExternalUrl("http://100.64.0.1")).toBe(false);
    });

    it("blocks 100.127.255.255", () => {
        expect(isSafeExternalUrl("http://100.127.255.255")).toBe(false);
    });

    it("allows 100.63.255.255 (outside 100.64/10)", () => {
        expect(isSafeExternalUrl("http://100.63.255.255")).toBe(true);
    });

    it("allows 100.128.0.1 (outside 100.64/10)", () => {
        expect(isSafeExternalUrl("http://100.128.0.1")).toBe(true);
    });

    // IPv6 loopback
    it("blocks ::1", () => {
        expect(isSafeExternalUrl("http://[::1]")).toBe(false);
    });

    it("blocks unbracketed ::1", () => {
        expect(isSafeExternalUrl("http://::1")).toBe(false);
    });

    // IPv6 unspecified
    it("blocks ::", () => {
        expect(isSafeExternalUrl("http://[::]")).toBe(false);
    });

    // IPv6 link-local fe80::/10
    it("blocks fe80::1", () => {
        expect(isSafeExternalUrl("http://[fe80::1]")).toBe(false);
    });

    it("blocks fe80:abcd::1", () => {
        expect(isSafeExternalUrl("http://[fe80:abcd::1]")).toBe(false);
    });

    // IPv6 ULA fc00::/7
    it("blocks fc00::1", () => {
        expect(isSafeExternalUrl("http://[fc00::1]")).toBe(false);
    });

    it("blocks fd00::1", () => {
        expect(isSafeExternalUrl("http://[fd00::1]")).toBe(false);
    });

    it("blocks fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff", () => {
        expect(
            isSafeExternalUrl(
                "http://[fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff]",
            ),
        ).toBe(false);
    });

    // IPv4-mapped IPv6 (::ffff:a.b.c.d)
    it("blocks ::ffff:127.0.0.1", () => {
        expect(isSafeExternalUrl("http://[::ffff:127.0.0.1]")).toBe(false);
    });

    it("blocks ::ffff:7f00:1 (hex form of 127.0.0.1)", () => {
        expect(isSafeExternalUrl("http://[::ffff:7f00:1]")).toBe(false);
    });

    it("blocks ::ffff:10.0.0.1", () => {
        expect(isSafeExternalUrl("http://[::ffff:10.0.0.1]")).toBe(false);
    });

    it("blocks ::ffff:192.168.1.1", () => {
        expect(isSafeExternalUrl("http://[::ffff:192.168.1.1]")).toBe(false);
    });

    it("blocks ::ffff:172.16.0.1", () => {
        expect(isSafeExternalUrl("http://[::ffff:172.16.0.1]")).toBe(false);
    });

    it("allows ::ffff:8.8.8.8 (public IPv4)", () => {
        expect(isSafeExternalUrl("http://[::ffff:8.8.8.8]")).toBe(true);
    });
});
