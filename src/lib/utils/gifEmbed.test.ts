import { afterEach, describe, it, expect, vi } from "vitest";
import { fetchGifEmbed, isGifHostLink, isGifHostMediaUrl } from "./gifEmbed";

const GIPHY_ID = "3o7abKhOpu0NwenH3O";
const GIPHY_MEDIA = `https://media.giphy.com/media/${GIPHY_ID}`;

describe("isGifHostLink", () => {
    it("recognises page links on each site", () => {
        expect(isGifHostLink("https://klipy.com/gifs/nukes-true")).toBe(true);
        expect(isGifHostLink(`https://giphy.com/gifs/${GIPHY_ID}`)).toBe(true);
        expect(isGifHostLink("https://tenor.com/view/hello-gif-5539206")).toBe(
            true,
        );
    });

    it("recognises media files on each site's CDN", () => {
        for (const url of [
            "https://static2.klipy.com/ii/a/b.gif",
            `${GIPHY_MEDIA}/giphy.gif`,
            "https://media1.tenor.com/m/abc/x.gif",
        ]) {
            expect(isGifHostLink(url)).toBe(true);
        }
    });

    it("rejects other pages and lookalike hosts", () => {
        for (const url of [
            "https://klipy.com/about",
            "https://giphy.com/explore/cats",
            "https://giphy.com/gifs/nasa-moonlanding",
            "https://tenor.com/search/cat-gifs",
            `https://giphy.com.evil.example/gifs/${GIPHY_ID}`,
            "https://eviltenor.com/a.gif",
            "not a url",
        ]) {
            expect(isGifHostLink(url)).toBe(false);
        }
    });
});

describe("isGifHostMediaUrl", () => {
    it("only accepts https on the sites' own hosts", () => {
        expect(isGifHostMediaUrl("https://media.tenor.com/a.mp4")).toBe(true);
        expect(isGifHostMediaUrl("http://media.tenor.com/a.mp4")).toBe(false);
        expect(isGifHostMediaUrl("https://evil.example/tenor.com.mp4")).toBe(
            false,
        );
        expect(isGifHostMediaUrl(undefined)).toBe(false);
    });
});

describe("fetchGifEmbed", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("resolves KLIPY through its API", async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            json: async () => ({
                data: {
                    data: [
                        {
                            slug: "via-api",
                            file: {
                                hd: {
                                    mp4: {
                                        url: "https://static2.klipy.com/a.mp4",
                                    },
                                },
                            },
                        },
                    ],
                },
            }),
        }));
        vi.stubGlobal("fetch", fetchMock);
        await expect(
            fetchGifEmbed("https://klipy.com/gifs/via-api"),
        ).resolves.toMatchObject({
            videoUrl: "https://static2.klipy.com/a.mp4",
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("derives GIPHY media from the id in the link", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const embed = {
            videoUrl: `${GIPHY_MEDIA}/giphy.mp4`,
            imageUrl: `${GIPHY_MEDIA}/giphy.webp`,
        };
        for (const url of [
            `https://giphy.com/gifs/${GIPHY_ID}`,
            `https://www.giphy.com/gifs/some-long-title-${GIPHY_ID}/`,
            `https://giphy.com/embed/${GIPHY_ID}`,
        ]) {
            await expect(fetchGifEmbed(url)).resolves.toEqual(embed);
        }
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("keeps GIPHY stickers as images, for their transparency", async () => {
        await expect(
            fetchGifEmbed(`https://giphy.com/stickers/wave-${GIPHY_ID}`),
        ).resolves.toEqual({ imageUrl: `${GIPHY_MEDIA}/giphy.webp` });
    });

    it("points Tenor at the page's .gif redirect", async () => {
        const imageUrl = "https://tenor.com/view/hello-gif-5539206.gif";
        await expect(
            fetchGifEmbed("https://tenor.com/view/hello-gif-5539206"),
        ).resolves.toEqual({ imageUrl });
        await expect(
            fetchGifEmbed("https://tenor.com/fr/view/hello-gif-5539206"),
        ).resolves.toEqual({ imageUrl });
    });

    it("embeds a bare media file as it is", async () => {
        await expect(
            fetchGifEmbed("https://media.tenor.com/a/b.gif"),
        ).resolves.toEqual({ imageUrl: "https://media.tenor.com/a/b.gif" });
        await expect(
            fetchGifEmbed("https://static2.klipy.com/ii/d.mp4"),
        ).resolves.toEqual({ videoUrl: "https://static2.klipy.com/ii/d.mp4" });
    });

    it("is null for anything else", async () => {
        await expect(
            fetchGifEmbed("https://example.com/a.gif"),
        ).resolves.toBeNull();
    });
});
