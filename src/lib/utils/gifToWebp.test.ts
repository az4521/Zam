import { describe, expect, it } from "vitest";
import { gifToAnimatedWebp, shrinkAnimatedImage } from "./gifToWebp";

// No ImageDecoder here: both must hand the original back rather than throw.
describe("without WebCodecs", () => {
    it("keeps the GIF when sending", async () => {
        const gif = new File(["GIF89a"], "a.gif", { type: "image/gif" });
        expect(await gifToAnimatedWebp(gif)).toBe(gif);
    });
    it("leaves a received animation alone", async () => {
        const blob = new Blob(["GIF89a"], { type: "image/gif" });
        expect(
            await shrinkAnimatedImage(blob, "image/gif", () => ({
                w: 1,
                h: 1,
            })),
        ).toBeNull();
    });
    it("ignores types it cannot decode", async () => {
        const blob = new Blob(["x"], { type: "image/jxl" });
        expect(await shrinkAnimatedImage(blob, "image/jxl", () => null)).toBe(
            null,
        );
    });
});
