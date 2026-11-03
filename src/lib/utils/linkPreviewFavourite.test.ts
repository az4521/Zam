import { describe, it, expect } from "vitest";
import { linkPreviewFavourite } from "./linkPreviewFavourite";

const LINK = "https://www.kkinstagram.com/p/DZCcH--Ovpn/";
const VIDEO = "https://hs.example/_matrix/media/v3/download/hs.example/vid";
const IMAGE = "https://hs.example/_matrix/media/v3/download/hs.example/img";

describe("linkPreviewFavourite", () => {
    it("favourites a video embed that has no image, using the video as the tile", () => {
        // The kkinstagram case: the previewer got the raw mp4, so there is
        // og:video and nothing else.
        expect(
            linkPreviewFavourite(LINK, {
                videoUrl: VIDEO,
                videoWidth: 720,
                videoHeight: 1280,
            }),
        ).toEqual({
            url: LINK,
            previewUrl: VIDEO,
            previewVideoUrl: VIDEO,
            width: 720,
            height: 1280,
        });
    });

    it("uses the poster as a still tile for a video that has one", () => {
        expect(
            linkPreviewFavourite(LINK, {
                videoUrl: VIDEO,
                videoThumbnailUrl: IMAGE,
                imageUrl: IMAGE,
            }),
        ).toEqual({ url: LINK, previewUrl: IMAGE });
    });

    it("keeps the moving tile for a GIF-site video even with a poster", () => {
        expect(
            linkPreviewFavourite(
                LINK,
                { videoUrl: VIDEO, videoThumbnailUrl: IMAGE },
                { gifSite: true },
            ),
        ).toEqual({ url: LINK, previewUrl: IMAGE, previewVideoUrl: VIDEO });
    });

    it("favourites an image embed as before, with its dimensions", () => {
        expect(
            linkPreviewFavourite(LINK, {
                imageUrl: IMAGE,
                imageWidth: 400,
                imageHeight: 300,
            }),
        ).toEqual({ url: LINK, previewUrl: IMAGE, width: 400, height: 300 });
    });

    it("returns null when there is no media to show", () => {
        expect(linkPreviewFavourite(LINK, null)).toBeNull();
        expect(linkPreviewFavourite(LINK, {})).toBeNull();
    });
});
