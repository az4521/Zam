import { describe, it, expect } from "vitest";
import { escapeHtml, parseMarkdown } from "./markdown";

describe("escapeHtml — XSS prevention", () => {
    it("escapes <, >, &, and double-quote", () => {
        expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
        expect(escapeHtml("a & b")).toBe("a &amp; b");
        expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
    });

    it("prevents <script> injection", () => {
        const malicious = '<script>alert("XSS")</script>';
        const escaped = escapeHtml(malicious);
        expect(escaped).not.toMatch(/<script/i);
        expect(escaped).toBe(
            "&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;",
        );
    });

    it("neutralizes event handlers", () => {
        const malicious = '<img src=x onerror="alert(1)">';
        const escaped = escapeHtml(malicious);
        // The dangerous part is the executable tag, not the word "onerror"
        expect(escaped).not.toMatch(/<img/);
        expect(escaped).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    });

    it("escapes javascript: URLs", () => {
        const malicious = '<a href="javascript:alert(1)">click</a>';
        const escaped = escapeHtml(malicious);
        // The dangerous part is the executable link tag, not the text "javascript:"
        expect(escaped).not.toMatch(/<a\s+href=/);
        expect(escaped).toContain("&lt;a href=");
    });

    it("is idempotent (double-escaping is safe)", () => {
        const once = escapeHtml("<b>");
        const twice = escapeHtml(once);
        expect(once).toBe("&lt;b&gt;");
        expect(twice).toBe("&amp;lt;b&amp;gt;");
    });
});

describe("parseMarkdown — inline formatting", () => {
    it("returns plain text unchanged when no formatting present", () => {
        const result = parseMarkdown("hello world");
        expect(result.formattedBody).toBe("hello world");
        expect(result.hasFormatting).toBe(false);
    });

    it("renders **bold**", () => {
        const result = parseMarkdown("This is **bold** text");
        expect(result.formattedBody).toBe("This is <strong>bold</strong> text");
        expect(result.hasFormatting).toBe(true);
    });

    it("renders *italic* and _italic_", () => {
        const r1 = parseMarkdown("This is *italic* text");
        expect(r1.formattedBody).toBe("This is <em>italic</em> text");

        const r2 = parseMarkdown("This is _also italic_ text");
        expect(r2.formattedBody).toBe("This is <em>also italic</em> text");
    });

    it("renders ***bold italic***", () => {
        const result = parseMarkdown("***bold italic***");
        expect(result.formattedBody).toBe(
            "<strong><em>bold italic</em></strong>",
        );
    });

    it("renders __underline__", () => {
        const result = parseMarkdown("This is __underlined__");
        expect(result.formattedBody).toBe("This is <u>underlined</u>");
    });

    it("renders ~~strikethrough~~", () => {
        const result = parseMarkdown("This is ~~deleted~~");
        expect(result.formattedBody).toBe("This is <del>deleted</del>");
    });

    it("renders ||spoiler||", () => {
        const result = parseMarkdown("This is a ||spoiler||");
        expect(result.formattedBody).toBe(
            'This is a <span data-mx-spoiler="">spoiler</span>',
        );
    });

    it("renders `inline code`", () => {
        const result = parseMarkdown("Use `git commit` to save");
        expect(result.formattedBody).toBe(
            "Use <code>git commit</code> to save",
        );
    });

    it("preserves formatting markers inside code spans", () => {
        const result = parseMarkdown("Code: `**not bold**`");
        expect(result.formattedBody).toContain("<code>**not bold**</code>");
        expect(result.formattedBody).not.toContain("<strong>");
    });

    it("auto-links http/https URLs", () => {
        const result = parseMarkdown("Visit https://matrix.org for info");
        expect(result.formattedBody).toContain(
            '<a href="https://matrix.org">https://matrix.org</a>',
        );
    });

    it("escapes HTML in auto-linked URLs", () => {
        const result = parseMarkdown("Visit https://example.com?q=<script>");
        expect(result.formattedBody).not.toMatch(/<script/);
        expect(result.formattedBody).toContain("&lt;script&gt;");
    });

    it("does not format inside URLs", () => {
        const result = parseMarkdown("https://example.com/**path**/file");
        expect(result.formattedBody).toContain(
            '<a href="https://example.com/**path**/file">',
        );
        // The link text should also preserve the asterisks
        expect(result.formattedBody).not.toContain("<strong>");
    });

    it("preserves emoji shortcodes without formatting their contents", () => {
        const result = parseMarkdown("I love :thumbs_up: and :star-struck:");
        expect(result.formattedBody).toBe(
            "I love :thumbs_up: and :star-struck:",
        );
        // The underscores in shortcodes shouldn't trigger italic
        expect(result.formattedBody).not.toContain("<em>");
    });

    it("escapes backslash-escaped formatting characters", () => {
        const result = parseMarkdown("Not \\*italic\\*");
        expect(result.formattedBody).toBe("Not *italic*");
        expect(result.formattedBody).not.toContain("<em>");

        // Code spans are extracted before backslash processing, so \` doesn't prevent code blocks
        // Test asterisk/underscore escaping which happens after code extraction
        const result2 = parseMarkdown("Not \\*\\*bold\\*\\*");
        expect(result2.formattedBody).toBe("Not **bold**");
        expect(result2.formattedBody).not.toContain("<strong>");
    });
});

