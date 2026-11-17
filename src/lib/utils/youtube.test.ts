import { describe, it, expect } from "vitest";
import {
    parseYoutubeUrl,
    parseStartTime,
    parseOembedTitle,
    youtubeWatchUrl,
    youtubeOembedUrl,
} from "./youtube";

const ID = "jNQXAC9IVRw";

describe("parseYoutubeUrl", () => {
    it("reads watch URLs", () => {
        expect(
            parseYoutubeUrl(`https://www.youtube.com/watch?v=${ID}`),
        ).toEqual({ id: ID, start: 0, short: false });
        expect(parseYoutubeUrl(`https://youtube.com/watch?v=${ID}`)).toEqual({
            id: ID,
            start: 0,
            short: false,
        });
    });

    it("ignores unrelated query params on watch URLs", () => {
        expect(
            parseYoutubeUrl(
                `https://www.youtube.com/watch?feature=share&list=PL123&v=${ID}&index=2`,
            ),
        ).toEqual({ id: ID, start: 0, short: false });
    });

    it("accepts the m., music. and nocookie hosts", () => {
        expect(parseYoutubeUrl(`https://m.youtube.com/watch?v=${ID}`)?.id).toBe(
            ID,
        );
        expect(
            parseYoutubeUrl(`https://music.youtube.com/watch?v=${ID}`)?.id,
        ).toBe(ID);
        expect(
            parseYoutubeUrl(`https://www.youtube-nocookie.com/embed/${ID}`)?.id,
        ).toBe(ID);
        expect(
            parseYoutubeUrl(`https://youtube-nocookie.com/v/${ID}`)?.id,
        ).toBe(ID);
    });

    it("reads shorts, with and without www, trailing slash or tracking params", () => {
        expect(parseYoutubeUrl(`https://www.youtube.com/shorts/${ID}`)).toEqual(
            {
                id: ID,
                start: 0,
                short: true,
            },
        );
        expect(parseYoutubeUrl(`https://m.youtube.com/shorts/${ID}`)).toEqual({
            id: ID,
            start: 0,
            short: true,
        });
        expect(
            parseYoutubeUrl(`https://www.youtube.com/shorts/${ID}/`),
        ).toEqual({
            id: ID,
            start: 0,
            short: true,
        });
        expect(
            parseYoutubeUrl(
                `https://www.youtube.com/shorts/${ID}?feature=share`,
            ),
        ).toEqual({ id: ID, start: 0, short: true });
    });

    it("reads youtu.be with si and t params", () => {
        expect(parseYoutubeUrl(`https://youtu.be/${ID}?si=abcDEF123`)).toEqual({
            id: ID,
            start: 0,
            short: false,
        });
        expect(parseYoutubeUrl(`https://youtu.be/${ID}?t=1m30s`)).toEqual({
            id: ID,
            start: 90,
            short: false,
        });
    });

    it("reads live and embed paths", () => {
        expect(parseYoutubeUrl(`https://www.youtube.com/live/${ID}`)).toEqual({
            id: ID,
            start: 0,
            short: false,
        });
        expect(parseYoutubeUrl(`https://www.youtube.com/embed/${ID}`)?.id).toBe(
            ID,
        );
    });

    it("reads a start offset from t or start", () => {
        expect(
            parseYoutubeUrl(`https://www.youtube.com/watch?v=${ID}&t=90`)
                ?.start,
        ).toBe(90);
        expect(
            parseYoutubeUrl(`https://www.youtube.com/watch?v=${ID}&t=90s`)
                ?.start,
        ).toBe(90);
        expect(
            parseYoutubeUrl(`https://www.youtube.com/watch?v=${ID}&start=42`)
                ?.start,
        ).toBe(42);
        expect(
            parseYoutubeUrl(`https://www.youtube.com/watch?v=${ID}&t=1h2m3s`)
                ?.start,
        ).toBe(3723);
        expect(
            parseYoutubeUrl(`https://www.youtube.com/watch?v=${ID}&t=bogus`)
                ?.start,
        ).toBe(0);
    });

    it("rejects ids that are not 11 valid characters", () => {
        expect(parseYoutubeUrl("https://youtu.be/short")).toBeNull();
        expect(parseYoutubeUrl("https://youtu.be/abcdefghijkl")).toBeNull();
        expect(
            parseYoutubeUrl("https://www.youtube.com/watch?v=abc"),
        ).toBeNull();
        expect(
            parseYoutubeUrl("https://www.youtube.com/watch?v=abc!defghij"),
        ).toBeNull();
        expect(
            parseYoutubeUrl("https://www.youtube.com/shorts/abc"),
        ).toBeNull();
    });

    it("rejects non-YouTube hosts that only look like YouTube", () => {
        expect(
            parseYoutubeUrl(`https://notyoutube.com/watch?v=${ID}`),
        ).toBeNull();
        expect(
            parseYoutubeUrl(`https://youtube.com.evil.com/watch?v=${ID}`),
        ).toBeNull();
        expect(
            parseYoutubeUrl(`https://evil.com/youtube.com/watch?v=${ID}`),
        ).toBeNull();
    });

    it("rejects channel, playlist and shorts-without-id pages", () => {
        expect(
            parseYoutubeUrl("https://www.youtube.com/@SomeChannel"),
        ).toBeNull();
        expect(
            parseYoutubeUrl("https://www.youtube.com/channel/UC123"),
        ).toBeNull();
        expect(
            parseYoutubeUrl(
                "https://www.youtube.com/playlist?list=PL1234567890",
            ),
        ).toBeNull();
        expect(parseYoutubeUrl("https://www.youtube.com/shorts/")).toBeNull();
        expect(parseYoutubeUrl("https://www.youtube.com/watch")).toBeNull();
        expect(parseYoutubeUrl("https://youtu.be/")).toBeNull();
    });

    it("rejects non-http schemes and garbage", () => {
        expect(
            parseYoutubeUrl(`ftp://www.youtube.com/watch?v=${ID}`),
        ).toBeNull();
        expect(parseYoutubeUrl("not a url")).toBeNull();
        expect(parseYoutubeUrl("")).toBeNull();
    });
});

