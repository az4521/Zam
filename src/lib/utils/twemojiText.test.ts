import { describe, it, expect } from "vitest";
import { renderPlainTextWithTwemoji } from "./twemojiText";

describe("renderPlainTextWithTwemoji", () => {
    it("leaves plain text untouched", () => {
        expect(renderPlainTextWithTwemoji("general")).toBe("general");
    });

    it("escapes HTML so a hostile room name cannot inject markup", () => {
        const out = renderPlainTextWithTwemoji(
            '<img src=x onerror="alert(1)">',
        );
        // Escaping neutralises markup: no live img tag is emitted
        const template = document.createElement("template");
        template.innerHTML = out;
        expect(template.content.querySelector("img")).toBeNull();
        // The text content is escaped (< and > become entities)
        expect(out).toContain("&lt;");
        expect(out).toContain("&gt;");
    });

    it("escapes ampersands and angle brackets (quotes stay literal in text)", () => {
        // In text content (not attributes), only &, <, and > need escaping.
        // Quotes are only escaped in attribute values, so innerHTML keeps them literal.
        const out = renderPlainTextWithTwemoji(`a & b < c > d "e"`);
        expect(out).toContain("&amp;");
        expect(out).toContain("&lt;");
        expect(out).toContain("&gt;");
        // Verify no live tags
        const template = document.createElement("template");
        template.innerHTML = out;
        expect(template.content.textContent).toContain("a & b < c > d");
    });

    it("replaces an emoji with a twemoji img carrying the given class", () => {
        const out = renderPlainTextWithTwemoji("🎉 party", "name-twemoji");
        expect(out).toContain("<img");
        expect(out).toContain('class="name-twemoji"');
        expect(out).toContain("/twemoji/");
        expect(out).toContain("party");
    });

    it("defaults the class name to name-twemoji", () => {
        expect(renderPlainTextWithTwemoji("🎉")).toContain(
            'class="name-twemoji"',
        );
    });

    it("does not treat escaped angle brackets as tags to render into", () => {
        // "<b>🎉</b>" is text, not markup: the bold tags must stay escaped
        const out = renderPlainTextWithTwemoji("<b>🎉</b>");
        const template = document.createElement("template");
        template.innerHTML = out;
        // No live <b> element should exist
        expect(template.content.querySelector("b")).toBeNull();
        // But the emoji is still rendered as an img
        expect(template.content.querySelector("img")).not.toBeNull();
        // The output contains escaped brackets
        expect(out).toContain("&lt;");
        expect(out).toContain("&gt;");
    });

    it("handles an empty string", () => {
        expect(renderPlainTextWithTwemoji("")).toBe("");
    });

    it("does not treat escaped <b> as markup even when it contains emoji (SEC-S1)", () => {
        // The escaped `<b>😀</b>` arrives at renderHtml already escaped as
        // `&lt;b&gt;😀&lt;/b&gt;` — the DOM-based implementation must not
        // reinterpret those entity-encoded angle brackets as tags.
        const out = renderPlainTextWithTwemoji("<b>😀</b>");
        const template = document.createElement("template");
        template.innerHTML = out;
        // No live <b> element
        expect(template.content.querySelector("b")).toBeNull();
        // But the twemoji img is still rendered
        expect(
            template.content.querySelector("img.name-twemoji"),
        ).not.toBeNull();
    });
});
