import { beforeEach, describe, expect, it, vi } from "vitest";

const getUrlPreview = vi.fn();
const fetchGifEmbed = vi.fn();
vi.mock("$lib/matrix/client", () => ({ getUrlPreview }));
vi.mock("$lib/stores/plugins.svelte", () => ({
    pluginRegistry: { previewUrlTransforms: [] },
}));
vi.mock("$lib/plugins/outgoingTransforms", () => ({
    applyPreviewUrlTransforms: (url: string) => url,
}));
vi.mock("$lib/utils/gifEmbed", async (orig) => ({
    ...(await orig<typeof import("$lib/utils/gifEmbed")>()),
    fetchGifEmbed,
}));

const { fetchLinkPreview } = await import("$lib/utils/linkPreviewFetch");

const TENOR = "https://tenor.com/view/cat-meme-gif-25804931";
const HS_IMAGE = "https://hs.example/_matrix/client/v1/media/download/a/b";
const SITE_IMAGE = `${TENOR}.gif`;

describe("fetchLinkPreview", () => {
    beforeEach(() => {
        getUrlPreview.mockReset();
        fetchGifEmbed.mockReset();
    });

    it("loads a GIF-site link from the site without asking the homeserver", async () => {
        fetchGifEmbed.mockResolvedValue({ imageUrl: SITE_IMAGE });
        const r = await fetchLinkPreview(TENOR, true);
        expect(r).toEqual({
            preview: { imageUrl: SITE_IMAGE },
            gifHostHeld: false,
        });
        expect(getUrlPreview).not.toHaveBeenCalled();
    });

    it("falls back to the homeserver when the site gives nothing", async () => {
        fetchGifEmbed.mockRejectedValue(new Error("down"));
        getUrlPreview.mockResolvedValue({ title: "Cat", imageUrl: HS_IMAGE });
        const r = await fetchLinkPreview(TENOR, true);
        expect(r.preview?.imageUrl).toBe(HS_IMAGE);
        expect(r.gifHostHeld).toBe(false);
    });

    it("never asks the site when embeds are not allowed", async () => {
        getUrlPreview.mockResolvedValue({ title: "Cat", imageUrl: HS_IMAGE });
        const r = await fetchLinkPreview(TENOR, false);
        expect(fetchGifEmbed).not.toHaveBeenCalled();
        expect(r).toMatchObject({ gifHostHeld: false });
        expect(r.preview?.imageUrl).toBe(HS_IMAGE);
    });

    it("holds a GIF-site link the homeserver has no media for", async () => {
        getUrlPreview.mockResolvedValue({ title: "Cat" });
        const r = await fetchLinkPreview(TENOR, false);
        expect(fetchGifEmbed).not.toHaveBeenCalled();
        expect(r.gifHostHeld).toBe(true);
    });

    it("asks only the homeserver for other links", async () => {
        getUrlPreview.mockResolvedValue({ title: "Page" });
        const r = await fetchLinkPreview("https://example.com/", true);
        expect(fetchGifEmbed).not.toHaveBeenCalled();
        expect(r).toEqual({ preview: { title: "Page" }, gifHostHeld: false });
    });
});
