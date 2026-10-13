import { describe, it, expect, afterEach, vi } from "vitest";
import {
    canPreviewImage,
    PROGRESSIVE_IMAGE_MIN_BYTES,
} from "./progressiveImage";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("canPreviewImage", () => {
    it("is false where the browser has no ImageDecoder", async () => {
        vi.stubGlobal("ImageDecoder", undefined);
        expect(await canPreviewImage("image/jpeg")).toBe(false);
    });

    it("asks the decoder whether it handles the type", async () => {
        vi.stubGlobal("ImageDecoder", {
            isTypeSupported: async (t: string) => t === "image/jpeg",
        });
        expect(await canPreviewImage("image/jpeg")).toBe(true);
        expect(await canPreviewImage("image/jxl")).toBe(false);
    });

    it("is false for a missing MIME type", async () => {
        vi.stubGlobal("ImageDecoder", { isTypeSupported: async () => true });
        expect(await canPreviewImage(null)).toBe(false);
        expect(await canPreviewImage(undefined)).toBe(false);
        expect(await canPreviewImage("")).toBe(false);
    });

    it("treats a throwing decoder as unsupported", async () => {
        vi.stubGlobal("ImageDecoder", {
            isTypeSupported: async () => {
                throw new Error("nope");
            },
        });
        expect(await canPreviewImage("image/png")).toBe(false);
    });
});

describe("PROGRESSIVE_IMAGE_MIN_BYTES", () => {
    it("keeps small images on the verify-before-show path", () => {
        expect(PROGRESSIVE_IMAGE_MIN_BYTES).toBeGreaterThan(64 * 1024);
    });
});
