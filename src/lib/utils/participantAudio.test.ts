import { describe, it, expect } from "vitest";
import {
    clampVolume,
    clampParticipantVolume,
    needsBoost,
    MAX_PARTICIPANT_VOLUME,
    effectiveVolume,
    withVolume,
    withLocalMute,
    serializeAudioMap,
    parseAudioMap,
    DEFAULT_PARTICIPANT_AUDIO,
    withVideoHidden,
    type ParticipantAudio,
} from "./participantAudio";

describe("clampVolume", () => {
    it("clamps to [0,1]", () => {
        expect(clampVolume(-1)).toBe(0);
        expect(clampVolume(0)).toBe(0);
        expect(clampVolume(0.5)).toBe(0.5);
        expect(clampVolume(1)).toBe(1);
        expect(clampVolume(2)).toBe(1);
    });
    it("falls back to unity for non-finite input", () => {
        expect(clampVolume(NaN)).toBe(1);
        expect(clampVolume(Infinity)).toBe(1);
    });
});

describe("clampParticipantVolume", () => {
    it("allows boosting up to 500%", () => {
        expect(MAX_PARTICIPANT_VOLUME).toBe(5);
        expect(clampParticipantVolume(-1)).toBe(0);
        expect(clampParticipantVolume(2.5)).toBe(2.5);
        expect(clampParticipantVolume(5)).toBe(5);
        expect(clampParticipantVolume(9)).toBe(5);
    });
    it("falls back to unity for non-finite input", () => {
        expect(clampParticipantVolume(NaN)).toBe(1);
        expect(clampParticipantVolume(-Infinity)).toBe(1);
    });
});

describe("needsBoost", () => {
    it("is only needed above unity", () => {
        expect(needsBoost(0)).toBe(false);
        expect(needsBoost(1)).toBe(false);
        expect(needsBoost(1.01)).toBe(true);
    });
});

describe("effectiveVolume", () => {
    it("multiplies master by the per-user level", () => {
        expect(
            effectiveVolume(1, {
                volume: 0.5,
                shareVolume: 1,
                muted: false,
                videoHidden: false,
            }),
        ).toBe(0.5);
        expect(
            effectiveVolume(0.5, {
                volume: 0.5,
                shareVolume: 1,
                muted: false,
                videoHidden: false,
            }),
        ).toBe(0.25);
    });
    it("is silent when locally muted, whatever the slider says", () => {
        expect(
            effectiveVolume(1, {
                volume: 1,
                shareVolume: 1,
                muted: true,
                videoHidden: false,
            }),
        ).toBe(0);
    });
    it("treats an unknown participant as unity", () => {
        expect(effectiveVolume(0.8, undefined)).toBe(0.8);
    });
    it("boosts above unity, capped by a unity master and 500% per user", () => {
        expect(
            effectiveVolume(1, {
                volume: 3,
                shareVolume: 1,
                muted: false,
                videoHidden: false,
            }),
        ).toBe(3);
        expect(
            effectiveVolume(0.5, {
                volume: 4,
                shareVolume: 1,
                muted: false,
                videoHidden: false,
            }),
        ).toBe(2);
        expect(
            effectiveVolume(2, {
                volume: 9,
                shareVolume: 1,
                muted: false,
                videoHidden: false,
            }),
        ).toBe(5);
    });
});

describe("withVolume / withLocalMute", () => {
    it("sets a clamped volume without touching mute", () => {
        expect(
            withVolume(
                { volume: 1, shareVolume: 1, muted: true, videoHidden: false },
                7,
            ),
        ).toEqual({
            volume: 5,
            shareVolume: 1,
            muted: true,
            videoHidden: false,
        });
    });
    it("sets mute without touching the slider", () => {
        expect(
            withLocalMute(
                {
                    volume: 0.3,
                    shareVolume: 1,
                    muted: false,
                    videoHidden: false,
                },
                true,
            ),
        ).toEqual({
            volume: 0.3,
            shareVolume: 1,
            muted: true,
            videoHidden: false,
        });
    });
});

