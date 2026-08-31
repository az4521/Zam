import { describe, it, expect } from "vitest";
import { isInstagramUrl } from "./instagramUrl";

describe("isInstagramUrl", () => {
    it("matches www.instagram.com URLs", () => {
        expect(
            isInstagramUrl("https://www.instagram.com/reel/DcM2cSYtjvC/"),
        ).toBe(true);
    });

    it("matches bare instagram.com URLs", () => {
        expect(isInstagramUrl("https://instagram.com/p/ABC123/")).toBe(true);
    });

    it("matches instagram.com TV URLs", () => {
        expect(isInstagramUrl("https://instagram.com/tv/XYZ/")).toBe(true);
    });

    it("matches m.instagram.com URLs", () => {
        expect(isInstagramUrl("https://m.instagram.com/reel/x/")).toBe(true);
    });

    it("matches bare instagram.com host", () => {
        expect(isInstagramUrl("https://instagram.com/")).toBe(true);
    });

    it("matches uppercase URLs", () => {
        expect(isInstagramUrl("HTTPS://INSTAGRAM.COM/reel/x/")).toBe(true);
    });

    it("matches instagr.am short URLs", () => {
        expect(isInstagramUrl("https://instagr.am/p/x")).toBe(true);
    });

    it("rejects subdomain trick", () => {
        expect(
            isInstagramUrl("https://instagram.com.evil.example/reel/x"),
        ).toBe(false);
    });

    it("rejects notinstagram.com", () => {
        expect(isInstagramUrl("https://notinstagram.com/x")).toBe(false);
    });

    it("rejects xinstagram.com", () => {
        expect(isInstagramUrl("https://xinstagram.com/x")).toBe(false);
    });

    it("rejects myinstagram.io", () => {
        expect(isInstagramUrl("https://myinstagram.io/x")).toBe(false);
    });

    it("rejects look-alike Instagram TLDs (only .com is real)", () => {
        expect(isInstagramUrl("https://instagram.net/p/x")).toBe(false);
        expect(isInstagramUrl("https://instagram.co/p/x")).toBe(false);
        expect(isInstagramUrl("https://instagram.org/p/x")).toBe(false);
    });

    it("rejects twitter URL", () => {
        expect(isInstagramUrl("https://twitter.com/a/status/1")).toBe(false);
    });

    it("rejects empty string", () => {
        expect(isInstagramUrl("")).toBe(false);
    });

    it("rejects non-URL string", () => {
        expect(isInstagramUrl("not a url")).toBe(false);
    });

    it("rejects relative path", () => {
        expect(isInstagramUrl("/relative/path")).toBe(false);
    });

    it("rejects non-HTTP scheme", () => {
        expect(isInstagramUrl("ftp://instagram.com/x")).toBe(false);
    });
});
