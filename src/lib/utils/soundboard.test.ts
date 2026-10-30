import { describe, expect, it } from "vitest";
import {
    MAX_SOUND_BYTES,
    MAX_SOUNDS_PER_SENDER,
    MIN_SOUND_INTERVAL_MS,
    createSenderLimiter,
    decodeSoundboardMessage,
    encodeSoundboardMessage,
    isMp4Audio,
    isValidSoundName,
    soundFileProblem,
    soundGain,
    soundsFromContent,
    uniqueSoundName,
    withSound,
    withoutSound,
} from "./soundboard";

describe("soundsFromContent", () => {
    it("keeps mxc entries, sorted, and drops the rest", () => {
        const sounds = soundsFromContent({
            sounds: {
                b: { url: "mxc://s/b", info: { duration: 2, junk: 1 } },
                a: { url: "mxc://s/a" },
                bad: { url: "https://evil/x" },
                none: {},
            },
        });
        expect(sounds.map((s) => s.name)).toEqual(["a", "b"]);
        expect(sounds[1].info).toEqual({ duration: 2 });
    });

    it("tolerates missing or malformed content", () => {
        expect(soundsFromContent(undefined)).toEqual([]);
        expect(soundsFromContent({ sounds: [] as never })).toEqual([]);
    });
});

describe("withSound / withoutSound", () => {
    it("adds, names the pack once, and removes", () => {
        const a = withSound(
            { extra: 1 },
            { name: "boom", mxcUrl: "mxc://s/1" },
            "My Sounds",
        );
        expect(a.extra).toBe(1);
        expect(a.pack?.display_name).toBe("My Sounds");
        const b = withSound(a, { name: "pop", mxcUrl: "mxc://s/2" }, "Other");
        expect(b.pack?.display_name).toBe("My Sounds");
        expect(Object.keys(b.sounds ?? {})).toEqual(["boom", "pop"]);
        expect(Object.keys(withoutSound(b, "boom").sounds ?? {})).toEqual([
            "pop",
        ]);
    });
});

describe("names and files", () => {
    it("validates names", () => {
        expect(isValidSoundName("air horn")).toBe(true);
        expect(isValidSoundName(":bruh:")).toBe(true);
        expect(isValidSoundName("")).toBe(false);
        expect(isValidSoundName("a/b")).toBe(false);
        expect(isValidSoundName("x".repeat(49))).toBe(false);
    });

    it("finds a free name", () => {
        expect(uniqueSoundName(new Set(["a", "a_2"]), "a")).toBe("a_3");
        expect(uniqueSoundName(new Set(), "a")).toBe("a");
    });

    it("rejects non-audio and oversize files", () => {
        expect(soundFileProblem({ type: "image/png", size: 1 })).toBe(
            "notAudio",
        );
        expect(
            soundFileProblem({ type: "audio/mpeg", size: MAX_SOUND_BYTES + 1 }),
        ).toBe("tooBig");
        expect(soundFileProblem({ type: "audio/ogg", size: 10 })).toBeNull();
    });
});

describe("data-channel message", () => {
    it("round-trips", () => {
        const bytes = encodeSoundboardMessage({
            mxcUrl: "mxc://s/1",
            name: "boom",
        });
        expect(decodeSoundboardMessage(bytes)).toEqual({
            mxcUrl: "mxc://s/1",
            name: "boom",
        });
    });

    it("rejects anything that is not an mxc reference", () => {
        const enc = (o: unknown) => new TextEncoder().encode(JSON.stringify(o));
        expect(
            decodeSoundboardMessage(enc({ v: 1, url: "https://evil/x" })),
        ).toBeNull();
        expect(
            decodeSoundboardMessage(enc({ v: 2, url: "mxc://s/1" })),
        ).toBeNull();
        expect(
            decodeSoundboardMessage(new TextEncoder().encode("nope")),
        ).toBeNull();
        expect(decodeSoundboardMessage(new Uint8Array(2000))).toBeNull();
    });
});

describe("createSenderLimiter", () => {
    it("throttles bursts and caps concurrency per sender", () => {
        const l = createSenderLimiter();
        expect(l.allow("@a", 0)).toBe(true);
        expect(l.allow("@a", MIN_SOUND_INTERVAL_MS - 1)).toBe(false);
        expect(l.allow("@b", 1)).toBe(true);
        let t = MIN_SOUND_INTERVAL_MS;
        for (let i = 1; i < MAX_SOUNDS_PER_SENDER; i++) {
            expect(l.allow("@a", t)).toBe(true);
            t += MIN_SOUND_INTERVAL_MS;
        }
        expect(l.allow("@a", t)).toBe(false);
        l.done("@a");
        expect(l.allow("@a", t + MIN_SOUND_INTERVAL_MS)).toBe(true);
    });
});

describe("soundGain", () => {
    it("scales master by level and honors mute", () => {
        expect(soundGain(0.5, 2, false)).toBe(1);
        expect(soundGain(1, 2, true)).toBe(0);
        expect(soundGain(1, 99, false)).toBe(5);
        expect(soundGain(1, NaN, false)).toBe(1);
        expect(soundGain(1, undefined, false)).toBe(1);
    });
});

describe("isMp4Audio", () => {
    it("spots m4a by type or by name", () => {
        expect(isMp4Audio({ type: "audio/mp4", name: "a" })).toBe(true);
        expect(isMp4Audio({ type: "audio/x-m4a", name: "a" })).toBe(true);
        expect(isMp4Audio({ type: "audio/aac", name: "clip.M4A" })).toBe(true);
        expect(isMp4Audio({ type: "audio/mpeg", name: "a.mp3" })).toBe(false);
        expect(isMp4Audio({ type: "video/mp4", name: "a.mp4" })).toBe(false);
    });
});
