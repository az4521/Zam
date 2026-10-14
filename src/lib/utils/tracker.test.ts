import { describe, it, expect } from "vitest";
import { isTrackerAttachment } from "./tracker";

describe("isTrackerAttachment", () => {
    it("matches tracker extensions, any case", () => {
        for (const name of ["song.mod", "Song.XM", "a.s3m", "b.it", "c.mptm"]) {
            expect(isTrackerAttachment(null, name)).toBe(true);
        }
        expect(isTrackerAttachment("application/octet-stream", "x.umx")).toBe(
            true,
        );
    });

    it("matches tracker mimetypes", () => {
        expect(isTrackerAttachment("audio/x-mod", null)).toBe(true);
        expect(isTrackerAttachment("audio/xm; foo=bar", "")).toBe(true);
        expect(isTrackerAttachment("audio/it", undefined)).toBe(true);
    });

    it("leaves other files alone", () => {
        expect(isTrackerAttachment("audio/mpeg", "song.mp3")).toBe(false);
        expect(isTrackerAttachment(null, "mod")).toBe(false);
        expect(isTrackerAttachment(null, "it.png")).toBe(false);
        // Formats libopenmpt reads whose extensions mostly mean other things.
        expect(isTrackerAttachment(null, "image.ppm")).toBe(false);
        expect(isTrackerAttachment(null, "doom.mus")).toBe(false);
        expect(isTrackerAttachment(null, "boom.sfx")).toBe(false);
    });
});
