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
        // Escaping neutralises markup, it does not delete words: the literal
        // text "onerror" survives (a room may legitimately be named that), but
        // never as a live attribute, and no live tag is emitted at all.
        expect(out).not.toContain("<img src=x");
        expect(out).not.toContain("<img");
        expect(out).not.toContain('onerror="');
        expect(out).toContain("&lt;img");
    });

    it("escapes ampersands, quotes and angle brackets", () => {
        expect(renderPlainTextWithTwemoji(`a & b < c > d "e"`)).toBe(
            "a &amp; b &lt; c &gt; d &quot;e&quot;",
        );
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
        expect(out).toContain("&lt;b&gt;");
        expect(out).not.toContain("<b>");
        expect(out).toContain("<img");
    });

    it("handles an empty string", () => {
        expect(renderPlainTextWithTwemoji("")).toBe("");
    });
});
