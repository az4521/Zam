import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import DOMPurify from "dompurify";
import {
    isSvgMimeType,
    safeAttachmentMimeType,
    safeMediaBlob,
    sanitizedSvgBlob,
} from "./attachmentMime";

const FALLBACK = "application/octet-stream";

describe("safeAttachmentMimeType", () => {
    it("passes inert image/video/audio types through unchanged", () => {
        for (const mime of [
            "image/png",
            "image/jpeg",
            "image/gif",
            "image/webp",
            "video/mp4",
            "video/webm",
            "audio/mpeg",
            "audio/ogg",
        ])
            expect(safeAttachmentMimeType(mime)).toBe(mime);
    });

    it("keeps a codecs parameter on an allowed type verbatim", () => {
        expect(safeAttachmentMimeType('video/mp4; codecs="avc1.42E01E"')).toBe(
            'video/mp4; codecs="avc1.42E01E"',
        );
    });

    it("downgrades SVG (scriptable) to octet-stream", () => {
        expect(safeAttachmentMimeType("image/svg+xml")).toBe(FALLBACK);
        expect(safeAttachmentMimeType("IMAGE/SVG+XML")).toBe(FALLBACK);
        expect(safeAttachmentMimeType("image/svg+xml; charset=utf-8")).toBe(
            FALLBACK,
        );
    });

    it("downgrades scriptable / navigable document types to octet-stream", () => {
        for (const mime of [
            "text/html",
            "application/xhtml+xml",
            "application/pdf",
            "application/javascript",
            "text/xml",
        ])
            expect(safeAttachmentMimeType(mime)).toBe(FALLBACK);
    });

    it("falls back for a missing, empty, or non-media type", () => {
        expect(safeAttachmentMimeType(undefined)).toBe(FALLBACK);
        expect(safeAttachmentMimeType(null)).toBe(FALLBACK);
        expect(safeAttachmentMimeType("")).toBe(FALLBACK);
        expect(safeAttachmentMimeType("   ")).toBe(FALLBACK);
        expect(safeAttachmentMimeType("application/octet-stream")).toBe(
            FALLBACK,
        );
    });

    it("validates case-insensitively, preserves case, trims outer whitespace", () => {
        expect(safeAttachmentMimeType("  Image/PNG  ")).toBe("Image/PNG");
        expect(safeAttachmentMimeType("VIDEO/MP4")).toBe("VIDEO/MP4");
    });

    it("does not treat a lookalike prefix as media (imagex/evil)", () => {
        expect(safeAttachmentMimeType("imagex/evil")).toBe(FALLBACK);
        expect(safeAttachmentMimeType("notimage/png")).toBe(FALLBACK);
    });
});

describe("sanitizedSvgBlob", () => {
    const enc = (s: string) => new TextEncoder().encode(s);

    it("keeps an SVG's drawing and type", async () => {
        const blob = sanitizedSvgBlob(
            enc(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="red"/></svg>',
            ),
        );
        expect(blob?.type).toBe("image/svg+xml");
        const out = await blob!.text();
        expect(out).toContain("<circle");
        expect(out).toContain('fill="red"');
    });

    it("strips scripts, handlers, javascript: links and foreignObject", async () => {
        const blob = sanitizedSvgBlob(
            enc(
                '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" onload="alert(1)">' +
                    "<script>alert(2)</script>" +
                    '<a xlink:href="javascript:alert(3)"><rect width="1" height="1" onclick="alert(4)"/></a>' +
                    '<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>' +
                    "</svg>",
            ),
        );
        const out = (await blob!.text()).toLowerCase();
        expect(out).not.toContain("script");
        expect(out).not.toContain("alert");
        expect(out).not.toContain("foreignobject");
        expect(out).toContain("<rect");
    });

    it("returns null for bytes that aren't an SVG", () => {
        expect(
            sanitizedSvgBlob(enc("<html><body>hi</body></html>")),
        ).toBeNull();
        expect(sanitizedSvgBlob(enc("not xml at all <"))).toBeNull();
    });

    it("recognises the SVG type with case and parameters", () => {
        expect(isSvgMimeType("IMAGE/SVG+XML; charset=utf-8")).toBe(true);
        expect(isSvgMimeType("image/png")).toBe(false);
        expect(isSvgMimeType(undefined)).toBe(false);
    });
});

