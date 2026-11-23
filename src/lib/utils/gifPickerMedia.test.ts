import { describe, expect, it } from "vitest";
import {
    directTile,
    normalizeGifPickerMedia,
    wantsDirectTile,
} from "$lib/utils/gifPickerMedia";

const HS = "https://hs.example/_matrix/client/v1/media/download/hs.example/abc";
const TENOR = "https://tenor.com/view/cat-meme-gif-25804931";
const base = { url: TENOR, previewUrl: HS, addedAt: 1 };

describe("gifPickerMedia", () => {
    it("defaults to direct", () => {
        expect(normalizeGifPickerMedia(null)).toBe("direct");
        expect(normalizeGifPickerMedia("homeserver")).toBe("homeserver");
        expect(normalizeGifPickerMedia("junk")).toBe("direct");
    });

    it("wants a direct tile for a GIF-site link with homeserver media", () => {
        expect(wantsDirectTile(base)).toBe(true);
        expect(wantsDirectTile({ ...base, previewVideoUrl: `${HS}2` })).toBe(
            true,
        );
    });

    it("leaves site-hosted media, uploads, videos and other links alone", () => {
        expect(
            wantsDirectTile({
                ...base,
                previewUrl: "https://media.tenor.com/x/a.gif",
            }),
        ).toBe(false);
        expect(
            wantsDirectTile({
                ...base,
                source: { roomId: "!r", eventId: "$e" },
            }),
        ).toBe(false);
        expect(wantsDirectTile({ ...base, video: true })).toBe(false);
        expect(wantsDirectTile({ ...base, url: "https://example.com/x" })).toBe(
            false,
        );
    });

    it("swaps in the embed's media", () => {
        const withVideo = { ...base, previewVideoUrl: `${HS}2` };
        expect(
            directTile(withVideo, { imageUrl: `${TENOR}.gif` }),
        ).toMatchObject({ previewUrl: `${TENOR}.gif` });
        expect(
            directTile(withVideo, { imageUrl: `${TENOR}.gif` })
                ?.previewVideoUrl,
        ).toBeUndefined();
        expect(
            directTile(base, {
                videoUrl: "https://media.giphy.com/media/X/giphy.mp4",
                imageUrl: "https://media.giphy.com/media/X/giphy.webp",
            }),
        ).toMatchObject({
            previewUrl: "https://media.giphy.com/media/X/giphy.webp",
            previewVideoUrl: "https://media.giphy.com/media/X/giphy.mp4",
        });
        expect(directTile(base, null)).toBeNull();
        expect(directTile(base, {})).toBeNull();
    });
});