describe("parseMarkdown — block formatting", () => {
    it("renders # heading", () => {
        const result = parseMarkdown("# Title");
        expect(result.formattedBody).toBe("<h1>Title</h1>");
    });

    it("renders ## and ### subheadings", () => {
        const r2 = parseMarkdown("## Section");
        expect(r2.formattedBody).toBe("<h2>Section</h2>");

        const r3 = parseMarkdown("### Subsection");
        expect(r3.formattedBody).toBe("<h3>Subsection</h3>");
    });

    it("renders > blockquotes", () => {
        const result = parseMarkdown("> quoted text");
        expect(result.formattedBody).toBe(
            "<blockquote>quoted text</blockquote>",
        );
    });

    it("handles empty blockquote '>'", () => {
        const result = parseMarkdown(">");
        expect(result.formattedBody).toBe("<blockquote></blockquote>");
    });

    it("renders unordered lists (- prefix)", () => {
        const result = parseMarkdown("- item one\n- item two\n- item three");
        expect(result.formattedBody).toBe(
            "<ul><li>item one</li><li>item two</li><li>item three</li></ul>",
        );
    });

    it("handles empty list item '-'", () => {
        const result = parseMarkdown("-");
        expect(result.formattedBody).toBe("<ul><li></li></ul>");
    });

    it("renders ordered lists (N. prefix)", () => {
        const result = parseMarkdown("1. first\n2. second\n3. third");
        expect(result.formattedBody).toBe(
            "<ol><li>first</li><li>second</li><li>third</li></ol>",
        );
    });

    it("renders -# subtext as <small>", () => {
        const result = parseMarkdown("-# muted helper text");
        expect(result.formattedBody).toBe("<small>muted helper text</small>");
    });

    it("renders fenced code blocks ```lang", () => {
        const result = parseMarkdown("```python\nprint('hello')\n```");
        expect(result.formattedBody).toContain(
            '<pre><code class="language-python">',
        );
        // Single quotes are not escaped by escapeHtml (only <, >, &, ")
        expect(result.formattedBody).toContain("print('hello')");
        expect(result.formattedBody).toContain("</code></pre>");
    });

    it("renders fenced code block without language", () => {
        const result = parseMarkdown("```\nplain code\n```");
        expect(result.formattedBody).toBe("<pre><code>plain code</code></pre>");
    });

    it("escapes HTML inside code blocks", () => {
        const result = parseMarkdown("```\n<script>alert(1)</script>\n```");
        expect(result.formattedBody).not.toMatch(/<script/);
        expect(result.formattedBody).toContain("&lt;script&gt;");
    });

    it("treats unclosed code fence as content if no closing fence", () => {
        const result = parseMarkdown("```python\ncode without closing fence");
        // Should consume all lines as code
        expect(result.formattedBody).toContain("<pre><code");
    });
});

