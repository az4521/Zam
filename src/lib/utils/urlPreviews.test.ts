import { describe, expect, it } from "vitest";
import {
    previewableBodyUrls,
    urlsToPreview,
    withUrlPreviewHints,
} from "./urlPreviews";
import { parseMarkdown } from "./markdown";

const A = "https://a.example/page";
const B = "https://b.example/x?y=1";

describe("previewableBodyUrls", () => {
    it("finds bare URLs once each", () => {
        expect(previewableBodyUrls(`see ${A} and ${B} and ${A}`)).toEqual([
            A,
            B,
        ]);
    });

    it("skips <url> autolinks", () => {
        expect(previewableBodyUrls(`<${A}> and ${B}`)).toEqual([B]);
    });

    it("still previews a URL that is also written bare", () => {
        expect(previewableBodyUrls(`<${A}> then ${A}`)).toEqual([A]);
    });

    it("skips inline code and fenced blocks", () => {
        expect(previewableBodyUrls(`\`${A}\` ${B}`)).toEqual([B]);
        expect(previewableBodyUrls("``" + A + "``")).toEqual([]);
        expect(previewableBodyUrls("```\ncurl " + A + "\n```\n" + B)).toEqual([
            B,
        ]);
        expect(previewableBodyUrls("```sh\n" + A)).toEqual([]);
    });

    it("skips URLs inside <pre>/<code> in formatted_body", () => {
        const html = `<pre><code>curl ${A.replace("&", "&amp;")}</code></pre>`;
        expect(previewableBodyUrls(`curl ${A}`, html)).toEqual([]);
        expect(
            previewableBodyUrls(`${A} ${B}`, `<code>${A}</code> ${B}`),
        ).toEqual([B]);
    });
});

describe("urlsToPreview", () => {
    it("falls back to the body when no list is sent", () => {
        expect(urlsToPreview({ body: `${A}` }, A)).toEqual([A]);
    });

    it("an empty list means no previews", () => {
        expect(urlsToPreview({ "com.beeper.linkpreviews": [] }, A)).toEqual([]);
        expect(urlsToPreview({ "m.url_previews": [] }, A)).toEqual([]);
    });

    it("previews only listed URLs that appear in the body", () => {
        const body = `${A} ${B}`;
        expect(
            urlsToPreview(
                {
                    "com.beeper.linkpreviews": [
                        { matched_url: B, "og:title": "B" },
                        { matched_url: "https://not-in-body.example/" },
                        { "og:title": "no url" },
                        null,
                    ],
                },
                body,
            ),
        ).toEqual([B]);
        expect(
            urlsToPreview(
                { "m.url_previews": [{ "matrix:matched_url": A }] },
                body,
            ),
        ).toEqual([A]);
    });
});

describe("withUrlPreviewHints", () => {
    it("leaves messages without <url> unchanged", () => {
        const c = { msgtype: "m.text", body: `${A} \`<${B}>\`` };
        expect(withUrlPreviewHints(c)).toBe(c);
    });

    it("lists the URLs still to preview when one is suppressed", () => {
        const out = withUrlPreviewHints({
            msgtype: "m.text",
            body: `<${A}> ${B}`,
        });
        expect(out["com.beeper.linkpreviews"]).toEqual([{ matched_url: B }]);
    });

    it("sends an empty list when every URL is suppressed", () => {
        const out = withUrlPreviewHints({ msgtype: "m.emote", body: `<${A}>` });
        expect(out["com.beeper.linkpreviews"]).toEqual([]);
    });

    it("keeps a list the content already has", () => {
        const c = {
            msgtype: "m.text",
            body: `<${A}>`,
            "com.beeper.linkpreviews": [{ matched_url: A }],
        };
        expect(withUrlPreviewHints(c)).toBe(c);
    });

    it("hints a media caption but not a bare file name", () => {
        const caption = withUrlPreviewHints({
            msgtype: "m.image",
            filename: "cat.png",
            body: `<${A}>`,
        });
        expect(caption["com.beeper.linkpreviews"]).toEqual([]);
        const named = { msgtype: "m.file", body: `<${A}>` };
        expect(withUrlPreviewHints(named)).toBe(named);
    });

    it("hints an edit's m.new_content", () => {
        const out = withUrlPreviewHints({
            msgtype: "m.text",
            body: `* <${A}>`,
            "m.new_content": { msgtype: "m.text", body: `<${A}>` },
        });
        expect(
            (out["m.new_content"] as Record<string, unknown>)[
                "com.beeper.linkpreviews"
            ],
        ).toEqual([]);
    });

    it("round-trips: the receiver previews what the sender listed", () => {
        const body = `<${A}> ${B}`;
        const out = withUrlPreviewHints({ msgtype: "m.text", body });
        expect(urlsToPreview(out, body)).toEqual([B]);
    });
});

describe("markdown autolink", () => {
    it("renders <url> as a link without the brackets", () => {
        const { formattedBody, hasFormatting } = parseMarkdown(`see <${A}>`);
        expect(hasFormatting).toBe(true);
        expect(formattedBody).toBe(`see <a href="${A}">${A}</a>`);
    });

    it("escapes the href", () => {
        const { formattedBody } = parseMarkdown(`<${B}&z=2>`);
        expect(formattedBody).toBe(`<a href="${B}&amp;z=2">${B}&amp;z=2</a>`);
    });

    it("leaves <url> inside code alone", () => {
        expect(parseMarkdown(`\`<${A}>\``).formattedBody).toBe(
            `<code>&lt;${A}&gt;</code>`,
        );
    });
});
