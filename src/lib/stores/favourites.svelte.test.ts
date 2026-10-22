import { describe, it, expect, vi, beforeEach } from "vitest";

const server = { gifs: [] as unknown[] };
vi.mock("$lib/matrix/client", () => ({
    loadFavouriteGifs: () => [],
    fetchFavouriteGifsFromServer: async () => server.gifs,
    persistFavouriteGifs: async (gifs: unknown[]) => {
        server.gifs = gifs;
    },
    onAccountData: () => () => {},
    onSyncPrepared: () => () => {},
}));

import { favouritesState, upgradeFavouriteGifs } from "./favourites.svelte";

const old = {
    url: "https://static2.klipy.com/a.gif",
    previewUrl: "https://static2.klipy.com/a.webp",
    addedAt: 1,
    tags: ["boom"],
};
const other = { url: "https://x/b.gif", previewUrl: "p", addedAt: 2 };

describe("upgradeFavouriteGifs", () => {
    beforeEach(() => {
        favouritesState.gifs = [old, other];
        server.gifs = [old, other];
    });

    it("re-keys a static favourite onto the page url, keeping its data", async () => {
        await upgradeFavouriteGifs([
            {
                from: old.url,
                to: "https://klipy.com/gifs/a",
                previewVideoUrl: "https://static2.klipy.com/a.mp4",
            },
        ]);
        expect(server.gifs).toEqual([
            {
                ...old,
                url: "https://klipy.com/gifs/a",
                previewVideoUrl: "https://static2.klipy.com/a.mp4",
            },
            other,
        ]);
        expect(favouritesState.gifs).toEqual(server.gifs);
    });

    it("drops the old entry when the page url is already a favourite", async () => {
        const page = { ...other, url: "https://klipy.com/gifs/a" };
        favouritesState.gifs = server.gifs = [old, page];
        await upgradeFavouriteGifs([
            { from: old.url, to: "https://klipy.com/gifs/a" },
        ]);
        expect(server.gifs).toEqual([page]);
    });

    it("does nothing when no favourite matches", async () => {
        const before = server.gifs;
        await upgradeFavouriteGifs([{ from: "nope", to: "x" }]);
        expect(server.gifs).toBe(before);
    });
});
