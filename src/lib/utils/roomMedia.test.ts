import { describe, it, expect } from "vitest";
import {
    mediaItemFromEvent,
    mediaFilterDefinition,
    mergeMediaPages,
    splitMediaItems,
    formatMediaSize,
    formatMediaDuration,
    mediaThumbnailMxc,
    mediaViewerKind,
    mediaViewerItem,
    type MediaSourceEvent,
    type RoomMediaItem,
} from "./roomMedia";

const ev = (
    over: Partial<MediaSourceEvent> & {
        content?: Record<string, unknown>;
    } = {},
): MediaSourceEvent => ({
    eventId: "$1",
    sender: "@alice:example.org",
    ts: 1000,
    type: "m.room.message",
    content: {
        msgtype: "m.image",
        body: "cat.png",
        url: "mxc://example.org/abc",
    },
    ...over,
});

const item = (
    over: Partial<RoomMediaItem> & { eventId: string },
): RoomMediaItem => ({
    sender: "@alice:example.org",
    ts: 1000,
    kind: "image",
    name: "cat.png",
    url: "mxc://example.org/abc",
    thumbnailUrl: null,
    mimetype: null,
    size: null,
    durationMs: null,
    ...over,
});

describe("mediaItemFromEvent", () => {
    it("maps an m.image message to an image item", () => {
        const result = mediaItemFromEvent(
            ev({
                content: {
                    msgtype: "m.image",
                    body: "cat.png",
                    url: "mxc://example.org/abc",
                    info: { mimetype: "image/png", size: 2048 },
                },
            }),
        );
        expect(result).toEqual({
            eventId: "$1",
            sender: "@alice:example.org",
            ts: 1000,
            kind: "image",
            name: "cat.png",
            url: "mxc://example.org/abc",
            thumbnailUrl: null,
            mimetype: "image/png",
            size: 2048,
            durationMs: null,
        });
    });

    it("prefers the MSC2530 filename over the body", () => {
        const result = mediaItemFromEvent(
            ev({
                content: {
                    msgtype: "m.file",
                    filename: "report.pdf",
                    body: "here is the report",
                    url: "mxc://example.org/f",
                },
            }),
        );
        expect(result?.name).toBe("report.pdf");
        expect(result?.kind).toBe("file");
    });

    it("carries a video's server thumbnail through", () => {
        const result = mediaItemFromEvent(
            ev({
                content: {
                    msgtype: "m.video",
                    body: "clip.mp4",
                    url: "mxc://example.org/v",
                    info: { thumbnail_url: "mxc://example.org/t" },
                },
            }),
        );
        expect(result?.kind).toBe("video");
        expect(result?.thumbnailUrl).toBe("mxc://example.org/t");
    });

    it("carries a video's duration through", () => {
        const result = mediaItemFromEvent(
            ev({
                content: {
                    msgtype: "m.video",
                    body: "clip.mp4",
                    url: "mxc://example.org/v",
                    info: { duration: 65000 },
                },
            }),
        );
        expect(result?.durationMs).toBe(65000);
    });

    it("nulls a duration the sender did not send as a number", () => {
        const result = mediaItemFromEvent(
            ev({
                content: {
                    msgtype: "m.video",
                    body: "clip.mp4",
                    url: "mxc://example.org/v",
                    info: { duration: "65000" },
                },
            }),
        );
        expect(result?.durationMs).toBeNull();
    });

    it("falls back to a kind label when there is no name at all", () => {
        const result = mediaItemFromEvent(
            ev({
                content: { msgtype: "m.audio", url: "mxc://example.org/a" },
            }),
        );
        expect(result?.name).toBe("Audio");
    });

    it("rejects a text message", () => {
        expect(
            mediaItemFromEvent(
                ev({ content: { msgtype: "m.text", body: "hello" } }),
            ),
        ).toBeNull();
    });

    it("rejects a non-message event type", () => {
        expect(mediaItemFromEvent(ev({ type: "m.room.member" }))).toBeNull();
    });

    it("rejects a redacted media event (empty content)", () => {
        expect(mediaItemFromEvent(ev({ content: {} }))).toBeNull();
    });

    it("rejects encrypted-attachment media that has no plain url", () => {
        expect(
            mediaItemFromEvent(
                ev({
                    content: {
                        msgtype: "m.image",
                        body: "secret.png",
                        file: { url: "mxc://example.org/e", key: {} },
                    },
                }),
            ),
        ).toBeNull();
    });

    it("rejects a non-mxc url", () => {
        expect(
            mediaItemFromEvent(
                ev({
                    content: {
                        msgtype: "m.image",
                        body: "x",
                        url: "https://evil.example/x.png",
                    },
                }),
            ),
        ).toBeNull();
    });

    it("rejects an event with no id", () => {
        expect(mediaItemFromEvent(ev({ eventId: null }))).toBeNull();
    });

    // A msgtype is remote-controlled: any room member can send one. Looking it
    // up on a plain object literal would resolve Object.prototype members and
    // hand back a truthy non-MediaKind.
    it.each(["toString", "constructor", "valueOf"])(
        "rejects the prototype-chain msgtype %s",
        (msgtype) => {
            expect(
                mediaItemFromEvent(
                    ev({
                        content: {
                            msgtype,
                            body: "evil",
                            url: "mxc://example.org/p",
                        },
                    }),
                ),
            ).toBeNull();
        },
    );

    it("defaults a missing sender and timestamp", () => {
        const result = mediaItemFromEvent(ev({ sender: null, ts: null }));
        expect(result?.sender).toBe("");
        expect(result?.ts).toBe(0);
    });

    it("keeps a zero size rather than nulling it", () => {
        const result = mediaItemFromEvent(
            ev({
                content: {
                    msgtype: "m.image",
                    body: "empty.png",
                    url: "mxc://example.org/z",
                    info: { size: 0 },
                },
            }),
        );
        expect(result?.size).toBe(0);
        expect(formatMediaSize(result?.size ?? null)).toBe("");
    });

    it("survives info that is not an object", () => {
        const result = mediaItemFromEvent(
            ev({
                content: {
                    msgtype: "m.image",
                    body: "odd.png",
                    url: "mxc://example.org/o",
                    info: "not an object",
                },
            }),
        );
        expect(result?.mimetype).toBeNull();
        expect(result?.thumbnailUrl).toBeNull();
        expect(result?.size).toBeNull();
    });
});

