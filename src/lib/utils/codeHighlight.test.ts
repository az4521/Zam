import { describe, it, expect, beforeAll } from "vitest";
import {
    highlightCodeBlocks,
    containsCodeBlock,
    mapOutsideCode,
    type HighlightEngine,
} from "./codeHighlight";

describe("highlightCodeBlocks", () => {
    let hljs: HighlightEngine;
    beforeAll(async () => {
        hljs = (await import("highlight.js/lib/common")).default;
    });

    it("returns the html untouched when no engine is loaded yet", () => {
        const html = '<pre><code class="language-js">const a = 1;</code></pre>';
        expect(highlightCodeBlocks(html, null)).toBe(html);
    });

    it("does not add the hljs class when no engine is loaded yet", () => {
        expect(
            highlightCodeBlocks("<pre><code>x</code></pre>", null),
        ).not.toContain("hljs");
    });

    it("highlights a declared language with the real engine", () => {
        const out = highlightCodeBlocks(
            '<pre><code class="language-js">const a = 1;</code></pre>',
            hljs,
        );
        expect(out).toContain("hljs");
        expect(out).toContain("hljs-keyword");
    });

    it("auto-detects when no language is declared", () => {
        const out = highlightCodeBlocks(
            "<pre><code>def f():\n    return 1</code></pre>",
            hljs,
        );
        expect(out).toContain("hljs");
    });

    it("uses the injected engine rather than a hard-wired one", () => {
        const fake: HighlightEngine = {
            getLanguage: () => null,
            highlight: () => ({ value: "UNUSED" }),
            highlightAuto: () => ({ value: "FAKE", language: "fakelang" }),
        };
        const out = highlightCodeBlocks(
            "<pre><code>whatever</code></pre>",
            fake,
        );
        expect(out).toContain("FAKE");
        expect(out).toContain("language-fakelang");
    });
});

describe("containsCodeBlock", () => {
    it("is true for a fenced code block", () => {
        expect(containsCodeBlock("<pre><code>x</code></pre>")).toBe(true);
    });
    it("is true with attributes and odd case", () => {
        expect(
            containsCodeBlock(
                '<PRE class="x"><CODE class="language-js">x</CODE></PRE>',
            ),
        ).toBe(true);
    });
    it("is false for a bare pre with no code", () => {
        expect(containsCodeBlock("<pre>plain</pre>")).toBe(false);
    });
    it("is false for inline code with no pre", () => {
        expect(containsCodeBlock("say <code>x</code> here")).toBe(false);
    });
    it("is false for escaped markup that only looks like a code block", () => {
        expect(containsCodeBlock("&lt;pre&gt;&lt;code&gt;x&lt;/code&gt;")).toBe(
            false,
        );
    });
    it("is false for plain text and for empty input", () => {
        expect(containsCodeBlock("hello")).toBe(false);
        expect(containsCodeBlock("")).toBe(false);
    });
    it("does not match a tag that merely starts with the same letters", () => {
        expect(containsCodeBlock("<preface><codex>x</codex></preface>")).toBe(
            false,
        );
    });
});

describe("mapOutsideCode", () => {
    it("does not transform fenced or inline code", () => {
        const html =
            "hello :) <code>code :)</code><pre><code>block :)</code></pre>";
        expect(mapOutsideCode(html, (part) => part.replaceAll(":)", "X"))).toBe(
            "hello X <code>code :)</code><pre><code>block :)</code></pre>",
        );
    });
});
