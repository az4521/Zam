import { describe, it, expect } from "vitest";
import {
    trendingUrl,
    searchUrl,
    normalizeKlipyItems,
    normalizeGifTab,
    type GifPage,
} from "./klipy";

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
                    files: {
                        hd: {
                            gif: {
                                url: "https://m.klipy.com/hd.gif",
                                width: 480,
                                height: 270,
                            },
                        },
                        sm: {
                            gif: {
                                url: "https://m.klipy.com/sm.gif",
                                width: 160,
                                height: 90,
                            },
                        },
                    },
                },
                { id: 7, files: {} }, // no usable rendition -> skipped
            ],
        },
    };

    it("maps items to GifResult and reads has_next", () => {
        const page: GifPage = normalizeKlipyItems(sample);
        expect(page.hasNext).toBe(true);
        expect(page.items).toHaveLength(1);
        expect(page.items[0]).toEqual({
            id: "42",
            url: "https://m.klipy.com/hd.gif",
            previewUrl: "https://m.klipy.com/sm.gif",
            width: 480,
            height: 270,
        });
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
