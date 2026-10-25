import { beforeEach, describe, expect, it } from "vitest";
import {
    rememberLevel,
    rememberedLevel,
    resetRememberedLevelsCache,
} from "./normalizerMemory";
import { createNormalizer, normalizerStep } from "./voiceNormalization";

const DAY = 24 * 60 * 60 * 1000;

describe("normalizerMemory", () => {
    beforeEach(() => {
        localStorage.clear();
        resetRememberedLevelsCache();
    });

    it("remembers a level across a reload", () => {
        rememberLevel("@a:s", createNormalizer({ level: -30, floor: -60 }));
        resetRememberedLevelsCache();
        expect(rememberedLevel("@a:s")).toMatchObject({
            level: -30,
            floor: -60,
        });
    });

    it("ignores a normalizer that has heard no speech", () => {
        rememberLevel("@a:s", createNormalizer());
        expect(rememberedLevel("@a:s")).toBeNull();
    });

    it("throttles writes unless forced", () => {
        const now = 1_000_000;
        rememberLevel(
            "@a:s",
            createNormalizer({ level: -30, floor: null }),
            false,
            now,
        );
        rememberLevel(
            "@a:s",
            createNormalizer({ level: -20, floor: null }),
            false,
            now + 1000,
        );
        expect(rememberedLevel("@a:s", now + 1000)?.level).toBe(-30);
        rememberLevel(
            "@a:s",
            createNormalizer({ level: -20, floor: null }),
            true,
            now + 1000,
        );
        expect(rememberedLevel("@a:s", now + 1000)?.level).toBe(-20);
    });

    it("forgets levels older than a month", () => {
        rememberLevel(
            "@a:s",
            createNormalizer({ level: -30, floor: null }),
            true,
            0,
        );
        expect(rememberedLevel("@a:s", 29 * DAY)).not.toBeNull();
        expect(rememberedLevel("@a:s", 31 * DAY)).toBeNull();
    });

    it("survives garbage in storage", () => {
        localStorage.setItem("zam.voiceLevels.v1", "{not json");
        expect(rememberedLevel("@a:s")).toBeNull();
    });
});

describe("seeded normalizer", () => {
    it("applies the remembered gain from its first window", () => {
        // A quiet voice remembered at -32 dBFS: the very first speech window
        // already asks for the gain that voice needs, not unity.
        const state = createNormalizer({ level: -32, floor: -65 });
        const step = normalizerStep(state, -32, 0.1, 1);
        expect(step?.gain).toBeCloseTo(10 ** (12 / 20), 2);
    });
});
