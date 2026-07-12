import { describe, expect, it } from "vitest";
import { highlightCodeBlocks, mapOutsideCode } from "./codeHighlight";

describe("highlightCodeBlocks", () => {
    it("adds token markup to a declared language", () => {
        const out = highlightCodeBlocks(
            '<pre><code class="language-js">const answer = 42;</code></pre>',
        );
        expect(out).toContain("hljs-keyword");
        expect(out).toContain("hljs-number");
        expect(out).toContain("const");
    });

    it("keeps source HTML escaped", () => {
        const out = highlightCodeBlocks(
            "<pre><code>&lt;script&gt;alert(1)&lt;/script&gt;</code></pre>",
        );
        expect(out).not.toContain("<script>");
        expect(out).toContain("&lt;");
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
