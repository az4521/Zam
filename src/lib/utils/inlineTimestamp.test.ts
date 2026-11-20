import { describe, expect, it } from "vitest";
import {
    buildInlineTimestampToken,
    convertInlineTimestampsInBody,
    formatInlineTimestamp,
    inlineTimestampFallback,
    inlineTimestampHtml,
    inlineTimestampIso,
    localDateTimeToUnix,
    parseInlineTimestamp,
    relativeTimeParts,
    renderInlineTimestampsHtml,
    restoreInlineTimestampTokens,
    unixToLocalDateTimeValue,
} from "./inlineTimestamp";
import { parseMarkdown } from "./markdown";
import { sanitizeMatrixHtml } from "./sanitizeHtml";

// 2023-11-14T22:13:20Z
const T0 = 1700000000;
// 2023-11-15T12:00:00Z (same calendar day in every zone from UTC-11 to UTC+11)
const NOON = 1700049600;

describe("parseInlineTimestamp", () => {
    it("parses seconds with and without a style", () => {
        expect(parseInlineTimestamp(`<t:${T0}:F>`)).toEqual({
            seconds: T0,
            style: "F",
        });
        expect(parseInlineTimestamp(`<t:${T0}>`)).toEqual({
            seconds: T0,
            style: "f",
        });
    });

    it("rejects anything that is not exactly one token", () => {
        expect(parseInlineTimestamp(`x<t:${T0}>`)).toBeNull();
        expect(parseInlineTimestamp(`<t:${T0}:X>`)).toBeNull();
        expect(parseInlineTimestamp("<t:abc>")).toBeNull();
        expect(parseInlineTimestamp(`<t:${T0}> `)).toBeNull();
    });

    it("rejects values outside the four-digit year range", () => {
        expect(parseInlineTimestamp("<t:9999999999999>")).toBeNull();
        expect(parseInlineTimestamp("<t:-99999999999999>")).toBeNull();
    });

    it("accepts negative seconds before 1970", () => {
        expect(parseInlineTimestamp("<t:-86400>")?.seconds).toBe(-86400);
    });
});

describe("fallback text and sender HTML", () => {
    it("reads as UTC", () => {
        expect(inlineTimestampFallback(T0)).toBe("2023-11-14 22:13 UTC");
        expect(inlineTimestampIso(T0)).toBe("2023-11-14T22:13:20Z");
    });

    it("builds the <time> element with the style", () => {
        expect(inlineTimestampHtml(T0, "F")).toBe(
            '<time datetime="2023-11-14T22:13:20Z" data-zam-ts-style="F">2023-11-14 22:13 UTC</time>',
        );
    });

    it("falls back to the default style for an unknown one", () => {
        expect(inlineTimestampHtml(T0, "q")).toContain('data-zam-ts-style="f"');
    });

    it("builds the composer token", () => {
        expect(buildInlineTimestampToken(T0, "R")).toBe(`<t:${T0}:R>`);
    });
});

describe("convertInlineTimestampsInBody", () => {
    it("replaces each valid token with its UTC fallback", () => {
        expect(
            convertInlineTimestampsInBody(`at <t:${T0}:t> and <t:${T0}>`),
        ).toBe("at 2023-11-14 22:13 UTC and 2023-11-14 22:13 UTC");
    });

    it("leaves tokens in inline code and fenced blocks alone", () => {
        const code = `\`<t:${T0}>\``;
        expect(convertInlineTimestampsInBody(code)).toBe(code);
        const fenced = "```\n<t:" + T0 + ">\n```\n<t:" + T0 + ">";
        expect(convertInlineTimestampsInBody(fenced)).toBe(
            "```\n<t:" + T0 + ">\n```\n2023-11-14 22:13 UTC",
        );
    });

    it("leaves invalid tokens literal", () => {
        const bad = "<t:xyz> <t:1:Q>";
        expect(convertInlineTimestampsInBody(bad)).toBe(bad);
    });
});

describe("parseMarkdown with inline timestamps", () => {
    it("turns a token into a <time> element", () => {
        const { formattedBody, hasFormatting } = parseMarkdown(`<t:${T0}:F>`);
        expect(formattedBody).toBe(
            '<time datetime="2023-11-14T22:13:20Z" data-zam-ts-style="F">2023-11-14 22:13 UTC</time>',
        );
        expect(hasFormatting).toBe(true);
    });

    it("keeps surrounding markdown working", () => {
        const { formattedBody } = parseMarkdown(`**deadline** <t:${T0}:R>`);
        expect(formattedBody).toContain("<strong>deadline</strong>");
        expect(formattedBody).toContain('data-zam-ts-style="R"');
    });

    it("does not convert a token inside a code span", () => {
        const { formattedBody } = parseMarkdown(`\`<t:${T0}>\``);
        expect(formattedBody).toBe(`<code>&lt;t:${T0}&gt;</code>`);
    });

    it("stops a URL before a token that follows it", () => {
        const { formattedBody } = parseMarkdown(
            `https://example.org/a<t:${T0}>`,
        );
        expect(formattedBody).toContain('<a href="https://example.org/a">');
        expect(formattedBody).toContain('data-zam-ts-style="f"');
    });

    it("escapes an invalid token rather than rendering it", () => {
        const { formattedBody } = parseMarkdown("<t:nope>");
        expect(formattedBody).toBe("&lt;t:nope&gt;");
    });
});

