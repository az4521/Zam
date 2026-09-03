// src/lib/utils/shareFileRows.test.ts
import { describe, it, expect } from "vitest";
import { shareFileRows } from "./shareFileRows";

describe("shareFileRows", () => {
    it("maps name, human size label, and image flag", () => {
        const rows = shareFileRows([
            { name: "cat.png", size: 2048, type: "image/png" },
            { name: "notes.pdf", size: 1_500_000, type: "application/pdf" },
        ]);
        expect(rows).toEqual([
            { name: "cat.png", sizeLabel: "2.0 KB", isImage: true },
            { name: "notes.pdf", sizeLabel: "1.4 MB", isImage: false },
        ]);
    });

    it("falls back to 'file' for a missing/blank name", () => {
        expect(shareFileRows([{ size: 10, type: "text/plain" }])[0].name).toBe(
            "file",
        );
        expect(shareFileRows([{ name: "   ", size: 10 }])[0].name).toBe("file");
    });

    it("emits an empty size label when size is unknown or zero", () => {
        expect(shareFileRows([{ name: "a", size: 0 }])[0].sizeLabel).toBe("");
        expect(shareFileRows([{ name: "a" }])[0].sizeLabel).toBe("");
    });

    it("treats a missing or non-image type as not an image", () => {
        expect(shareFileRows([{ name: "a" }])[0].isImage).toBe(false);
        expect(
            shareFileRows([{ name: "a", type: "video/mp4" }])[0].isImage,
        ).toBe(false);
    });
});
