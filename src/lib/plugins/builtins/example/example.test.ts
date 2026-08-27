// src/lib/plugins/builtins/example/example.test.ts
import { describe, it, expect } from "vitest";
import {
    escapeHtml,
    formatExampleMessage,
    buildExampleEmbedHtml,
} from "./example";

describe("escapeHtml", () => {
    it("escapes the five HTML-significant characters", () => {
        expect(escapeHtml(`<b class="x">A&B'C</b>`)).toBe(
            "&lt;b class=&quot;x&quot;&gt;A&amp;B&#39;C&lt;/b&gt;",
        );
    });
    it("leaves plain text unchanged", () => {
        expect(escapeHtml("hello world")).toBe("hello world");
    });
});

describe("formatExampleMessage", () => {
    it("joins greeting and arg with a single space", () => {
        expect(formatExampleMessage("gg", "world")).toBe("gg world");
    });
    it("returns just the greeting when arg is empty or whitespace", () => {
        expect(formatExampleMessage("gg", "")).toBe("gg");
        expect(formatExampleMessage("gg", "   ")).toBe("gg");
    });
    it("trims surrounding whitespace from the arg", () => {
        expect(formatExampleMessage("gg", "  hi  ")).toBe("gg hi");
    });
});

describe("buildExampleEmbedHtml", () => {
    it("includes the title inside a strong tag, escaped", () => {
        const html = buildExampleEmbedHtml("https://example.dev/x", {
            title: "My <Card>",
            showHost: false,
        });
        expect(html).toContain("<strong>My &lt;Card&gt;</strong>");
        expect(html.startsWith("<blockquote>")).toBe(true);
    });
    it("includes the escaped hostname in a code tag when showHost is true", () => {
        const html = buildExampleEmbedHtml("https://example.dev/a?b=c", {
            title: "T",
            showHost: true,
        });
        expect(html).toContain("<code>example.dev</code>");
    });
    it("omits the host line when showHost is false", () => {
        const html = buildExampleEmbedHtml("https://example.dev/a", {
            title: "T",
            showHost: false,
        });
        expect(html).not.toContain("<code>");
    });
    it("does not throw and omits the host line for a malformed URL", () => {
        const html = buildExampleEmbedHtml("not a url", {
            title: "T",
            showHost: true,
        });
        expect(html).not.toContain("<code>");
        expect(html).toContain("<strong>T</strong>");
    });
    it("neutralizes hostile title/URL input (no live tags survive the builder)", () => {
        const html = buildExampleEmbedHtml(
            'https://example.dev/"><img src=x onerror=alert(1)>',
            { title: `<script>alert(1)</script>`, showHost: true },
        );
        expect(html).not.toContain("<script>");
        expect(html).not.toContain("<img");
        expect(html).not.toContain("onerror");
    });
    it("emits no class or style attributes", () => {
        const html = buildExampleEmbedHtml("https://example.dev/", {
            title: "T",
            showHost: true,
        });
        expect(html).not.toMatch(/class=/);
        expect(html).not.toMatch(/style=/);
    });
});