describe("sanitizer allowlist for <time>", () => {
    it("keeps datetime and the Zam style, drops everything else", () => {
        const out = sanitizeMatrixHtml(
            '<time datetime="2023-11-14T22:13:20Z" data-zam-ts-style="F" onclick="x()" class="y">t</time>',
        );
        expect(out).toContain('datetime="2023-11-14T22:13:20Z"');
        expect(out).toContain('data-zam-ts-style="F"');
        expect(out).not.toContain("onclick");
        expect(out).not.toContain("class=");
    });

    it("drops datetime from tags other than time", () => {
        const out = sanitizeMatrixHtml('<span datetime="2023-11-14">x</span>');
        expect(out).not.toContain("datetime");
    });
});

describe("relativeTimeParts", () => {
    it("picks the largest whole unit", () => {
        expect(relativeTimeParts(40)).toEqual({ value: 40, unit: "second" });
        expect(relativeTimeParts(-120)).toEqual({
            value: -2,
            unit: "minute",
        });
        expect(relativeTimeParts(86400 * 3)).toEqual({
            value: 3,
            unit: "day",
        });
    });
});

describe("formatInlineTimestamp and rendering", () => {
    const now = T0 * 1000;

    it("formats relative times with Intl in the given locale", () => {
        expect(formatInlineTimestamp(T0 + 18000, "R", "en-US", now)?.text).toBe(
            "in 5 hours",
        );
    });

    it("formats absolute styles, with the long date as the title", () => {
        const out = formatInlineTimestamp(NOON, "D", "en-US", now);
        expect(out?.text).toBe("November 15, 2023");
        expect(out?.title).toContain("2023");
        expect(out?.iso).toBe("2023-11-15T12:00:00Z");
    });

    it("localizes a sanitized <time> element", () => {
        const html = `<p><time datetime="2023-11-15T12:00:00Z" data-zam-ts-style="D">2023-11-15 12:00 UTC</time></p>`;
        const out = renderInlineTimestampsHtml(html, "en-US", now);
        expect(out).toContain(">November 15, 2023</time>");
        expect(out).toContain('data-zam-ts-style="D"');
        expect(out).not.toContain("2023-11-15 12:00 UTC");
    });

    it("marks relative elements for the ticker", () => {
        const html = `<time datetime="2023-11-15T12:00:00Z" data-zam-ts-style="R">x</time>`;
        const out = renderInlineTimestampsHtml(html, "en-US", now);
        expect(out).toContain(`data-zam-ts-unix="${NOON}"`);
        expect(out).toContain("data-zam-ts-rel");
    });

    it("leaves a <time> with a non-date datetime unchanged", () => {
        const html = `<time datetime="not a date">x</time>`;
        expect(renderInlineTimestampsHtml(html, "en-US", now)).toBe(html);
    });
});

describe("composer date picker helpers", () => {
    it("reads a local date-time value as a real instant", () => {
        expect(localDateTimeToUnix("2023-11-15T12:00")).toBe(
            Math.floor(new Date(2023, 10, 15, 12, 0).getTime() / 1000),
        );
    });

    it("rejects impossible dates and malformed values", () => {
        expect(localDateTimeToUnix("2023-02-30T10:00")).toBeNull();
        expect(localDateTimeToUnix("2023-11-15 12:00")).toBeNull();
        expect(localDateTimeToUnix("")).toBeNull();
    });

    it("round-trips through the picker value", () => {
        const minute = Math.floor(T0 / 60) * 60;
        expect(localDateTimeToUnix(unixToLocalDateTimeValue(minute))).toBe(
            minute,
        );
    });
});

describe("edit read-back: restoreInlineTimestampTokens", () => {
    it("puts the token back where the UTC text was", () => {
        const plain = "meet 2023-11-14 22:13 UTC, bye";
        const html = `<p>meet <time datetime="2023-11-14T22:13:20Z" data-zam-ts-style="R">2023-11-14 22:13 UTC</time>, bye</p>`;
        expect(restoreInlineTimestampTokens(plain, html)).toBe(
            `meet <t:${T0}:R>, bye`,
        );
    });

    it("round-trips a composer text through send and edit", () => {
        const source = `at <t:${T0}:F> and <t:${NOON}>`;
        const body = convertInlineTimestampsInBody(source);
        const html = parseMarkdown(source).formattedBody;
        expect(restoreInlineTimestampTokens(body, html)).toBe(
            `at <t:${T0}:F> and <t:${NOON}:f>`,
        );
    });

    it("leaves elements without the Zam style or a valid date alone", () => {
        const plain = "2023-11-14 22:13 UTC";
        expect(
            restoreInlineTimestampTokens(
                plain,
                `<time datetime="2023-11-14T22:13:20Z">2023-11-14 22:13 UTC</time>`,
            ),
        ).toBe(plain);
        expect(
            restoreInlineTimestampTokens(
                plain,
                `<time datetime="garbage" data-zam-ts-style="F">2023-11-14 22:13 UTC</time>`,
            ),
        ).toBe(plain);
    });

    it("does nothing without formatted body time elements", () => {
        expect(restoreInlineTimestampTokens("plain", undefined)).toBe("plain");
        expect(restoreInlineTimestampTokens("plain", "<b>x</b>")).toBe("plain");
    });
});
