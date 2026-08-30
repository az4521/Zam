import { describe, it, expect } from "vitest";
import {
    isGalleryImage,
    collectBodyGalleryImages,
    galleryNav,
    type BodyImageInput,
} from "./messageBodyGallery";

const media = (src: string, alt: string | null = null): BodyImageInput => ({
    src,
    alt,
    emoticon: false,
    twemoji: false,
});

describe("isGalleryImage", () => {
    it("accepts a real media image", () => {
        expect(isGalleryImage(media("https://hs/_matrix/x"))).toBe(true);
    });
    it("rejects a Twemoji emoji image", () => {
        expect(
            isGalleryImage({
                src: "/twemoji/svg/1f600.svg",
                emoticon: false,
                twemoji: true,
            }),
        ).toBe(false);
    });
    it("rejects a custom emote (data-mx-emoticon)", () => {
        expect(
            isGalleryImage({
                src: "https://hs/_matrix/e",
                emoticon: true,
                twemoji: false,
            }),
        ).toBe(false);
    });
    it("rejects an image with no src", () => {
        expect(
            isGalleryImage({ src: null, emoticon: false, twemoji: false }),
        ).toBe(false);
        expect(
            isGalleryImage({ src: "", emoticon: false, twemoji: false }),
        ).toBe(false);
        expect(
            isGalleryImage({ src: undefined, emoticon: false, twemoji: false }),
        ).toBe(false);
    });
});

describe("collectBodyGalleryImages", () => {
    it("keeps only media images, in DOM order", () => {
        const out = collectBodyGalleryImages([
            media("A"),
            { src: "/twemoji/svg/x.svg", emoticon: false, twemoji: true },
            media("B"),
            { src: "emote", emoticon: true, twemoji: false },
            media("C"),
        ]);
        expect(out.map((i) => i.src)).toEqual(["A", "B", "C"]);
    });
    it("defaults a missing alt to an empty string and preserves a present alt", () => {
        const out = collectBodyGalleryImages([media("A", "cat"), media("B")]);
        expect(out).toEqual([
            { src: "A", alt: "cat" },
            { src: "B", alt: "" },
        ]);
    });
    it("returns an empty list when there are no media images", () => {
        expect(
            collectBodyGalleryImages([
                { src: "/twemoji/svg/x.svg", emoticon: false, twemoji: true },
            ]),
        ).toEqual([]);
    });
    it("keeps duplicate srcs as separate entries (DOM order, no dedupe)", () => {
        expect(collectBodyGalleryImages([media("A"), media("A")]).length).toBe(
            2,
        );
    });
});

describe("galleryNav re-export", () => {
    it("disables both ends for a single-image gallery", () => {
        expect(galleryNav(1, 0)).toEqual({ prevIndex: null, nextIndex: null });
    });
    it("clamps at the ends and steps in the middle", () => {
        expect(galleryNav(3, 0)).toEqual({ prevIndex: null, nextIndex: 1 });
        expect(galleryNav(3, 1)).toEqual({ prevIndex: 0, nextIndex: 2 });
        expect(galleryNav(3, 2)).toEqual({ prevIndex: 1, nextIndex: null });
    });
});
