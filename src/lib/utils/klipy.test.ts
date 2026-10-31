import { afterEach, describe, it, expect, vi } from "vitest";
import {
    trendingUrl,
    searchUrl,
    normalizeKlipyItems,
    normalizeGifTab,
    fetchKlipyEmbed,
    isKlipyLink,
    isKlipyMediaUrl,
    klipyItemUrl,
    type GifPage,
} from "./klipy";

describe("klipy links", () => {
    it("recognises page links", () => {
        expect(isKlipyLink("https://klipy.com/gifs/nukes-true")).toBe(true);
        expect(isKlipyLink("https://www.klipy.com/memes/a_b/")).toBe(true);
    });

    it("rejects other pages and lookalike hosts", () => {
        expect(isKlipyLink("https://klipy.com/about")).toBe(false);
        expect(isKlipyLink("https://static2.klipy.com/ii/a/b.gif")).toBe(false);
        expect(isKlipyLink("https://klipy.com.evil.example/gifs/a")).toBe(
            false,
        );
        expect(isKlipyLink("not a url")).toBe(false);
    });

    it("only treats https KLIPY hosts as KLIPY media", () => {
        expect(isKlipyMediaUrl("https://static2.klipy.com/a.mp4")).toBe(true);
        expect(isKlipyMediaUrl("http://static2.klipy.com/a.mp4")).toBe(false);
        expect(isKlipyMediaUrl("https://evil.example/klipy.com.mp4")).toBe(
            false,
        );
        expect(isKlipyMediaUrl(undefined)).toBe(false);
    });
});

