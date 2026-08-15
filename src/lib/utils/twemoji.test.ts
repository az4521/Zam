import { describe, it, expect, vi } from "vitest";
import twemoji from "@twemoji/api";
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

describe("renderEmoji — opt-in lazy loading for the picker grid", () => {
    it("adds loading=lazy and decoding=async when lazy is requested", () => {
        const out = renderEmoji("😀", "picker-twemoji", { lazy: true });
        expect(out).toContain('loading="lazy"');
        expect(out).toContain('decoding="async"');
        // still the same self-hosted asset, just deferred
        expect(out).toContain('src="/twemoji/svg/1f600.svg"');
    });

    it("stays eager by default — the message/reaction path is unchanged", () => {
        const out = renderEmoji("😀", "picker-twemoji");
        expect(out).not.toContain('loading="lazy"');
        expect(out).not.toContain("decoding=");
    });

    it("emits a single well-formed <img> (no duplicated tag) when lazy", () => {
        const out = renderEmoji("😀", "picker-twemoji", { lazy: true });
        expect((out.match(/<img/g) ?? []).length).toBe(1);
    });

    it("never breaks alt-escaping or duplicates the tag when lazy augments a fallback", () => {
        // The fallback path builds the <img> by hand; augmenting it must not
        // re-open the alt attribute or emit a second tag.
        const out = renderEmoji('a"b', "cls-lazy-fallback", { lazy: true });
        expect(out).not.toContain('alt="a"b"');
        expect((out.match(/<img/g) ?? []).length).toBeLessThanOrEqual(1);
    });
});

describe("renderEmoji — memoized so reopening the picker doesn't re-parse", () => {
    it("parses each (emoji, className, lazy) tuple at most once", () => {
        const spy = vi.spyOn(twemoji, "parse");
        const before = spy.mock.calls.length;
        renderEmoji("🎉", "memo-cls-a");
        renderEmoji("🎉", "memo-cls-a");
        renderEmoji("🎉", "memo-cls-a");
        expect(spy.mock.calls.length - before).toBe(1);
        spy.mockRestore();
    });

    it("caches the eager and lazy variants under distinct keys", () => {
        const spy = vi.spyOn(twemoji, "parse");
        const before = spy.mock.calls.length;
        renderEmoji("🥳", "memo-cls-b");
        renderEmoji("🥳", "memo-cls-b", { lazy: true });
        expect(spy.mock.calls.length - before).toBe(2);
        spy.mockRestore();
    });
});
