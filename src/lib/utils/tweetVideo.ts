// Which stream a tweet video plays. FxTwitter lists each video's encodings
// in `formats`, and the top-level `url` may be an mp4 or an HLS playlist
// (m3u8) for a video that was only transcoded to HLS.
//
// Policy: an mp4 always wins (the long-standing behaviour, and it plays in
// every engine with no extra code). HLS is used only when the video has no
// mp4 at all. We don't switch to HLS for a higher bitrate: FxTwitter gives
// bitrates for mp4s but often none for HLS, so the two can't be compared.

import type { TweetMedia } from "./tweetEmbed";

export type VideoSource =
    { kind: "mp4"; url: string } | { kind: "hls"; url: string };

/** True for an HLS playlist URL (the path ends in .m3u8, query ignored). */
export function isHlsUrl(url: string): boolean {
    try {
        return new URL(url).pathname.toLowerCase().endsWith(".m3u8");
    } catch {
        return false;
    }
}

/** The stream to play for a video media item. */
export function pickVideoSource(
    item: Pick<TweetMedia, "url" | "formats">,
): VideoSource {
    if (!isHlsUrl(item.url)) return { kind: "mp4", url: item.url };
    const mp4 = (item.formats ?? [])
        .filter((f) => f.container === "mp4")
        .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
    if (mp4) return { kind: "mp4", url: mp4.url };
    return { kind: "hls", url: item.url };
}
