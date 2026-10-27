import { describe, expect, it } from "vitest";
import {
    DEFAULT_PARTICIPANT_AUDIO,
    effectiveVolume,
    parseAudioMap,
    serializeAudioMap,
    withShareVolume,
} from "./participantAudio";
import { bitrateCeiling } from "./screenShareBitrate";
import {
    isBlockedMime,
    isDecodeStall,
    planCodecs,
    withoutBlocked,
} from "./videoCodecs";

describe("share volume", () => {
    it("is separate from the voice level", () => {
        const p = withShareVolume(DEFAULT_PARTICIPANT_AUDIO, 2);
        expect(effectiveVolume(1, p, "voice")).toBe(1);
        expect(effectiveVolume(1, p, "share")).toBe(2);
    });

    it("local mute silences both", () => {
        const p = { ...DEFAULT_PARTICIPANT_AUDIO, muted: true };
        expect(effectiveVolume(1, p, "share")).toBe(0);
    });

    it("round-trips and drops the default", () => {
        const map = new Map([
            ["@a:x", withShareVolume(DEFAULT_PARTICIPANT_AUDIO, 0.5)],
            ["@b:x", DEFAULT_PARTICIPANT_AUDIO],
        ]);
        const back = parseAudioMap(serializeAudioMap(map));
        expect(back.get("@a:x")?.shareVolume).toBe(0.5);
        expect(back.has("@b:x")).toBe(false);
    });
});

describe("bitrateCeiling override", () => {
    it("holds back 10% of a measurement but not of a typed figure", () => {
        expect(bitrateCeiling(10_000_000)).toBe(9_000_000);
        expect(bitrateCeiling(10_000_000, true)).toBe(10_000_000);
    });
});

describe("blocked decode codecs", () => {
    it("never removes the mandatory codecs", () => {
        expect(
            withoutBlocked(["av1", "h265", "h264", "vp8"], ["av1", "h264"]),
        ).toEqual(["h265", "h264", "vp8"]);
    });

    it("matches mime types, leaving RTX alone", () => {
        expect(isBlockedMime("video/AV1", ["av1"])).toBe(true);
        expect(isBlockedMime("video/H265", ["av1"])).toBe(false);
        expect(isBlockedMime("video/rtx", ["av1"])).toBe(false);
        expect(isBlockedMime("video/H264", ["h264"])).toBe(false);
    });

    it("flags a stream that delivers data but decodes nothing", () => {
        expect(
            isDecodeStall({ bytes: 200_000, framesDecoded: 0, samples: 2 }),
        ).toBe(true);
        expect(
            isDecodeStall({ bytes: 200_000, framesDecoded: 0, samples: 1 }),
        ).toBe(false);
        expect(
            isDecodeStall({ bytes: 200_000, framesDecoded: 5, samples: 3 }),
        ).toBe(false);
        expect(
            isDecodeStall({ bytes: 100, framesDecoded: 0, samples: 5 }),
        ).toBe(false);
    });
});

describe("planCodecs in encrypted calls", () => {
    const sendable = ["av1", "h264", "vp8"] as const;
    const peers = [["av1", "h264", "vp8"]] as const;

    it("never sends AV1, which end-to-end encryption can't carry", () => {
        const plan = planCodecs("av1", sendable, peers, true);
        expect(plan.available).not.toContain("av1");
        expect(plan.current).toBe("h264");
    });

    it("still sends AV1 unencrypted", () => {
        expect(planCodecs("av1", sendable, peers, false).current).toBe("av1");
    });
});
