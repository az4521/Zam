import { describe, it, expect } from "vitest";
import {
    backupCodecFor,
    codecsEveryoneDecodes,
    codecsFromMimeTypes,
    effectiveCodec,
    encodeDecodeAttribute,
    parseDecodeAttribute,
} from "./videoCodecs";

describe("codecsFromMimeTypes", () => {
    it("keeps the video codecs, best first, once each", () => {
        expect(
            codecsFromMimeTypes([
                "video/VP8",
                "video/rtx",
                "video/H264",
                "video/H264",
                "video/red",
                "video/ulpfec",
                "video/AV1",
                "video/H265",
                "video/VP9",
            ]),
        ).toEqual(["av1", "h265", "vp9", "h264", "vp8"]);
    });

    it("reads HEVC and ignores case", () => {
        expect(codecsFromMimeTypes(["VIDEO/hevc", "video/vp8"])).toEqual([
            "h265",
            "vp8",
        ]);
    });
});

describe("codecsEveryoneDecodes", () => {
    const sendable = ["av1", "h265", "vp9", "h264", "vp8"] as const;

    it("offers everything we send when nobody said what they decode", () => {
        expect(codecsEveryoneDecodes(sendable, [])).toEqual([...sendable]);
    });

    it("drops what any announced participant can't decode", () => {
        expect(
            codecsEveryoneDecodes(sendable, [
                ["av1", "vp9", "h264", "vp8"],
                ["h265", "vp9", "h264", "vp8"],
            ]),
        ).toEqual(["vp9", "h264", "vp8"]);
    });

    it("always keeps the mandatory codecs", () => {
        expect(codecsEveryoneDecodes(sendable, [["av1"]])).toEqual([
            "av1",
            "h264",
            "vp8",
        ]);
    });

    it("never offers what we can't send", () => {
        expect(
            codecsEveryoneDecodes(["vp9", "h264", "vp8"], [["h265", "vp9"]]),
        ).toEqual(["vp9", "h264", "vp8"]);
    });
});

describe("backupCodecFor", () => {
    it("has none for the mandatory codecs", () => {
        expect(backupCodecFor("h264", ["h264", "vp8"])).toBeNull();
        expect(backupCodecFor("vp8", ["h264", "vp8"])).toBeNull();
    });

    it("backs anything else with H.264, or VP8 without H.264", () => {
        expect(backupCodecFor("h265", ["h265", "h264", "vp8"])).toBe("h264");
        expect(backupCodecFor("av1", ["av1", "vp8"])).toBe("vp8");
    });
});

describe("effectiveCodec", () => {
    it("sends the pick when it can, else H.264, else VP8", () => {
        expect(effectiveCodec("vp9", ["vp9", "h264", "vp8"])).toBe("vp9");
        expect(effectiveCodec("h265", ["vp9", "h264", "vp8"])).toBe("h264");
        expect(effectiveCodec("h265", ["vp9", "vp8"])).toBe("vp8");
        expect(effectiveCodec("av1", [])).toBe("h264");
    });
});

describe("the decode attribute", () => {
    it("round-trips", () => {
        expect(
            parseDecodeAttribute(
                encodeDecodeAttribute(["h265", "h264", "vp8"]),
            ),
        ).toEqual(["h265", "h264", "vp8"]);
    });

    it("drops unknown names and is null when not set", () => {
        expect(parseDecodeAttribute("vp8, theora,h264,")).toEqual([
            "vp8",
            "h264",
        ]);
        expect(parseDecodeAttribute("")).toEqual([]);
        expect(parseDecodeAttribute(undefined)).toBeNull();
    });
});
