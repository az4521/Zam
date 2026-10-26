import { describe, it, expect } from "vitest";
import {
    isSvgMimeType,
    safeAttachmentMimeType,
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
