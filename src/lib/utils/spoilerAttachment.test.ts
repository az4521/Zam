import { describe, it, expect } from "vitest";
import {
    isSpoilerFilename,
    isSpoilerMedia,
    withSpoiler,
} from "./spoilerAttachment";

describe("withSpoiler", () => {
    it("prefixes a plain name", () => {
        expect(withSpoiler("cat.png", true)).toBe("SPOILER_cat.png");
    });

    it("does not double an existing prefix", () => {
        expect(withSpoiler("SPOILER_cat.png", true)).toBe("SPOILER_cat.png");
    });

    it("strips the prefix when turned off", () => {
        expect(withSpoiler("SPOILER_cat.png", false)).toBe("cat.png");
    });

    it("leaves a plain name alone when turned off", () => {
        expect(withSpoiler("cat.png", false)).toBe("cat.png");
    });
});

describe("isSpoilerMedia", () => {
    it("reads filename over a caption body", () => {
        expect(
            isSpoilerMedia({ filename: "SPOILER_a.png", body: "look" }),
        ).toBe(true);
        expect(isSpoilerMedia({ filename: "a.png", body: "SPOILER_x" })).toBe(
            false,
        );
    });

    it("falls back to body", () => {
        expect(isSpoilerMedia({ body: "SPOILER_a.png" })).toBe(true);
    });

    it("is false for missing content", () => {
        expect(isSpoilerMedia(null)).toBe(false);
        expect(isSpoilerFilename(undefined)).toBe(false);
    });
});
