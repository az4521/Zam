import { describe, expect, it } from "vitest";
import {
    compactCount,
    fxStatusApiUrl,
    isQuoteTombstone,
    parseFxStatusResponse,
    tweetPhotoThumb,
    tweetSegments,
} from "./tweetEmbed";

const author = {
    screen_name: "someone",
    name: "Some One",
    url: "https://x.com/someone",
    avatar_url: "https://pbs.twimg.com/profile_images/1/a_200x200.jpg",
};

function status(extra: Record<string, unknown> = {}) {
    return {
        type: "status",
        url: "https://x.com/someone/status/123",
        id: "123",
        text: "hello",
        author,
        replies: 1,
        reposts: 2,
        likes: 3,
        created_timestamp: 1700000000,
        media: {},
        replying_to: null,
        community_note: null,
        ...extra,
    };
}

describe("fxStatusApiUrl", () => {
    it("maps status links on X and its mirrors", () => {
        for (const u of [
            "https://x.com/someone/status/123",
            "https://twitter.com/someone/status/123?s=20",
            "https://www.twitter.com/someone/status/123/photo/1",
            "https://mobile.twitter.com/someone/statuses/123",
            "https://fxtwitter.com/someone/status/123",
            "https://fixupx.com/i/status/123",
            "https://x.com/i/web/status/123",
        ]) {
            expect(fxStatusApiUrl(u)).toBe(
                "https://api.fxtwitter.com/2/status/123",
            );
        }
    });

    it("ignores other links", () => {
        expect(fxStatusApiUrl("https://x.com/someone")).toBeNull();
        expect(fxStatusApiUrl("https://x.com.evil.example/a/status/1")).toBe(
            null,
        );
        expect(fxStatusApiUrl("not a url")).toBeNull();
    });
});

describe("tweetSegments", () => {
    it("keeps newlines in plain text", () => {
        expect(tweetSegments("a\n\nb")).toEqual([
            { kind: "text", text: "a\n\nb" },
        ]);
    });

    it("links URLs, mentions and hashtags", () => {
        const segs = tweetSegments(
            "hi @jack see https://example.com/x. #Tag",
            new Map([["https://example.com/x", "example.com/x"]]),
        );
        expect(segs).toEqual([
            { kind: "text", text: "hi " },
            { kind: "link", text: "@jack", href: "https://x.com/jack" },
            { kind: "text", text: " see " },
            {
                kind: "link",
                text: "example.com/x",
                href: "https://example.com/x",
            },
            { kind: "text", text: ". " },
            {
                kind: "link",
                text: "#Tag",
                href: "https://x.com/hashtag/Tag",
            },
        ]);
    });

    it("does not link emails, URL fragments or number hashtags", () => {
        const segs = tweetSegments("mail a@b.com #1 x&#39;s");
        expect(segs).toEqual([
            { kind: "text", text: "mail a@b.com #1 x&#39;s" },
        ]);
    });

    it("keeps a balanced closing paren in a URL", () => {
        const segs = tweetSegments("(see https://en.wikipedia.org/wiki/A_(b))");
        expect(segs[1]).toEqual({
            kind: "link",
            text: "https://en.wikipedia.org/wiki/A_(b)",
            href: "https://en.wikipedia.org/wiki/A_(b)",
        });
        expect(segs[2]).toEqual({ kind: "text", text: ")" });
    });

    it("links non-Latin hashtags", () => {
        const segs = tweetSegments("#日本語");
        expect(segs[0]).toMatchObject({ kind: "link", text: "#日本語" });
    });
});

