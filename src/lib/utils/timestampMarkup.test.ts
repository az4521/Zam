import { describe, expect, it } from "vitest";
import {
    formatMessageTimestamp,
    renderMessageTimestamps,
} from "./timestampMarkup";

describe("renderMessageTimestamps", () => {
    it("renders an escaped <t:UNIX> as a <time> element", () => {
        const out = renderMessageTimestamps("at &lt;t:1700000000&gt; ok");
        expect(out).toContain('<time datetime="2023-11-14T22:13:20.000Z"');
        expect(out).not.toContain("&lt;t:");
    });

    it("honours the style suffix", () => {
        const t = renderMessageTimestamps("&lt;t:1700000000:t&gt;");
        const f = renderMessageTimestamps("&lt;t:1700000000:F&gt;");
        expect(t).not.toBe(f);
    });

    it("leaves links and code alone", () => {
        const html =
            '<a href="x">&lt;t:1700000000&gt;</a><code>&lt;t:1700000000&gt;</code>';
        expect(renderMessageTimestamps(html)).toBe(html);
    });

    it("ignores values that are not dates", () => {
        const html = "&lt;t:99999999999999&gt;";
        expect(renderMessageTimestamps(html)).toBe(html);
        expect(formatMessageTimestamp(1e13 * 1000)).toBeNull();
    });

    it("formats relative times against the supplied clock", () => {
        const out = formatMessageTimestamp(1000, "R", 1000 * 1000 + 3600_000);
        expect(out?.text).toMatch(/hour/);
    });
});
