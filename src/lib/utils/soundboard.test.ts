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
    soundNameFromText,
    soundsFromContent,
    uniqueSoundName,
    withSound,
    withoutSound,
} from "./soundboard";

describe("soundsFromContent", () => {
    it("keeps mxc entries, sorted, and drops the rest", () => {
        const sounds = soundsFromContent({
            sounds: {
                b: { url: "mxc://s/b", info: { duration: 2400, junk: 1 } },
                a: { url: "mxc://s/a", body: "An A" },
                bad: { url: "https://evil/x" },
                none: {},
            },
        });
        expect(sounds.map((s) => s.name)).toEqual(["a", "b"]);
        expect(sounds[1].info).toEqual({ duration: 2400 });
        expect(sounds[0].body).toBe("An A");
    });

    it("reads packs written before the MSC revision", () => {
        // Seconds, rounded to hundredths; names with spaces and dots.
        const sounds = soundsFromContent({
            pack: { display_name: "Old" },
            sounds: {
                "air horn": { url: "mxc://s/1", info: { duration: 2.4 } },
                "boom.wav": { url: "mxc://s/2", info: { duration: 15 } },
                long: { url: "mxc://s/3", info: { duration: 16 } },
            },
        });
        expect(sounds.map((s) => [s.name, s.info?.duration])).toEqual([
            ["air horn", 2400],
            ["boom.wav", 15000],
            // A whole number over the seconds cap is already milliseconds.
            ["long", 16],
        ]);
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

    it("writes the body, and keeps older entries while moving them to ms", () => {
        const old = {
            pack: { display_name: "Old", avatar_url: "mxc://s/av" },
            sounds: {
                "air horn": {
                    url: "mxc://s/1",
                    info: { duration: 2.4, mimetype: "audio/ogg" },
                    extra: true,
                },
            },
        };
        const next = withSound(
            old,
            { name: "pop", mxcUrl: "mxc://s/2", body: "A pop" },
            "x",
        );
        expect(next.pack).toEqual({
            display_name: "Old",
            avatar_url: "mxc://s/av",
        });
        expect(next.sounds?.["air horn"]).toEqual({
            url: "mxc://s/1",
            info: { duration: 2400, mimetype: "audio/ogg" },
            extra: true,
        });
        expect(next.sounds?.pop).toEqual({ url: "mxc://s/2", body: "A pop" });
        // Reading it back gives every sound, the old one unchanged in name.
        expect(soundsFromContent(next).map((s) => s.name)).toEqual([
            "air horn",
            "pop",
        ]);
        expect(withoutSound(old, "nothing").sounds?.["air horn"].info).toEqual({
            duration: 2400,
            mimetype: "audio/ogg",
        });
    });
});

describe("names and files", () => {
    it("validates names against the shortcode grammar", () => {
        expect(isValidSoundName("air_horn-2")).toBe(true);
        expect(isValidSoundName(":bruh:")).toBe(true);
        expect(isValidSoundName("x".repeat(100))).toBe(true);
        expect(isValidSoundName("air horn")).toBe(false);
        expect(isValidSoundName("boom.wav")).toBe(false);
        expect(isValidSoundName("")).toBe(false);
        expect(isValidSoundName("a/b")).toBe(false);
        expect(isValidSoundName("é")).toBe(false);
        expect(isValidSoundName("x".repeat(101))).toBe(false);
    });

    it("makes a shortcode from free text", () => {
        expect(soundNameFromText("  Air Horn (loud)!  ")).toBe("Air_Horn_loud");
        expect(soundNameFromText(":bruh:")).toBe("bruh");
        expect(soundNameFromText("ブイ")).toBe("");
        expect(soundNameFromText("x".repeat(150))).toHaveLength(100);
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
    const enc = (o: unknown) => new TextEncoder().encode(JSON.stringify(o));

    it("round-trips", () => {
        const bytes = encodeSoundboardMessage({
            mxcUrl: "mxc://s/1",
            shortcode: "boom",
        });
        expect(decodeSoundboardMessage(bytes)).toEqual({
            mxcUrl: "mxc://s/1",
            shortcode: "boom",
        });
    });

    it("still speaks the earlier revision both ways", () => {
        // Zam before 1.49.0 sends {v, url, name} and drops anything without
        // v: 1, so we keep sending those alongside the MSC fields.
        const sent = JSON.parse(
            new TextDecoder().decode(
                encodeSoundboardMessage({
                    mxcUrl: "mxc://s/1",
                    shortcode: "x".repeat(60),
                }),
            ),
        );
        expect(sent).toMatchObject({ url: "mxc://s/1", v: 1 });
        expect(sent.shortcode).toHaveLength(60);
        expect(sent.name).toHaveLength(48);
        expect(
            decodeSoundboardMessage(
                enc({ v: 1, url: "mxc://s/1", name: "air horn" }),
            ),
        ).toEqual({ mxcUrl: "mxc://s/1", shortcode: "air horn" });
    });

    it("ignores unknown keys, v included", () => {
        expect(
            decodeSoundboardMessage(
                enc({ url: "mxc://s/1", shortcode: "a", v: 2, extra: [] }),
            ),
        ).toEqual({ mxcUrl: "mxc://s/1", shortcode: "a" });
        expect(decodeSoundboardMessage(enc({ url: "mxc://s/1" }))).toEqual({
            mxcUrl: "mxc://s/1",
            shortcode: "",
        });
    });

    it("rejects anything that is not an mxc reference", () => {
        expect(
            decodeSoundboardMessage(enc({ url: "https://evil/x" })),
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
