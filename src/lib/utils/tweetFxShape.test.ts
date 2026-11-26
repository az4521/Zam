import { describe, expect, it } from "vitest";
import { parseFxStatusResponse } from "./tweetEmbed";
import { pickVideoSource } from "./tweetVideo";
import { galleryNav } from "./mediaGallery";

// Shape of real FxTwitter v2 video media (captured 2026-11), trimmed.
const realVideo = (id: string, top: string, mp4s: [string, number][]) => ({
    type: "video",
    url: top,
    thumbnail_url: `https://pbs.twimg.com/ext_tw_video_thumb/${id}.jpg`,
    width: 1920,
    height: 1080,
    formats: [
        { url: `https://video.twimg.com/pl/${id}.m3u8`, container: "m3u8" },
        ...mp4s.map(([url, bitrate]) => ({
            url,
            bitrate,
            container: "mp4",
            codec: "h264",
        })),
    ],
});

const photo = (n: number) => ({
    type: "photo",
    url: `https://pbs.twimg.com/media/p${n}.jpg`,
    width: 800,
    height: 600,
});

function status(media: unknown[]) {
    return {
        status: {
            url: "https://x.com/a/status/1",
            text: "t",
            author: { screen_name: "a", name: "A" },
            media: { all: media },
        },
    };
}

describe("FxTwitter v2 video shape", () => {
    it("takes the top-level mp4 and lists the HLS playlist only in formats", () => {
        const top =
            "https://video.twimg.com/amplify_video/1/vid/avc1/1920x1080/a.mp4?tag=21";
        const tweet = parseFxStatusResponse(
            status([
                realVideo("1", top, [
                    [
                        "https://video.twimg.com/amplify_video/1/vid/avc1/480x270/b.mp4",
                        256000,
                    ],
                    [top, 10368000],
                ]),
            ]),
        );
        const item = tweet!.media[0];
        expect(item.kind).toBe("video");
        expect(item.formats?.map((f) => f.container)).toEqual([
            "m3u8",
            "mp4",
            "mp4",
        ]);
        // mp4 always wins, so HLS is never chosen for responses like this.
        expect(pickVideoSource(item)).toEqual({ kind: "mp4", url: top });
    });
});

describe("FxTwitter photo grids", () => {
    it("keeps all five photos in posted order and steps through them", () => {
        const tweet = parseFxStatusResponse(
            status([photo(1), photo(2), photo(3), photo(4), photo(5)]),
        );
        const photos = tweet!.media.filter((m) => m.kind === "photo");
        expect(photos.map((p) => p.url.slice(-6))).toEqual([
            "p1.jpg",
            "p2.jpg",
            "p3.jpg",
            "p4.jpg",
            "p5.jpg",
        ]);
        // The lightbox indexes photos (not the whole media list).
        expect(galleryNav(photos.length, photos.indexOf(photos[4]))).toEqual({
            prevIndex: 3,
            nextIndex: null,
        });
    });
});
