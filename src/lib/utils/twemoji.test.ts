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

describe("renderHtml — SEC-S1: only touches text nodes, never attributes", () => {
    it("rejects the href attribute-breakout exploit", () => {
        // An emoji inside an attribute should stay in the attribute (as text or
        // a failed-to-render glyph) and never become live markup. The literal
        // `<` inside the quoted attribute is what older HTML parsers keep.
        const input =
            '<a href="https://a.b/😀<img src=x onerror=alert(1)>">x</a>';
        const out = renderHtml(input, "twemoji");
        const template = document.createElement("template");
        template.innerHTML = out;
        // No breakout img
        expect(template.content.querySelector('img[src="x"]')).toBeNull();
        // No onerror anywhere
        expect(template.content.querySelector("[onerror]")).toBeNull();
        // The link's href is still the original (emoji preserved or as text)
        const link = template.content.querySelector("a");
        expect(link?.getAttribute("href")).toMatch(/^https:\/\/a\.b\//);
    });

    it("never emits twemoji img inside code or pre elements", () => {
        const out = renderHtml("<code>hi 😀</code>", "twemoji");
        const template = document.createElement("template");
        template.innerHTML = out;
        expect(template.content.querySelector("code img")).toBeNull();

        const out2 = renderHtml("<pre><code>😀 test</code></pre>", "twemoji");
        const template2 = document.createElement("template");
        template2.innerHTML = out2;
        expect(template2.content.querySelector("pre img")).toBeNull();
        expect(template2.content.querySelector("code img")).toBeNull();
    });

    it("renders emoji as img.twemoji in regular text", () => {
        const out = renderHtml("<p>hi 😀</p>", "twemoji");
        const template = document.createElement("template");
        template.innerHTML = out;
        const img = template.content.querySelector("p img.twemoji");
        expect(img).not.toBeNull();
        expect(img?.getAttribute("src")).toContain("/twemoji/svg/");
    });

    it("renders emoji in link text (not the href attribute)", () => {
        const out = renderHtml('<a href="https://x">😀</a>', "twemoji");
        const template = document.createElement("template");
        template.innerHTML = out;
        const img = template.content.querySelector("a img.twemoji");
        expect(img).not.toBeNull();
        // href stayed as-is
        const link = template.content.querySelector("a");
        expect(link?.getAttribute("href")).toBe("https://x");
    });

    it("still catches newer emoji via the fallback path", () => {
        // A newer emoji that twemoji's package doesn't natively handle should
        // still get the fallback img. Use an emoji that the fallback regex
        // catches (Extended_Pictographic).
        const out = renderHtml("<p>🫠</p>", "twemoji");
        expect(out).toContain('class="twemoji"');
        expect(out).toContain("/twemoji/svg/");
    });

    it("runs the fallback on text before and after other emoji, not only between tags", () => {
        // Simulate emoji the package does not know: twemoji.parse returns its
        // input unchanged, so only the hand-rolled fallback can render them.
        const spy = vi
            .spyOn(twemoji, "parse")
            .mockImplementation((s: unknown) => s as string);
        try {
            const out = renderHtml("<p>hi 😀 there 🎉</p>", "fb-cls");
            const template = document.createElement("template");
            template.innerHTML = out;
            expect(
                template.content.querySelectorAll("img.fb-cls"),
            ).toHaveLength(2);
            expect(template.content.textContent).toContain("hi ");
            expect(template.content.textContent).toContain(" there ");
        } finally {
            spy.mockRestore();
        }
    });
});
