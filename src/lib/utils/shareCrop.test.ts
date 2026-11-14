import { describe, it, expect } from "vitest";
import { alignedShareRect, shareEncoderSteps } from "./shareCrop";

describe("alignedShareRect", () => {
    it("leaves a frame that already fits alone", () => {
        expect(
            alignedShareRect({ x: 0, y: 0, width: 1920, height: 1080 }),
        ).toBeNull();
    });
    it("trims a tab so its half-size layer is even too", () => {
        // 1920x926 halves to 960x463, which the GPU HEVC encoder refuses.
        expect(
            alignedShareRect({ x: 0, y: 0, width: 1920, height: 926 }),
        ).toEqual({ x: 0, y: 0, width: 1920, height: 924 });
    });
    it("trims at most 3 pixels each way, keeping the origin", () => {
        expect(
            alignedShareRect({ x: 2, y: 4, width: 1903, height: 969 }),
        ).toEqual({ x: 2, y: 4, width: 1900, height: 968 });
    });
    it("won't trim a frame down to nothing", () => {
        expect(
            alignedShareRect({ x: 0, y: 0, width: 3, height: 3 }),
        ).toBeNull();
    });
});

describe("shareEncoderSteps", () => {
    const base = {
        ranked: ["av1", "h265", "vp9", "h264", "vp8"],
        hardware: ["h265", "h264"],
        software: ["h264", "vp8"],
        allowWithoutTrim: () => false,
    };
    it("tries every GPU codec at each trim, then software once", () => {
        expect(
            shareEncoderSteps({ ...base, first: "h265", canTrim: true }),
        ).toEqual([
            { codec: "h265", align: 4 },
            { codec: "h265", align: 16 },
            { codec: "h264", align: 4 },
            { codec: "h264", align: 16 },
            { codec: "vp8", align: 4 },
        ]);
    });
    it("starts from a software pick the user made", () => {
        expect(
            shareEncoderSteps({ ...base, first: "vp8", canTrim: true }).map(
                (s) => s.codec,
            ),
        ).toEqual(["vp8", "h265", "h265", "h264", "h264"]);
    });
    it("without trimming, skips GPU codecs that aren't safe untrimmed", () => {
        expect(
            shareEncoderSteps({
                ...base,
                first: "h265",
                canTrim: false,
                allowWithoutTrim: (c) => c === "h264",
            }),
        ).toEqual([
            { codec: "h264", align: null },
            { codec: "vp8", align: null },
        ]);
    });
});