describe("parseFxStatusResponse", () => {
    it("parses a plain tweet", () => {
        const t = parseFxStatusResponse({ code: 200, status: status() })!;
        expect(t.authorName).toBe("Some One");
        expect(t.authorHandle).toBe("someone");
        expect(t.text).toBe("hello");
        expect(t.likes).toBe(3);
        expect(t.createdAt).toBe(1700000000000);
        expect(t.quote).toBeNull();
    });

    it("parses media in posted order, GIFs as video", () => {
        const t = parseFxStatusResponse({
            status: status({
                media: {
                    all: [
                        {
                            type: "photo",
                            url: "https://pbs.twimg.com/media/a.jpg?name=orig",
                            width: 10,
                            height: 20,
                            altText: "alt",
                        },
                        {
                            type: "gif",
                            url: "https://video.twimg.com/tweet_video/b.mp4",
                            thumbnail_url: "https://pbs.twimg.com/b.jpg",
                            duration: 1,
                        },
                        {
                            type: "video",
                            url: "javascript:alert(1)",
                        },
                    ],
                },
            }),
        })!;
        expect(t.media).toEqual([
            {
                kind: "photo",
                url: "https://pbs.twimg.com/media/a.jpg?name=orig",
                width: 10,
                height: 20,
                thumbnail: undefined,
                alt: "alt",
            },
            {
                kind: "gif",
                url: "https://video.twimg.com/tweet_video/b.mp4",
                width: undefined,
                height: undefined,
                thumbnail: "https://pbs.twimg.com/b.jpg",
                alt: undefined,
            },
        ]);
    });

    it("nests a quote one level deep", () => {
        const t = parseFxStatusResponse({
            status: status({
                quote: status({
                    url: "https://x.com/other/status/9",
                    text: "quoted\nline",
                    quote: status({ text: "too deep" }),
                }),
            }),
        })!;
        expect(t.quote && !isQuoteTombstone(t.quote)).toBe(true);
        const q = t.quote as Exclude<typeof t.quote, null>;
        if (isQuoteTombstone(q)) throw new Error("tombstone");
        expect(q.text).toBe("quoted\nline");
        expect(q.quote).toBeNull();
    });

    it("keeps an unavailable quote as a tombstone", () => {
        const t = parseFxStatusResponse({
            status: status({
                quote: {
                    type: "tombstone",
                    message: "This post is unavailable.",
                },
            }),
        })!;
        expect(t.quote).toEqual({
            tombstone: "This post is unavailable.",
            url: undefined,
        });
    });

    it("parses replies, polls and community notes", () => {
        const t = parseFxStatusResponse({
            status: status({
                replying_to: {
                    screen_name: "parent",
                    url: "https://x.com/parent/status/1",
                },
                poll: {
                    choices: [
                        { label: "Yes", count: 3, percentage: 75 },
                        { label: "No", count: 1, percentage: 250 },
                    ],
                    total_votes: 4,
                    ends_at: "2020-01-01T00:00:00Z",
                },
                community_note: {
                    text: "context https://example.com",
                    facets: [],
                },
            }),
        })!;
        expect(t.replyingTo).toEqual({
            handle: "parent",
            url: "https://x.com/parent/status/1",
        });
        expect(t.poll).toEqual({
            choices: [
                { label: "Yes", percentage: 75 },
                { label: "No", percentage: 100 },
            ],
            totalVotes: 4,
            endsAt: Date.parse("2020-01-01T00:00:00Z"),
        });
        expect(t.communityNote?.[1]).toEqual({
            kind: "link",
            text: "https://example.com",
            href: "https://example.com",
        });
    });

    it("refuses malformed or non-https statuses", () => {
        expect(parseFxStatusResponse(null)).toBeNull();
        expect(parseFxStatusResponse({ code: 404 })).toBeNull();
        expect(
            parseFxStatusResponse({
                status: status({ url: "javascript:alert(1)" }),
            }),
        ).toBeNull();
        expect(
            parseFxStatusResponse({ status: status({ author: {} }) }),
        ).toBeNull();
    });
});

describe("helpers", () => {
    it("asks pbs.twimg.com for a medium photo", () => {
        expect(
            tweetPhotoThumb("https://pbs.twimg.com/media/a.jpg?name=orig"),
        ).toBe("https://pbs.twimg.com/media/a.jpg?name=medium");
        expect(tweetPhotoThumb("https://example.com/a.jpg")).toBe(
            "https://example.com/a.jpg",
        );
    });

    it("compacts counts", () => {
        expect(compactCount(1234, "en")).toBe("1.2K");
        expect(compactCount(12, "en")).toBe("12");
    });
});