describe("safeMediaBlob", () => {
    const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><rect width="1" height="1"/></svg>';

    it("sanitizes an SVG typed by the blob itself", async () => {
        const out = await safeMediaBlob(
            new Blob([svg], { type: "image/svg+xml" }),
        );
        expect(out.type).toBe("image/svg+xml");
        const text = (await out.text()).toLowerCase();
        expect(text).not.toContain("alert");
        expect(text).toContain("<rect");
    });

    it("falls back to octet-stream for unparseable SVG and active types", async () => {
        const bad = await safeMediaBlob(new Blob(["<"]), "image/svg+xml");
        expect(bad.type).toBe(FALLBACK);
        const html = await safeMediaBlob(
            new Blob(["<script>alert(1)</script>"], { type: "text/html" }),
        );
        expect(html.type).toBe(FALLBACK);
    });

    it("passes inert media through untouched", async () => {
        const png = new Blob([new Uint8Array([1, 2, 3])], {
            type: "image/png",
        });
        expect(await safeMediaBlob(png)).toBe(png);
    });
});

describe("safeMediaBlob with hostile uploads in an image field", () => {
    const bytes = (s: string) => new TextEncoder().encode(s);

    it("never keeps an executable-looking or document type as a renderable type", async () => {
        for (const type of [
            "application/x-msdownload",
            "application/x-dosexec",
            "application/vnd.microsoft.portable-executable",
            "text/html",
            "application/xhtml+xml",
            "",
        ]) {
            const out = await safeMediaBlob(
                new Blob([bytes("MZ\x90\x00")], { type }),
            );
            expect(out.type).toBe(FALLBACK);
        }
    });

    it("leaves video and audio typed as such (an <img> just fails to decode them)", async () => {
        for (const type of ["video/mp4", "audio/mpeg"]) {
            const out = await safeMediaBlob(new Blob([bytes("x")], { type }));
            expect(out.type).toBe(type);
        }
    });

    it("does not rescue an SVG labelled as a raster type", async () => {
        const out = await safeMediaBlob(
            new Blob([bytes('<svg xmlns="http://www.w3.org/2000/svg"/>')], {
                type: "image/png",
            }),
        );
        expect(out.type).toBe("image/png");
    });

    it("drops script-bearing elements from an SVG served with an unrelated header", async () => {
        const out = await safeMediaBlob(
            new Blob([
                bytes(
                    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
                ),
            ]),
            "image/svg+xml; charset=utf-8",
        );
        expect((await out.text()).toLowerCase()).not.toContain("script");
    });

    it("strips external fetches from an SVG (tracking / IP leak when opened in a tab)", async () => {
        const out = await safeMediaBlob(
            new Blob([
                bytes(
                    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
                        '<image href="https://evil.example/t.png" width="1" height="1"/>' +
                        "<style>@import url(https://evil.example/x.css); rect{fill:url(https://evil.example/f)}</style>" +
                        '<use xlink:href="https://evil.example/s.svg#a"/>' +
                        '<rect width="1" height="1"/>' +
                        "</svg>",
                ),
            ]),
            "image/svg+xml",
        );
        const text = await out.text();
        expect(text).not.toContain("evil.example");
        expect(text).toContain("<rect");
    });
});

describe("sanitizedSvgBlob animation and shared hooks", () => {
    const enc = (s: string) => new TextEncoder().encode(s);

    it("keeps animation values unless the animation targets href", async () => {
        const blob = sanitizedSvgBlob(
            enc(
                '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
                    '<path d="M0 0h1"><animateTransform attributeName="transform" type="rotate" from="0 5 5" to="360 5 5" dur="5s"/></path>' +
                    '<a xlink:href="#x"><animate attributeName="xlink:href" to="javascript:alert(1)"/><text>x</text></a>' +
                    "</svg>",
            ),
        );
        const out = await blob!.text();
        expect(out).toContain('from="0 5 5"');
        expect(out).toContain('to="360 5 5"');
        expect(out).not.toContain("javascript");
    });

    it("ignores hooks other code put on the shared DOMPurify", async () => {
        DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
            data.keepAttr = false;
        });
        try {
            const blob = sanitizedSvgBlob(
                readFileSync("static/favicon_foreground.svg"),
            );
            const out = await blob!.text();
            expect(out).toMatch(/<path[^>]+d="/);
        } finally {
            DOMPurify.removeAllHooks();
        }
    });
});