describe("mediaFilterDefinition", () => {
    it("asks the server for url-bearing messages in a clear room", () => {
        expect(mediaFilterDefinition(false, 40)).toEqual({
            room: {
                timeline: {
                    types: ["m.room.message"],
                    contains_url: true,
                    limit: 40,
                },
            },
        });
    });

    it("drops contains_url in an encrypted room, where bodies are opaque", () => {
        expect(mediaFilterDefinition(true, 40)).toEqual({
            room: {
                timeline: {
                    types: ["m.room.message", "m.room.encrypted"],
                    limit: 40,
                },
            },
        });
    });
});

describe("mergeMediaPages", () => {
    it("appends a later page after the earlier one", () => {
        const merged = mergeMediaPages(
            [item({ eventId: "$1" })],
            [item({ eventId: "$2" })],
        );
        expect(merged.map((i) => i.eventId)).toEqual(["$1", "$2"]);
    });

    it("drops an event id already present", () => {
        const merged = mergeMediaPages(
            [item({ eventId: "$1" })],
            [item({ eventId: "$1" }), item({ eventId: "$2" })],
        );
        expect(merged.map((i) => i.eventId)).toEqual(["$1", "$2"]);
    });

    it("de-duplicates within the incoming page too", () => {
        const merged = mergeMediaPages(
            [],
            [item({ eventId: "$1" }), item({ eventId: "$1" })],
        );
        expect(merged).toHaveLength(1);
    });

    it("returns the existing array's contents when nothing is new", () => {
        expect(mergeMediaPages([item({ eventId: "$1" })], [])).toEqual([
            item({ eventId: "$1" }),
        ]);
    });
});

describe("splitMediaItems", () => {
    it("puts images and videos in the visual tab", () => {
        const { visual, files } = splitMediaItems([
            item({ eventId: "$1", kind: "image" }),
            item({ eventId: "$2", kind: "video" }),
        ]);
        expect(visual.map((i) => i.eventId)).toEqual(["$1", "$2"]);
        expect(files).toHaveLength(0);
    });

    it("puts files and audio in the files tab", () => {
        const { visual, files } = splitMediaItems([
            item({ eventId: "$1", kind: "file" }),
            item({ eventId: "$2", kind: "audio" }),
        ]);
        expect(files.map((i) => i.eventId)).toEqual(["$1", "$2"]);
        expect(visual).toHaveLength(0);
    });

    it("preserves order within each tab", () => {
        const { visual, files } = splitMediaItems([
            item({ eventId: "$1", kind: "image" }),
            item({ eventId: "$2", kind: "file" }),
            item({ eventId: "$3", kind: "image" }),
        ]);
        expect(visual.map((i) => i.eventId)).toEqual(["$1", "$3"]);
        expect(files.map((i) => i.eventId)).toEqual(["$2"]);
    });
});

describe("formatMediaSize", () => {
    it("formats sub-megabyte sizes in KB, matching the message renderer", () => {
        expect(formatMediaSize(2048)).toBe("2.0 KB");
    });

    it("formats larger sizes in MB", () => {
        expect(formatMediaSize(5 * 1048576)).toBe("5.0 MB");
    });

    it("switches to MB exactly at one megabyte", () => {
        expect(formatMediaSize(1048575)).toBe("1024.0 KB");
        expect(formatMediaSize(1048576)).toBe("1.0 MB");
    });

    it("is empty for an unknown size", () => {
        expect(formatMediaSize(null)).toBe("");
        expect(formatMediaSize(undefined)).toBe("");
        expect(formatMediaSize(0)).toBe("");
    });
});

