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
        expect(out).toContain("hljs-number");
        expect(out).toContain("const");
    });

    it("keeps source HTML escaped", () => {
        const out = highlightCodeBlocks(
            "<pre><code>&lt;script&gt;alert(1)&lt;/script&gt;</code></pre>",
            hljs,
        );
        expect(out).not.toContain("<script>");
        expect(out).toContain("&lt;");
    });

    it("auto-detects when no language is declared", () => {
        const out = highlightCodeBlocks(
            "<pre><code>def f():\n    return 1</code></pre>",
            hljs,
        );
        expect(out).toContain("hljs");
        // The auto-derived class, not just `hljs` — `classList.add("hljs")`
        // runs for any non-null engine, so asserting it alone would pass
        // against a junk one. hljs reads this snippet as ruby, not python;
        // pinning the engine's real answer also kills the mutant that drops
        // the `result.language &&` guard (which would emit
        // `language-undefined` and satisfy a looser /language-\w+/ match).
        expect(out).toContain("language-ruby");
        expect(out).toContain("hljs-keyword");
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

    it("keeps the author's declared language even when detection disagrees", () => {
        // `getLanguage` says it does not know "nope", so we fall through to
        // highlightAuto — but the author still asked for a language, and
        // relabelling their block with the detector's guess would be a lie.
        // This is what pins the `&& !requested` clause.
        const fake: HighlightEngine = {
            getLanguage: () => null,
            highlight: () => ({ value: "UNUSED" }),
            highlightAuto: () => ({ value: "X", language: "fakelang" }),
        };
        const out = highlightCodeBlocks(
            '<pre><code class="language-nope">x</code></pre>',
            fake,
        );
        expect(out).toContain("language-nope");
        expect(out).not.toContain("language-fakelang");
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
