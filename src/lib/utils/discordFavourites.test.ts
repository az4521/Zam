import { describe, it, expect } from "vitest";
import {
    canonicalFavouriteUrl,
    discordItemToFavourite,
    discordItemsToFavourites,
    mapWithLimit,
    mergeImportedFavourites,
    usableDiscordItems,
    type DiscordFavouriteItem,
} from "./discordFavourites";
import type { FavouriteGif } from "$lib/matrix/client";

const gif = (url: string, addedAt = 1): FavouriteGif => ({
    url,
    previewUrl: `${url}.webp`,
    addedAt,
});

describe("usableDiscordItems", () => {
    it("keeps only http(s) links", () => {
        const items: DiscordFavouriteItem[] = [
            { url: "https://a.example/x.gif", video: false },
            { url: "javascript:alert(1)", video: false },
            { url: "not a url", video: false },
            { url: "http://b.example/y.gif", video: true },
        ];
        expect(usableDiscordItems(items).map((i) => i.url)).toEqual([
            "https://a.example/x.gif",
            "http://b.example/y.gif",
        ]);
    });
});

describe("discordItemToFavourite", () => {
    const preview = {
        imageUrl: "mxc-thumb",
        imageWidth: 300,
        imageHeight: 200,
    };

    it("builds from the preview and keeps its size", () => {
        expect(
            discordItemToFavourite(
                {
                    url: "https://tenor.com/view/a-1",
                    video: false,
                    width: 9,
                    height: 9,
                },
                preview,
                true,
            ),
        ).toEqual({
            url: "https://tenor.com/view/a-1",
            previewUrl: "mxc-thumb",
            width: 300,
            height: 200,
        });
    });

    it("falls back to Discord's size only when the preview has none", () => {
        const got = discordItemToFavourite(
            {
                url: "https://x.example/a",
                video: false,
                width: 480,
                height: 270,
            },
            { imageUrl: "p" },
            false,
        );
        expect(got).toEqual({
            url: "https://x.example/a",
            previewUrl: "p",
            width: 480,
            height: 270,
        });
    });

    it("never uses Discord's src as the preview", () => {
        const got = discordItemToFavourite(
            {
                url: "https://x.example/a",
                src: "https://cdn.discord/a.gif",
                video: false,
            },
            null,
            false,
        );
        expect(got).toBeNull();
    });

    it("returns null for a preview without media", () => {
        expect(
            discordItemToFavourite(
                { url: "https://x/a", video: false },
                { imageWidth: 10 },
                false,
            ),
        ).toBeNull();
    });
});

describe("discordItemsToFavourites", () => {
    it("keeps Discord order and places imports older than now", () => {
        const out = discordItemsToFavourites(
            [
                { url: "https://a", previewUrl: "pa" },
                { url: "https://b", previewUrl: "pb" },
            ],
            10_000,
        );
        expect(out.map((g) => g.url)).toEqual(["https://a", "https://b"]);
        expect(out[0].addedAt).toBe(10_000 - 1000);
        expect(out[1].addedAt).toBe(10_000 - 1001);
        expect(out[0].addedAt).toBeLessThan(10_000);
    });
});

describe("mergeImportedFavourites", () => {
    it("appends new entries after existing ones", () => {
        const base = [gif("https://a")];
        const out = mergeImportedFavourites(base, [
            gif("https://b"),
            gif("https://c"),
        ]);
        expect(out.map((g) => g.url)).toEqual([
            "https://a",
            "https://b",
            "https://c",
        ]);
        expect(base.map((g) => g.url)).toEqual(["https://a"]);
    });

    it("skips URLs already present and duplicates within the import", () => {
        const out = mergeImportedFavourites(
            [gif("https://a")],
            [gif("https://a"), gif("https://b"), gif("https://b")],
        );
        expect(out.map((g) => g.url)).toEqual(["https://a", "https://b"]);
    });

    it("returns the same base reference when nothing is added", () => {
        const base = [gif("https://a")];
        expect(mergeImportedFavourites(base, [gif("https://a")])).toBe(base);
    });

    it("is idempotent", () => {
        const base = [gif("https://a")];
        const imported = [gif("https://b"), gif("https://a")];
        const once = mergeImportedFavourites(base, imported);
        const twice = mergeImportedFavourites(once, imported);
        expect(twice).toEqual(once);
        expect(twice).toBe(once);
    });

    it("treats spelling variants of one link as the same favourite", () => {
        const base = [gif("https://tenor.com/view/cat-gif-123")];
        const out = mergeImportedFavourites(base, [
            {
                ...gif("https://www.tenor.com/en-GB/view/cat-gif-123/"),
                previewUrl: "x",
            },
            {
                ...gif("https://tenor.com/view/cat-gif-123?utm_source=share#a"),
                previewUrl: "y",
            },
        ]);
        expect(out).toBe(base);
    });

    it("keeps links whose meaningful query differs", () => {
        const out = mergeImportedFavourites(
            [gif("https://example.com/v?id=1")],
            [gif("https://example.com/v?id=2")],
        );
        expect(out).toHaveLength(2);
    });

    it("skips a GIF whose favourite was re-keyed to another link", () => {
        // An earlier import stored https://old; a later URL upgrade moved it
        // to https://new but kept the preview.
        const base = [
            { ...gif("https://new"), previewUrl: "https://old.webp" },
        ];
        expect(mergeImportedFavourites(base, [gif("https://old")])).toBe(base);
    });
});

describe("canonicalFavouriteUrl", () => {
    it("normalises host, slash, fragment, tracking params and param order", () => {
        expect(
            canonicalFavouriteUrl(
                "https://WWW.Example.com/a/?b=2&utm_x=1&a=1#f",
            ),
        ).toBe("example.com/a?a=1&b=2");
    });

    it("returns unparseable input unchanged", () => {
        expect(canonicalFavouriteUrl("not a url")).toBe("not a url");
    });
});

describe("mapWithLimit", () => {
    it("never runs more than the limit at once and keeps order", async () => {
        let running = 0;
        let peak = 0;
        const out = await mapWithLimit([1, 2, 3, 4, 5, 6, 7], 4, async (n) => {
            running++;
            peak = Math.max(peak, running);
            await new Promise((r) => setTimeout(r, 5));
            running--;
            return n * 2;
        });
        expect(peak).toBeLessThanOrEqual(4);
        expect(peak).toBeGreaterThan(1);
        expect(out).toEqual([2, 4, 6, 8, 10, 12, 14]);
    });

    it("handles an empty list", async () => {
        expect(await mapWithLimit([], 4, async (n: number) => n)).toEqual([]);
    });
});
