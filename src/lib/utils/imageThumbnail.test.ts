import { describe, expect, it, vi } from "vitest";
import { fitThumbnail, THUMBNAIL_TARGET_BYTES } from "./imageThumbnail";

// Fake encoder: bytes scale with pixel count and quality.
const encoderFor = (bytesPerPixelAtFull: number) =>
    vi.fn(
        async (w: number, h: number, q: number) =>
            new Blob(
                [new Uint8Array(Math.round(w * h * q * bytesPerPixelAtFull))],
                {
                    type: "image/webp",
                },
            ),
    );

describe("fitThumbnail", () => {
    it("keeps the first encode that fits the budget", async () => {
        const encode = encoderFor(0.01);
        const fit = await fitThumbnail(4000, 3000, encode);
        expect(fit).toMatchObject({ thumbW: 640, thumbH: 480 });
        expect(encode).toHaveBeenCalledTimes(1);
    });

    it("steps quality, then size, down until it fits", async () => {
        const encode = encoderFor(0.1);
        const fit = await fitThumbnail(4000, 3000, encode);
        expect(fit!.blob.size).toBeLessThanOrEqual(THUMBNAIL_TARGET_BYTES);
        expect(fit!.thumbW).toBeLessThan(640);
    });

    it("falls back to the smallest encode when nothing fits", async () => {
        const encode = encoderFor(10);
        const fit = await fitThumbnail(4000, 3000, encode);
        expect(fit).toMatchObject({ thumbW: 256, thumbH: 192 });
    });

    it("never upscales a small image", async () => {
        const encode = encoderFor(10);
        await fitThumbnail(300, 100, encode);
        for (const [w] of encode.mock.calls) expect(w).toBeLessThanOrEqual(300);
    });

    it("keeps the aspect ratio for portrait images", async () => {
        const fit = await fitThumbnail(1000, 2000, encoderFor(0.01));
        expect(fit).toMatchObject({ thumbW: 320, thumbH: 640 });
    });

    it("returns null when the encoder never produces anything", async () => {
        expect(await fitThumbnail(800, 600, async () => null)).toBeNull();
    });
});
