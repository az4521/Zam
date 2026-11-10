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

import {
    favouriteSize,
    favouriteUrlForMxc,
    favouritesState,
    setFavouriteGifMxc,
    upgradeFavouriteGifs,
} from "./favourites.svelte";

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

const plainUrl =
    "https://hs.example/_matrix/client/v1/media/download/hs.example/Plain1";
const encryptedGif = {
    url: "matrix-event:!r:hs.example/$e",
    previewUrl: "matrix-event:!r:hs.example/$e",
    addedAt: 3,
    source: { roomId: "!r:hs.example", eventId: "$e" },
};

describe("favouriteUrlForMxc", () => {
    it("finds a plain favourite by the media its URL names", () => {
        favouritesState.gifs = [{ url: plainUrl, previewUrl: "p", addedAt: 1 }];
        expect(favouriteUrlForMxc("mxc://hs.example/Plain1")).toBe(plainUrl);
    });

    it("finds an encrypted favourite by its stored mxc", () => {
        favouritesState.gifs = [
            { ...encryptedGif, mxc: "mxc://hs.example/Enc1" },
        ];
        expect(favouriteUrlForMxc("mxc://hs.example/Enc1")).toBe(
            encryptedGif.url,
        );
    });

    it("finds nothing for media that no favourite holds", () => {
        favouritesState.gifs = [other, encryptedGif];
        expect(favouriteUrlForMxc("mxc://hs.example/Nope")).toBeUndefined();
    });

    it("follows the list when it is replaced", () => {
        favouritesState.gifs = [{ url: plainUrl, previewUrl: "p", addedAt: 1 }];
        expect(favouriteUrlForMxc("mxc://hs.example/Plain1")).toBe(plainUrl);
        favouritesState.gifs = [];
        expect(favouriteUrlForMxc("mxc://hs.example/Plain1")).toBeUndefined();
    });

    it("ignores an mxc that is not a string", () => {
        favouritesState.gifs = [
            { ...encryptedGif, mxc: 42 as unknown as string },
        ];
        expect(favouriteUrlForMxc("42")).toBeUndefined();
    });
});

describe("setFavouriteGifMxc", () => {
    beforeEach(() => {
        favouritesState.gifs = server.gifs = [encryptedGif, other];
    });

    it("stores the mxc on the favourite, which then matches", async () => {
        await setFavouriteGifMxc(encryptedGif.url, "mxc://hs.example/Enc1");
        expect(server.gifs).toEqual([
            { ...encryptedGif, mxc: "mxc://hs.example/Enc1" },
            other,
        ]);
        expect(favouriteUrlForMxc("mxc://hs.example/Enc1")).toBe(
            encryptedGif.url,
        );
    });

    it("leaves a favourite that already has the mxc alone", async () => {
        await setFavouriteGifMxc(encryptedGif.url, "mxc://hs.example/Enc1");
        const before = server.gifs;
        await setFavouriteGifMxc(encryptedGif.url, "mxc://hs.example/Enc1");
        expect(server.gifs).toBe(before);
    });

    it("does nothing for a favourite that is gone", async () => {
        const before = server.gifs;
        await setFavouriteGifMxc("matrix-event:!gone/$x", "mxc://hs.example/x");
        expect(server.gifs).toBe(before);
    });
});

describe("favouriteSize", () => {
    it("keeps a usable size, from numbers or numeric strings", () => {
        expect(favouriteSize(480, 270)).toEqual({ width: 480, height: 270 });
        expect(favouriteSize("480", "270")).toEqual({
            width: 480,
            height: 270,
        });
    });

    it("drops a size with either side unusable", () => {
        expect(favouriteSize(480, undefined)).toEqual({});
        expect(favouriteSize(0, 270)).toEqual({});
        expect(favouriteSize([480], 270)).toEqual({});
        expect(favouriteSize(Number.NaN, Number.NaN)).toEqual({});
    });
});