describe("formatMediaDuration", () => {
    it("formats milliseconds as mm:ss", () => {
        expect(formatMediaDuration(65000)).toBe("01:05");
    });

    it("rolls over to h:mm:ss past an hour", () => {
        expect(formatMediaDuration(3723000)).toBe("1:02:03");
    });

    it("is empty when the sender gave no duration", () => {
        expect(formatMediaDuration(null)).toBe("");
        expect(formatMediaDuration(undefined)).toBe("");
        expect(formatMediaDuration(0)).toBe("");
    });

    it("is empty for a nonsense duration rather than rendering NaN", () => {
        expect(formatMediaDuration(-5000)).toBe("");
        expect(formatMediaDuration(Number.NaN)).toBe("");
        expect(formatMediaDuration(Number.POSITIVE_INFINITY)).toBe("");
    });
});

describe("mediaThumbnailMxc", () => {
    it("thumbnails an image from its own url", () => {
        expect(mediaThumbnailMxc(item({ eventId: "$1", kind: "image" }))).toBe(
            "mxc://example.org/abc",
        );
    });

    it("prefers a video's uploaded thumbnail", () => {
        expect(
            mediaThumbnailMxc(
                item({
                    eventId: "$1",
                    kind: "video",
                    thumbnailUrl: "mxc://example.org/t",
                }),
            ),
        ).toBe("mxc://example.org/t");
    });

    // Never the video's own mxc: continuwuity answers /media/thumbnail for a
    // video with the original file, so an <img> pointed at it would download
    // the whole video only to fail decoding. No source means placeholder tile.
    it("has no thumbnail for a video the sender did not thumbnail", () => {
        expect(
            mediaThumbnailMxc(
                item({ eventId: "$1", kind: "video", thumbnailUrl: null }),
            ),
        ).toBeNull();
    });

    it("has nothing to show for a file or audio row", () => {
        expect(
            mediaThumbnailMxc(item({ eventId: "$1", kind: "file" })),
        ).toBeNull();
        expect(
            mediaThumbnailMxc(item({ eventId: "$2", kind: "audio" })),
        ).toBeNull();
    });
});

describe("mediaViewerKind", () => {
    it("views images and videos", () => {
        expect(mediaViewerKind(item({ eventId: "$1", kind: "image" }))).toBe(
            "image",
        );
        expect(mediaViewerKind(item({ eventId: "$2", kind: "video" }))).toBe(
            "video",
        );
    });

    it("does not view files or audio", () => {
        expect(
            mediaViewerKind(item({ eventId: "$1", kind: "file" })),
        ).toBeNull();
        expect(
            mediaViewerKind(item({ eventId: "$2", kind: "audio" })),
        ).toBeNull();
    });
});

describe("mediaViewerItem", () => {
    const resolve = {
        full: (mxc: string) => `https://hs/full/${mxc.slice("mxc://".length)}`,
        poster: (mxc: string) =>
            `https://hs/thumb/${mxc.slice("mxc://".length)}`,
    };

    it("maps an image to an image viewer item with no poster", () => {
        expect(
            mediaViewerItem(item({ eventId: "$1", kind: "image" }), resolve),
        ).toEqual({
            kind: "image",
            src: "https://hs/full/example.org/abc",
            poster: null,
            filename: "cat.png",
        });
    });

    it("maps a video to a video viewer item posted on its thumbnail", () => {
        expect(
            mediaViewerItem(
                item({
                    eventId: "$1",
                    kind: "video",
                    name: "clip.mp4",
                    url: "mxc://example.org/v",
                    thumbnailUrl: "mxc://example.org/t",
                }),
                resolve,
            ),
        ).toEqual({
            kind: "video",
            src: "https://hs/full/example.org/v",
            poster: "https://hs/thumb/example.org/t",
            filename: "clip.mp4",
        });
    });

    it("still maps a video whose poster cannot be resolved", () => {
        const result = mediaViewerItem(
            item({
                eventId: "$1",
                kind: "video",
                url: "mxc://example.org/v",
                thumbnailUrl: "mxc://example.org/t",
            }),
            { full: resolve.full, poster: () => null },
        );
        expect(result?.src).toBe("https://hs/full/example.org/v");
        expect(result?.poster).toBeNull();
    });

    // The common case: no uploaded thumbnail, so the player gets no poster
    // rather than a poster URL that would stream the whole video back.
    it("gives a thumbnail-less video no poster at all", () => {
        const result = mediaViewerItem(
            item({
                eventId: "$1",
                kind: "video",
                url: "mxc://example.org/v",
                thumbnailUrl: null,
            }),
            resolve,
        );
        expect(result?.kind).toBe("video");
        expect(result?.poster).toBeNull();
    });

    // mxcToHttp returns null before login and for a malformed mxc; there is
    // nothing to show, so the caller must not mount a viewer at all.
    it("is null when the full url cannot be resolved", () => {
        expect(
            mediaViewerItem(item({ eventId: "$1", kind: "image" }), {
                full: () => null,
                poster: resolve.poster,
            }),
        ).toBeNull();
    });

    it("is null for a file or audio item", () => {
        expect(
            mediaViewerItem(item({ eventId: "$1", kind: "file" }), resolve),
        ).toBeNull();
    });
});
