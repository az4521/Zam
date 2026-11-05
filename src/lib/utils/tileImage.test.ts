import { describe, expect, it } from "vitest";
import { animatedMime, isAnimatedImage, tileSize } from "./tileImage";

const bytes = (...parts: (string | number[])[]) =>
    new Uint8Array(
        parts.flatMap((p) =>
            typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p,
        ),
    );
const be32 = (n: number) => [
    n >>> 24,
    (n >> 16) & 255,
    (n >> 8) & 255,
    n & 255,
];
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const chunk = (type: string, len = 0) =>
    bytes(be32(len), type, new Array(len + 4).fill(0));

describe("tileSize", () => {
    it("leaves images that fit alone", () => {
        expect(tileSize(1024, 768)).toBeNull();
        expect(tileSize(300, 200)).toBeNull();
    });
    it("bounds the constraining axis and keeps aspect", () => {
        expect(tileSize(4000, 3000)).toEqual({ w: 1024, h: 768 });
        expect(tileSize(1080, 20000)).toEqual({ w: 41, h: 768 });
        expect(tileSize(8000, 100)).toEqual({ w: 1024, h: 13 });
    });
});

describe("isAnimatedImage", () => {
    const cat = (...a: Uint8Array[]) =>
        new Uint8Array(a.flatMap((x) => [...x]));
    it("treats GIF as animated, JPEG as not", () => {
        expect(isAnimatedImage(bytes("GIF89a"))).toBe(true);
        expect(isAnimatedImage(bytes([0xff, 0xd8, 0xff]))).toBe(false);
    });
    it("finds acTL before IDAT in APNG", () => {
        const png = cat(bytes(PNG_SIG), chunk("IHDR", 13), chunk("IDAT", 4));
        const apng = cat(
            bytes(PNG_SIG),
            chunk("IHDR", 13),
            chunk("acTL", 8),
            chunk("IDAT", 4),
        );
        expect(isAnimatedImage(png)).toBe(false);
        expect(isAnimatedImage(apng)).toBe(true);
        // Cut off before reaching IDAT: can't rule it out.
        expect(isAnimatedImage(cat(bytes(PNG_SIG), chunk("IHDR", 13)))).toBe(
            true,
        );
    });
    it("reads the WebP animation flag", () => {
        const head = (flags: number) =>
            bytes("RIFF", [0, 0, 0, 0], "WEBPVP8X", [10, 0, 0, 0, flags]);
        expect(isAnimatedImage(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "))).toBe(
            false,
        );
        expect(isAnimatedImage(head(0x00))).toBe(false);
        expect(isAnimatedImage(head(0x02))).toBe(true);
    });
    it("spots animated AVIF by brand", () => {
        expect(
            isAnimatedImage(bytes(be32(20), "ftypavif", be32(0), "mif1")),
        ).toBe(false);
        expect(
            isAnimatedImage(bytes(be32(20), "ftypavis", be32(0), "avif")),
        ).toBe(true);
    });
    it("errs towards animated for unknown formats", () => {
        expect(isAnimatedImage(bytes([0xff, 0x0a]))).toBe(true);
    });
});

describe("animatedMime", () => {
    it("names the formats an animation can come in", () => {
        expect(animatedMime(bytes("GIF89a"))).toBe("image/gif");
        expect(animatedMime(bytes(PNG_SIG))).toBe("image/png");
        expect(animatedMime(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8X"))).toBe(
            "image/webp",
        );
        expect(animatedMime(bytes(be32(20), "ftypavis"))).toBe("image/avif");
    });
    it("gives null for anything else", () => {
        expect(animatedMime(bytes([0xff, 0xd8, 0xff]))).toBeNull();
        expect(animatedMime(bytes([0xff, 0x0a]))).toBeNull();
    });
});
