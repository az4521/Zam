import { describe, it, expect } from "vitest";
import {
    applyFavouriteMediaRefresh,
    gifSiteRefresh,
    isGifSiteUrl,
    linkPreviewFavourite,
    needsGifSiteRefresh,
} from "./linkPreviewFavourite";
import type { FavouriteGif } from "$lib/matrix/client";

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

describe("GIF-site favourite refresh", () => {
    const TENOR =
        "https://tenor.com/view/larp-sorry-kid-gif-18202816756838931088";
    const THUMB =
        "https://hs.example/_matrix/media/v3/thumbnail/hs.example/still?width=800&height=600&method=scale";
    const old: FavouriteGif = { url: TENOR, previewUrl: THUMB, addedAt: 1 };

    it("matches GIF sites by registrable domain only", () => {
        expect(isGifSiteUrl(TENOR)).toBe(true);
        expect(isGifSiteUrl("https://media.tenor.com/a.gif")).toBe(true);
        expect(isGifSiteUrl("https://tenor.com.evil.example/x")).toBe(false);
        expect(isGifSiteUrl("not a url")).toBe(false);
    });

    it("picks GIF-site links that have no video tile", () => {
        expect(needsGifSiteRefresh(old)).toBe(true);
        expect(needsGifSiteRefresh({ ...old, previewVideoUrl: VIDEO })).toBe(
            false,
        );
        expect(needsGifSiteRefresh({ ...old, url: LINK })).toBe(false);
        expect(needsGifSiteRefresh({ ...old, video: true })).toBe(false);
        expect(
            needsGifSiteRefresh({
                ...old,
                source: { roomId: "!r:hs", eventId: "$e" },
            }),
        ).toBe(false);
    });

    it("takes the video from a fresh preview, or nothing without one", () => {
        expect(
            gifSiteRefresh(TENOR, {
                imageUrl: IMAGE,
                videoUrl: VIDEO,
                videoThumbnailUrl: IMAGE,
            }),
        ).toEqual({ previewUrl: IMAGE, previewVideoUrl: VIDEO });
        expect(gifSiteRefresh(TENOR, { imageUrl: IMAGE })).toBeNull();
        expect(gifSiteRefresh(TENOR, null)).toBeNull();
    });

    it("adds the video, keeps the small still as poster, touches nothing else", () => {
        const other: FavouriteGif = {
            url: LINK,
            previewUrl: IMAGE,
            addedAt: 2,
        };
        const gifs = [old, other];
        const out = applyFavouriteMediaRefresh(
            gifs,
            new Map([[TENOR, { previewUrl: IMAGE, previewVideoUrl: VIDEO }]]),
        );
        expect(out[0]).toEqual({ ...old, previewVideoUrl: VIDEO });
        expect(out[1]).toBe(other);
    });

    it("returns the same list when nothing needs it", () => {
        const done = [{ ...old, previewVideoUrl: VIDEO }];
        expect(
            applyFavouriteMediaRefresh(
                done,
                new Map([
                    [TENOR, { previewUrl: IMAGE, previewVideoUrl: VIDEO }],
                ]),
            ),
        ).toBe(done);
    });
});
