import { describe, expect, it } from "vitest";
import { isHlsUrl, pickVideoSource } from "./tweetVideo";

const mp4 = "https://video.twimg.com/tweet_video/b.mp4";
const m3u8 = "https://video.twimg.com/amplify_video/1/pl/playlist.m3u8?tag=16";

describe("isHlsUrl", () => {
    it("recognises playlist URLs regardless of query or case", () => {
        expect(isHlsUrl(m3u8)).toBe(true);
        expect(isHlsUrl("https://video.twimg.com/a/PL.M3U8")).toBe(true);
    });

    it("does not match mp4s or unparseable input", () => {
        expect(isHlsUrl(mp4)).toBe(false);
        expect(isHlsUrl("https://example.com/m3u8/clip.mp4")).toBe(false);
        expect(isHlsUrl("not a url")).toBe(false);
    });
});

describe("pickVideoSource", () => {
    it("keeps a plain mp4 as it is", () => {
        expect(pickVideoSource({ url: mp4 })).toEqual({
            kind: "mp4",
            url: mp4,
        });
    });

    it("prefers the highest-bitrate mp4 over an HLS top-level url", () => {
        expect(
            pickVideoSource({
                url: m3u8,
                formats: [
                    { container: "m3u8", url: m3u8 },
                    {
                        container: "mp4",
                        url: "https://video.twimg.com/low.mp4",
                        bitrate: 320000,
                    },
                    {
                        container: "mp4",
                        url: "https://video.twimg.com/high.mp4",
                        bitrate: 2176000,
                    },
                ],
            }),
        ).toEqual({ kind: "mp4", url: "https://video.twimg.com/high.mp4" });
    });

    it("falls back to HLS when no mp4 is listed", () => {
        expect(
            pickVideoSource({
                url: m3u8,
                formats: [
                    {
                        container: "webm",
                        url: "https://video.twimg.com/a.webm",
                    },
                    { container: "m3u8", url: m3u8 },
                ],
            }),
        ).toEqual({ kind: "hls", url: m3u8 });
    });

    it("plays an HLS top-level url when there are no formats", () => {
        expect(pickVideoSource({ url: m3u8 })).toEqual({
            kind: "hls",
            url: m3u8,
        });
    });

    it("keeps the top-level mp4 even when formats list other mp4s", () => {
        expect(
            pickVideoSource({
                url: mp4,
                formats: [
                    {
                        container: "mp4",
                        url: "https://video.twimg.com/x.mp4",
                        bitrate: 9e6,
                    },
                ],
            }),
        ).toEqual({ kind: "mp4", url: mp4 });
    });
});
