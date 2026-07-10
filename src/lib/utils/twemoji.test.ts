import { describe, it, expect } from "vitest";
import { isEmojiOnly, renderEmoji, renderHtml } from "./twemoji";

describe("isEmojiOnly — reaction-key safety gate", () => {
    it("accepts a single emoji", () => {
        expect(isEmojiOnly("😀")).toBe(true);
    });

    it("accepts skin-tone and ZWJ sequences", () => {
        expect(isEmojiOnly("👍🏽")).toBe(true);
        expect(isEmojiOnly("👨‍👩‍👧")).toBe(true);
    });

    it("rejects an HTML attribute-breakout string", () => {
        expect(isEmojiOnly('"><img src=x onerror=alert(1)>')).toBe(false);
    });

    it("rejects plain text reactions", () => {
        expect(isEmojiOnly("lol")).toBe(false);
        expect(isEmojiOnly("")).toBe(false);
    });
});

describe("renderEmoji — fallback escapes its alt attribute", () => {
    it("never emits an unescaped double-quote in alt", () => {
        // A string that twemoji can't map should never break out of alt="".
        const out = renderEmoji('a"b', "cls");
        expect(out).not.toContain('alt="a"b"');
    });
});

describe("self-hosted assets — no CDN references", () => {
    it("renderEmoji points at the bundled /twemoji/ assets", () => {
        const out = renderEmoji("😀", "cls");
        expect(out).toContain('src="/twemoji/svg/1f600.svg"');
        expect(out).not.toMatch(/https?:\/\//);
    });

    it("renderHtml (including the fallback pass) stays local", () => {
        const out = renderHtml("<p>hi 😀</p>", "cls");
        expect(out).toContain('src="/twemoji/svg/1f600.svg"');
        expect(out).not.toMatch(/https?:\/\//);
    });
});