describe("fetchKlipyEmbed", () => {
    const cdn = "https://static2.klipy.com/ii";
    const respond = (body: unknown, ok = true) =>
        vi.fn(async () => ({
            ok,
            status: ok ? 200 : 429,
            json: async () => body,
        }));
    const items = (slug: string, file: unknown) => ({
        data: { data: [{ slug, file }] },
    });

    afterEach(() => vi.unstubAllGlobals());

    it("resolves a page link through the API, playing the mp4", async () => {
        const fetchMock = respond(
            items("resolve-me", {
                hd: {
                    mp4: { url: `${cdn}/a.mp4`, width: 498, height: 282 },
                    webp: { url: `${cdn}/a.webp`, width: 498, height: 282 },
                    jpg: { url: `${cdn}/a.jpg` },
                },
            }),
        );
        vi.stubGlobal("fetch", fetchMock);
        await expect(
            fetchKlipyEmbed("https://klipy.com/gifs/resolve-me"),
        ).resolves.toMatchObject({
            videoUrl: `${cdn}/a.mp4`,
            videoThumbnailUrl: `${cdn}/a.jpg`,
            videoWidth: 498,
            imageUrl: `${cdn}/a.webp`,
        });
        expect(fetchMock).toHaveBeenCalledWith(
            klipyItemUrl("gifs", "resolve-me"),
            expect.objectContaining({ referrerPolicy: "no-referrer" }),
        );
    });

    it("asks once per link", async () => {
        const fetchMock = respond(
            items("once", { hd: { mp4: { url: `${cdn}/b.mp4` } } }),
        );
        vi.stubGlobal("fetch", fetchMock);
        await fetchKlipyEmbed("https://klipy.com/gifs/once");
        await fetchKlipyEmbed("https://klipy.com/gifs/once");
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("retries after a failed request", async () => {
        const url = "https://klipy.com/gifs/flaky";
        vi.stubGlobal("fetch", respond({}, false));
        await expect(fetchKlipyEmbed(url)).rejects.toThrow("KLIPY 429");
        vi.stubGlobal(
            "fetch",
            respond(items("flaky", { hd: { mp4: { url: `${cdn}/c.mp4` } } })),
        );
        await expect(fetchKlipyEmbed(url)).resolves.toMatchObject({
            videoUrl: `${cdn}/c.mp4`,
        });
    });

    it("refuses media hosted anywhere but KLIPY", async () => {
        vi.stubGlobal(
            "fetch",
            respond(
                items("offsite", {
                    hd: { mp4: { url: "https://evil.example/a.mp4" } },
                }),
            ),
        );
        await expect(
            fetchKlipyEmbed("https://klipy.com/gifs/offsite"),
        ).resolves.toBeNull();
    });

    it("is null for an item KLIPY doesn't have", async () => {
        vi.stubGlobal("fetch", respond({ data: { data: [] } }));
        await expect(
            fetchKlipyEmbed("https://klipy.com/gifs/gone"),
        ).resolves.toBeNull();
    });
});

describe("klipy url builders", () => {
    it("builds a trending url with kind, page and per_page", () => {
        const url = trendingUrl("gifs", 1);
        expect(url).toContain("/gifs/trending");
        expect(url).toContain("page=1");
        expect(url).toContain("per_page=24");
    });

    it("builds a search url for memes with an encoded query and page", () => {
        const url = searchUrl("memes", "happy dog", 2);
        expect(url).toContain("/memes/search");
        expect(url).toContain("q=happy%20dog");
        expect(url).toContain("&page=2");
    });
});

describe("normalizeKlipyItems", () => {
    const sample = {
        result: true,
        data: {
            current_page: 1,
            per_page: 24,
            has_next: true,
            data: [
                {
                    id: 42,
                    slug: "abc",
                    file: {
                        hd: {
                            gif: {
                                url: "https://static2.klipy.com/hd.gif",
                                width: 498,
                                height: 373,
                                size: 396,
                            },
                            webp: {
                                url: "https://static2.klipy.com/hd.webp",
                                width: 498,
                                height: 374,
                                size: 21,
                            },
                        },
                        md: {
                            webp: {
                                url: "https://static2.klipy.com/md.webp",
                                width: 498,
                                height: 373,
                                size: 40,
                            },
                        },
                        sm: {
                            mp4: {
                                url: "https://static2.klipy.com/sm.mp4",
                                width: 320,
                                height: 240,
                                size: 30,
                            },
                            gif: {
                                url: "https://static2.klipy.com/sm.gif",
                                width: 220,
                                height: 165,
                                size: 72,
                            },
                        },
                        xs: {
                            gif: {
                                url: "https://static2.klipy.com/xs.gif",
                                width: 121,
                                height: 90,
                                size: 24,
                            },
                        },
                    },
                },
                { id: 7, file: {} }, // no usable rendition -> skipped
            ],
        },
    };

    it("maps items to GifResult and reads has_next", () => {
        const page: GifPage = normalizeKlipyItems(sample);
        expect(page.hasNext).toBe(true);
        expect(page.items).toHaveLength(1);
        expect(page.items[0]).toEqual({
            id: "42",
            url: "https://static2.klipy.com/hd.gif", // full: gif, largest
            pageUrl: "https://klipy.com/gifs/abc", // what gets sent
            previewUrl: "https://static2.klipy.com/md.webp", // thumb: webp, mid
            previewVideoUrl: "https://static2.klipy.com/sm.mp4", // grid tile
            width: 498,
            height: 373,
        });
    });

    it("builds the page url from the requested kind", () => {
        const page = normalizeKlipyItems(sample, "memes");
        expect(page.items[0].pageUrl).toBe("https://klipy.com/memes/abc");
    });

    it("omits the page url for a missing or unsafe slug", () => {
        const item = sample.data.data[0];
        for (const slug of [undefined, "../x", "a b"]) {
            const page = normalizeKlipyItems({
                data: { data: [{ ...item, slug }] },
            });
            expect(page.items[0].pageUrl).toBeUndefined();
        }
    });

    it("returns an empty page for garbage input", () => {
        expect(normalizeKlipyItems(null)).toEqual({
            items: [],
            hasNext: false,
        });
        expect(normalizeKlipyItems({ data: { data: "nope" } })).toEqual({
            items: [],
            hasNext: false,
        });
    });
});

describe("normalizeGifTab", () => {
    it("accepts favourites, defaults everything else to gifs", () => {
        expect(normalizeGifTab("favourites")).toBe("favourites");
        expect(normalizeGifTab("gifs")).toBe("gifs");
        expect(normalizeGifTab(null)).toBe("gifs");
        expect(normalizeGifTab("garbage")).toBe("gifs");
    });
});
