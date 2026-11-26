import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/fx-status-20-photos.json";
import {
    MAX_TWEET_MEDIA,
    parseFxStatusResponse,
    tweetPhotoThumb,
} from "./tweetEmbed";
import { galleryNav, galleryPositionLabel } from "./mediaGallery";
import { reservedMediaBox } from "./mediaDimensions";

// Real FxTwitter v2 response for a 20-image post (captured 2026-11), trimmed to
// the fields the parser reads. The post is public.
describe("20-image tweet (FxTwitter v2 fixture)", () => {
    const tweet = parseFxStatusResponse(fixture)!;
    const photos = tweet.media.filter((m) => m.kind === "photo");

    it("keeps all 20 photos, none dropped by the cap", () => {
        expect(MAX_TWEET_MEDIA).toBe(20);
        expect(tweet.media).toHaveLength(20);
        expect(photos).toHaveLength(20);
    });

    it("has no duplicate photo URLs", () => {
        expect(new Set(photos.map((p) => p.url)).size).toBe(20);
    });

    it("gives every photo real dimensions, so no 0x0 box", () => {
        for (const p of photos) {
            expect(p.width).toBeGreaterThan(0);
            expect(p.height).toBeGreaterThan(0);
            expect(
                reservedMediaBox(p.width, p.height, 512, 512),
            ).not.toBeNull();
        }
    });

    it("uses a medium thumb per photo and keeps the original for the viewer", () => {
        for (const p of photos) {
            expect(tweetPhotoThumb(p.url)).toMatch(/[?&]name=medium$/);
            expect(p.url).toMatch(/[?&]name=orig$/);
        }
    });

    it("pages every index in both directions, with matching labels", () => {
        const n = photos.length;
        for (let i = 0; i < n; i++) {
            const nav = galleryNav(n, i);
            expect(nav.prevIndex).toBe(i > 0 ? i - 1 : null);
            expect(nav.nextIndex).toBe(i < n - 1 ? i + 1 : null);
            expect(galleryPositionLabel(n, i)).toBe(`${i + 1} of 20`);
        }
        // Walking forward from the first photo reaches the last one.
        let at = 0;
        let steps = 0;
        while (galleryNav(n, at).nextIndex !== null) {
            at = galleryNav(n, at).nextIndex!;
            steps++;
        }
        expect(at).toBe(n - 1);
        expect(steps).toBe(n - 1);
    });
});
