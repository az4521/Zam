import { describe, it, expect } from "vitest";
import { sanitizeMatrixHtml } from "./sanitizeHtml";

describe("sanitizeMatrixHtml — blocks XSS vectors", () => {
    it("strips onerror handlers from img", () => {
        const out = sanitizeMatrixHtml('<img src=x onerror="window.__xss=1">');
        expect(out).not.toMatch(/onerror/i);
    });

    it("strips single-quoted and unquoted event handlers", () => {
        const out = sanitizeMatrixHtml(
            "<img src=x onerror='alert(1)'><a onclick=alert(1)>x</a>",
        );
        expect(out).not.toMatch(/onerror/i);
        expect(out).not.toMatch(/onclick/i);
    });

    it("neutralizes javascript: hrefs", () => {
        const out = sanitizeMatrixHtml('<a href="javascript:alert(1)">x</a>');
        expect(out).not.toMatch(/javascript:/i);
    });

    it("drops data: and vbscript: URIs", () => {
        const out = sanitizeMatrixHtml(
            '<a href="data:text/html,<script>alert(1)</script>">x</a>' +
                '<a href="vbscript:msgbox">y</a>',
        );
        expect(out).not.toMatch(/data:text\/html/i);
        expect(out).not.toMatch(/vbscript:/i);
    });

    it("removes <script>, <iframe>, <svg>, <style>, <form>, <base>", () => {
        const out = sanitizeMatrixHtml(
            "<script>alert(1)</script>" +
                "<iframe src=x></iframe>" +
                "<svg onload=alert(1)></svg>" +
                "<style>body{background:url(x)}</style>" +
                "<form action=x><input></form>" +
                '<base href="http://evil/">',
        );
        expect(out).not.toMatch(/<script/i);
        expect(out).not.toMatch(/<iframe/i);
        expect(out).not.toMatch(/<svg/i);
        expect(out).not.toMatch(/<style/i);
        expect(out).not.toMatch(/<form/i);
        expect(out).not.toMatch(/<base/i);
        expect(out).not.toMatch(/onload/i);
    });

    it("strips inline style attributes", () => {
        const out = sanitizeMatrixHtml(
            '<span style="position:fixed;top:0">x</span>',
        );
        expect(out).not.toMatch(/style=/i);
    });

    it("renders a reaction-key attribute-breakout string inert", () => {
        const hostile = '"><img src=x onerror=alert(1)>';
        const out = sanitizeMatrixHtml(hostile);
        expect(out).not.toMatch(/onerror/i);
    });
});

describe("sanitizeMatrixHtml — preserves legitimate formatting", () => {
    it("keeps basic inline formatting", () => {
        const out = sanitizeMatrixHtml(
            "<strong>bold</strong> <em>italic</em> <code>x</code> <del>gone</del>",
        );
        expect(out).toContain("<strong>bold</strong>");
        expect(out).toContain("<em>italic</em>");
        expect(out).toContain("<code>x</code>");
        expect(out).toContain("<del>gone</del>");
    });

    it("keeps blockquotes, lists, and code blocks with language class", () => {
        const out = sanitizeMatrixHtml(
            "<blockquote>q</blockquote>" +
                "<ul><li>a</li></ul>" +
                '<pre><code class="language-js">1</code></pre>',
        );
        expect(out).toContain("<blockquote>q</blockquote>");
        expect(out).toContain("<li>a</li>");
        expect(out).toContain('class="language-js"');
    });

    it("keeps spoiler spans (data-mx-spoiler)", () => {
        const out = sanitizeMatrixHtml(
            '<span data-mx-spoiler="">secret</span>',
        );
        expect(out).toContain("data-mx-spoiler");
        expect(out).toContain("secret");
    });

    it("keeps https links and forces rel on target=_blank", () => {
        const out = sanitizeMatrixHtml(
            '<a href="https://example.com" target="_blank">x</a>',
        );
        expect(out).toContain('href="https://example.com"');
        expect(out).toMatch(/rel="noopener noreferrer"/);
    });

    it("rewrites mxc:// img src via the injected resolver", () => {
        const out = sanitizeMatrixHtml('<img src="mxc://hs/abc" alt="pic">', {
            resolveMxc: (mxc) =>
                mxc === "mxc://hs/abc" ? "https://hs/media/abc" : null,
        });
        expect(out).toContain('src="https://hs/media/abc"');
        expect(out).toContain('alt="pic"');
    });

    it("drops mxc:// src when the resolver returns null", () => {
        const out = sanitizeMatrixHtml('<img src="mxc://hs/abc">', {
            resolveMxc: () => null,
        });
        expect(out).not.toMatch(/mxc:\/\//);
        expect(out).not.toMatch(/src="mxc/);
    });
});