describe("serializeAudioMap / parseAudioMap", () => {
    it("round-trips non-default entries", () => {
        const map = new Map<string, ParticipantAudio>([
            [
                "@a:s",
                {
                    volume: 0.25,
                    shareVolume: 1,
                    muted: false,
                    videoHidden: false,
                },
            ],
            [
                "@b:s",
                { volume: 1, shareVolume: 1, muted: true, videoHidden: false },
            ],
        ]);
        expect(parseAudioMap(serializeAudioMap(map))).toEqual(map);
    });
    it("drops default entries so storage stays small", () => {
        const map = new Map<string, ParticipantAudio>([
            ["@a:s", { ...DEFAULT_PARTICIPANT_AUDIO }],
        ]);
        expect(serializeAudioMap(map)).toBe("{}");
    });
    it("returns an empty map for null or broken JSON", () => {
        expect(parseAudioMap(null).size).toBe(0);
        expect(parseAudioMap("not json").size).toBe(0);
        expect(parseAudioMap("[1,2]").size).toBe(0);
    });
    it("drops junk entries instead of throwing", () => {
        const map = parseAudioMap(
            '{"@a:s":{"v":0.5,"m":false},"@b:s":null,"@c:s":"nope","@d:s":{}}',
        );
        expect([...map.keys()]).toEqual(["@a:s"]);
    });
    it("clamps hostile stored volumes", () => {
        expect(
            parseAudioMap('{"@a:s":{"v":99,"m":false}}').get("@a:s"),
        ).toEqual({
            volume: 5,
            shareVolume: 1,
            muted: false,
            videoHidden: false,
        });
    });
    it("keeps a stored boost", () => {
        const map = new Map<string, ParticipantAudio>([
            [
                "@a:s",
                {
                    volume: 3.5,
                    shareVolume: 1,
                    muted: false,
                    videoHidden: false,
                },
            ],
        ]);
        expect(parseAudioMap(serializeAudioMap(map)).get("@a:s")?.volume).toBe(
            3.5,
        );
    });
});

describe("videoHidden", () => {
    it("defaults to false", () => {
        expect(DEFAULT_PARTICIPANT_AUDIO.videoHidden).toBe(false);
    });
    it("withVideoHidden preserves volume and muted", () => {
        const p: ParticipantAudio = {
            volume: 0.5,
            shareVolume: 1,
            muted: true,
            videoHidden: false,
        };
        expect(withVideoHidden(p, true)).toEqual({
            volume: 0.5,
            shareVolume: 1,
            muted: true,
            videoHidden: true,
        });
    });
    it("serializes a videoHidden-only entry (default volume/mute) instead of dropping it", () => {
        const map = new Map<string, ParticipantAudio>([
            [
                "@a:x",
                { volume: 1, shareVolume: 1, muted: false, videoHidden: true },
            ],
        ]);
        const json = JSON.parse(serializeAudioMap(map));
        expect(json["@a:x"]).toEqual({ v: 1, m: false, h: true });
    });
    it("drops a fully-default entry", () => {
        const map = new Map<string, ParticipantAudio>([
            [
                "@a:x",
                { volume: 1, shareVolume: 1, muted: false, videoHidden: false },
            ],
        ]);
        expect(serializeAudioMap(map)).toBe("{}");
    });
    it("round-trips videoHidden through serialize→parse", () => {
        const map = new Map<string, ParticipantAudio>([
            [
                "@a:x",
                {
                    volume: 0.5,
                    shareVolume: 1,
                    muted: false,
                    videoHidden: true,
                },
            ],
        ]);
        const back = parseAudioMap(serializeAudioMap(map));
        expect(back.get("@a:x")).toEqual({
            volume: 0.5,
            shareVolume: 1,
            muted: false,
            videoHidden: true,
        });
    });
    it("parses legacy {v,m} records with videoHidden=false", () => {
        const back = parseAudioMap(
            JSON.stringify({ "@a:x": { v: 0.5, m: true } }),
        );
        expect(back.get("@a:x")).toEqual({
            volume: 0.5,
            shareVolume: 1,
            muted: true,
            videoHidden: false,
        });
    });
});