describe("parseStartTime", () => {
    it("reads plain seconds and unit forms", () => {
        expect(parseStartTime("90")).toBe(90);
        expect(parseStartTime("90s")).toBe(90);
        expect(parseStartTime("2m")).toBe(120);
        expect(parseStartTime("1h2m3s")).toBe(3723);
        expect(parseStartTime("1h")).toBe(3600);
    });

    it("returns 0 for missing or invalid values", () => {
        expect(parseStartTime(null)).toBe(0);
        expect(parseStartTime("")).toBe(0);
        expect(parseStartTime("1m30")).toBe(0);
        expect(parseStartTime("abc")).toBe(0);
        expect(parseStartTime("-5")).toBe(0);
    });
});

describe("youtubeWatchUrl and youtubeOembedUrl", () => {
    it("builds the canonical watch URL", () => {
        expect(youtubeWatchUrl(ID)).toBe(
            `https://www.youtube.com/watch?v=${ID}`,
        );
    });

    it("builds an oEmbed URL that encodes the watch URL", () => {
        expect(youtubeOembedUrl(youtubeWatchUrl(ID))).toBe(
            "https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DjNQXAC9IVRw",
        );
    });
});

describe("parseOembedTitle", () => {
    it("returns the trimmed title and channel name", () => {
        expect(
            parseOembedTitle({
                title: "  Me at the zoo ",
                author_name: " jawed ",
            }),
        ).toEqual({ title: "Me at the zoo", author: "jawed" });
    });

    it("gives a null author when there is no channel name", () => {
        expect(parseOembedTitle({ title: "Clip" })).toEqual({
            title: "Clip",
            author: null,
        });
        expect(parseOembedTitle({ title: "Clip", author_name: "  " })).toEqual({
            title: "Clip",
            author: null,
        });
    });

    it("rejects empty, non-string or non-object input", () => {
        expect(parseOembedTitle({ title: "   " })).toBeNull();
        expect(parseOembedTitle({ title: 42 })).toBeNull();
        expect(parseOembedTitle({})).toBeNull();
        expect(parseOembedTitle(null)).toBeNull();
        expect(parseOembedTitle("title")).toBeNull();
        expect(parseOembedTitle(undefined)).toBeNull();
    });
});
