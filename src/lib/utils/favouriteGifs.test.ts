import { describe, it, expect } from "vitest";
import { pickFavouriteGifs } from "./favouriteGifs";

describe("pickFavouriteGifs — new-key-wins migration", () => {
    it("returns the new-key list when present, ignoring the legacy list", () => {
        expect(pickFavouriteGifs(["new"], ["old"])).toEqual(["new"]);
    });

    it("carries the legacy list forward when the new key is absent", () => {
        // The data-loss guard: an existing user's favourites survive migration.
        expect(pickFavouriteGifs(null, ["old1", "old2"])).toEqual([
            "old1",
            "old2",
        ]);
    });

    it("treats a present-but-empty new key as authoritative (no resurrection)", () => {
        // User cleared favourites under the new key — must NOT fall back to the
        // stale legacy blob.
        expect(pickFavouriteGifs([], ["old"])).toEqual([]);
    });

    it("returns empty when neither key is set", () => {
        expect(pickFavouriteGifs(null, null)).toEqual([]);
    });
});
