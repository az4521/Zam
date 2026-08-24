import { describe, it, expect } from "vitest";
import { galleryNav } from "./mediaGallery";

describe("galleryNav", () => {
    it("has both neighbours in the middle of a list", () => {
        expect(galleryNav(5, 2)).toEqual({ prevIndex: 1, nextIndex: 3 });
    });

    it("has no previous at the first item", () => {
        expect(galleryNav(5, 0)).toEqual({ prevIndex: null, nextIndex: 1 });
    });

    it("has no next at the last item", () => {
        expect(galleryNav(5, 4)).toEqual({ prevIndex: 3, nextIndex: null });
    });

    it("has no neighbours for a single-item list", () => {
        expect(galleryNav(1, 0)).toEqual({ prevIndex: null, nextIndex: null });
    });

    it("has no neighbours for an empty list", () => {
        expect(galleryNav(0, 0)).toEqual({ prevIndex: null, nextIndex: null });
    });

    it("returns no neighbours when current is past the end", () => {
        expect(galleryNav(3, 3)).toEqual({ prevIndex: null, nextIndex: null });
        expect(galleryNav(3, 99)).toEqual({ prevIndex: null, nextIndex: null });
    });

    it("returns no neighbours for a negative current index", () => {
        expect(galleryNav(3, -1)).toEqual({ prevIndex: null, nextIndex: null });
    });

    it("handles a two-item list at each end", () => {
        expect(galleryNav(2, 0)).toEqual({ prevIndex: null, nextIndex: 1 });
        expect(galleryNav(2, 1)).toEqual({ prevIndex: 0, nextIndex: null });
    });
});
