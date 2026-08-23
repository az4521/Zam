import { describe, it, expect } from "vitest";
import { safeAttachmentMimeType } from "./attachmentMime";

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