describe("parseMarkdown — escape-first security invariant", () => {
    it("escapes HTML before applying formatting (prevents XSS)", () => {
        const malicious = "**<script>alert(1)</script>**";
        const result = parseMarkdown(malicious);

        // The script tag is escaped, then bold is applied
        expect(result.formattedBody).not.toMatch(/<script/i);
        expect(result.formattedBody).toContain("&lt;script&gt;");
        expect(result.formattedBody).toContain("<strong>");
    });

    it("neutralizes event handlers even when inside formatting", () => {
        const malicious = '*<img src=x onerror="alert(1)">*';
        const result = parseMarkdown(malicious);

        // The dangerous part is the executable tag, not the text "onerror"
        expect(result.formattedBody).not.toMatch(/<img/);
        expect(result.formattedBody).toContain("&lt;img");
    });

    it("escapes javascript: URLs before link processing", () => {
        // The markdown parser auto-links http/https URLs only
        // javascript: is not auto-linked, so it remains as safe text
        const malicious = "**See javascript:alert(1) for more**";
        const result = parseMarkdown(malicious);

        // Should not create an executable link (no <a href="javascript:...)
        expect(result.formattedBody).not.toMatch(/<a[^>]*href="javascript:/);
        // The text "javascript:" is harmless as plain text within formatting
        expect(result.formattedBody).toContain("<strong>");
    });

    it("prevents HTML injection in headings", () => {
        const malicious = "# <script>alert('XSS')</script>";
        const result = parseMarkdown(malicious);

        expect(result.formattedBody).not.toMatch(/<script/);
        // Single quotes are not escaped (only <, >, &, ")
        expect(result.formattedBody).toBe(
            "<h1>&lt;script&gt;alert('XSS')&lt;/script&gt;</h1>",
        );
    });

    it("prevents HTML injection in blockquotes", () => {
        const malicious = "> <b onload=alert(1)>text</b>";
        const result = parseMarkdown(malicious);

        // The dangerous part is the executable tag with handler, not the text "onload"
        expect(result.formattedBody).not.toMatch(/<b\s+onload/);
        expect(result.formattedBody).toContain("&lt;b onload");
    });

    it("prevents HTML injection in list items", () => {
        const malicious = "- <iframe src=evil></iframe>";
        const result = parseMarkdown(malicious);

        expect(result.formattedBody).not.toMatch(/<iframe/);
        expect(result.formattedBody).toContain("&lt;iframe");
    });
});

describe("parseMarkdown — edge cases and combinations", () => {
    it("separates lines with <br>", () => {
        const result = parseMarkdown("line one\nline two");
        expect(result.formattedBody).toBe("line one<br>\nline two");
    });

    it("combines inline formatting (bold + italic)", () => {
        const result = parseMarkdown("**bold _and italic_**");
        expect(result.formattedBody).toContain(
            "<strong>bold <em>and italic</em></strong>",
        );
    });

    it("escapes block-level markers with leading backslash", () => {
        const result = parseMarkdown(
            "\\> not a quote\n\\# not a heading\n\\- not a list",
        );
        expect(result.formattedBody).not.toContain("<blockquote>");
        expect(result.formattedBody).not.toContain("<h");
        expect(result.formattedBody).not.toContain("<ul>");
        // The markers are treated as text and escaped (> becomes &gt;)
        expect(result.formattedBody).toContain("&gt; not a quote");
        expect(result.formattedBody).toContain("# not a heading");
        expect(result.formattedBody).toContain("- not a list");
    });

    it("handles mixed content (paragraph, list, code)", () => {
        const input = "Intro text\n- list item\n```\ncode\n```\nMore text";
        const result = parseMarkdown(input);

        expect(result.formattedBody).toContain("Intro text<br>");
        expect(result.formattedBody).toContain("<ul><li>list item</li></ul>");
        expect(result.formattedBody).toContain("<pre><code>code</code></pre>");
        expect(result.formattedBody).toContain("More text");
    });

    it("returns hasFormatting=false for plain text", () => {
        const result = parseMarkdown("just plain text, no special chars");
        expect(result.hasFormatting).toBe(false);
    });

    it("returns hasFormatting=true when any formatting is present", () => {
        expect(parseMarkdown("**bold**").hasFormatting).toBe(true);
        expect(parseMarkdown("# heading").hasFormatting).toBe(true);
        expect(parseMarkdown("`code`").hasFormatting).toBe(true);
        expect(parseMarkdown("https://example.com").hasFormatting).toBe(true);
    });

    it("handles empty input", () => {
        const result = parseMarkdown("");
        expect(result.formattedBody).toBe("");
        expect(result.hasFormatting).toBe(false);
    });

    it("handles input with only whitespace", () => {
        const result = parseMarkdown("   \n\n   ");
        // Each whitespace line becomes a line in the output
        expect(result.formattedBody).toContain("<br>");
    });
});
