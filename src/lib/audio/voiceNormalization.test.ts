import { describe, it, expect } from "vitest";
import {
    rmsDb,
    nextSpeechLevel,
    normalizationGain,
    gainTimeConstant,
    NORMALIZE_TARGET_DB,
    NORMALIZE_GATE_DB,
    NORMALIZE_MIN_GAIN,
    NORMALIZE_MAX_GAIN,
    createSpeechGate,
    speechWindow,
    createNormalizer,
    normalizerStep,
    NORMALIZE_MAX_NOISE_DB,
} from "./voiceNormalization";

describe("rmsDb", () => {
    it("measures a full-scale square wave at 0 dBFS", () => {
        expect(rmsDb([1, -1, 1, -1])).toBeCloseTo(0);
    });
    it("measures half amplitude at about -6 dBFS", () => {
        expect(rmsDb([0.5, -0.5, 0.5, -0.5])).toBeCloseTo(-6.02, 1);
    });
    it("is -Infinity for silence and empty windows", () => {
        expect(rmsDb([0, 0, 0])).toBe(-Infinity);
        expect(rmsDb([])).toBe(-Infinity);
    });
});

describe("nextSpeechLevel", () => {
    it("seeds from the first speech window", () => {
        expect(nextSpeechLevel(null, -30)).toBe(-30);
    });
    it("ignores pauses and noise below the gate", () => {
        expect(nextSpeechLevel(null, NORMALIZE_GATE_DB - 1)).toBe(null);
        expect(nextSpeechLevel(-25, -Infinity)).toBe(-25);
        expect(nextSpeechLevel(-25, NORMALIZE_GATE_DB - 10)).toBe(-25);
    });
    it("follows a louder voice faster than a quieter one", () => {
        const up = nextSpeechLevel(-30, -20)! - -30;
        const down = -30 - nextSpeechLevel(-30, -40)!;
        expect(up).toBeGreaterThan(down);
    });
    it("moves part of the way towards a new window", () => {
        const next = nextSpeechLevel(-30, -10)!;
        expect(next).toBeGreaterThan(-30);
        expect(next).toBeLessThan(-10);
    });
});

describe("normalizationGain", () => {
    it("holds when nothing has been heard yet", () => {
        expect(normalizationGain(null)).toBe(null);
    });
    it("is unity at the target level", () => {
        expect(normalizationGain(NORMALIZE_TARGET_DB)).toBeCloseTo(1);
    });
    it("turns quiet speakers up and loud ones down", () => {
        expect(normalizationGain(NORMALIZE_TARGET_DB - 6)).toBeCloseTo(2, 1);
        expect(normalizationGain(NORMALIZE_TARGET_DB + 6)).toBeCloseTo(0.5, 1);
    });
    it("clamps to the allowed range", () => {
        expect(normalizationGain(-80)).toBe(NORMALIZE_MAX_GAIN);
        expect(normalizationGain(0)).toBe(NORMALIZE_MIN_GAIN);
    });
});

describe("gainTimeConstant", () => {
    it("turns down faster than it turns up", () => {
        expect(gainTimeConstant(2, 1)).toBeLessThan(gainTimeConstant(1, 2));
    });
});

describe("speechWindow", () => {
    it("never counts steady room noise as speech", () => {
        const gate = createSpeechGate();
        for (let i = 0; i < 2000; i++)
            expect(speechWindow(gate, -48 + (i % 3), 0.1)).toBe(false);
    });
    it("counts speech well above the floor", () => {
        const gate = createSpeechGate();
        for (let i = 0; i < 50; i++) speechWindow(gate, -50, 0.1);
        expect(speechWindow(gate, -30, 0.1)).toBe(true);
    });
    it("still respects the absolute gate", () => {
        const gate = createSpeechGate();
        for (let i = 0; i < 50; i++) speechWindow(gate, -90, 0.1);
        expect(speechWindow(gate, -60, 0.1)).toBe(false);
    });
    it("keeps a quiet speaker's gain through a long noisy pause", () => {
        // 1 s of speech at -35, then 10 s of their room noise at -50 (above
        // the -55 level gate): only speech may move the level.
        const gate = createSpeechGate();
        let level: number | null = null;
        const feed = (db: number) => {
            if (speechWindow(gate, db, 0.1)) level = nextSpeechLevel(level, db);
        };
        for (let i = 0; i < 30; i++) feed(-52); // room before they speak
        for (let i = 0; i < 10; i++) feed(-35);
        const speaking = normalizationGain(level)!;
        for (let i = 0; i < 100; i++) feed(-50);
        expect(normalizationGain(level)).toBeCloseTo(speaking);
        expect(20 * Math.log10(speaking)).toBeCloseTo(NORMALIZE_TARGET_DB + 35);
    });
});

describe("normalizerStep noise cap", () => {
    it("never boosts a quiet voice so far that its noise floor is audible", () => {
        const state = createNormalizer();
        // Room noise at -60, a quiet speaker at -40: unrestricted this asks
        // for +20 dB (clamped to +18), lifting the hiss to -42.
        for (let i = 0; i < 20; i++) normalizerStep(state, -60, 0.1, 1);
        let step = null;
        for (let i = 0; i < 20; i++) step = normalizerStep(state, -40, 0.1, 1);
        const outNoise = state.gate.floor! + 20 * Math.log10(step!.gain);
        expect(outNoise).toBeLessThanOrEqual(NORMALIZE_MAX_NOISE_DB + 0.01);
    });
    it("still turns down loud voices", () => {
        const state = createNormalizer();
        for (let i = 0; i < 20; i++) normalizerStep(state, -70, 0.1, 1);
        let step = null;
        for (let i = 0; i < 20; i++) step = normalizerStep(state, -8, 0.1, 1);
        expect(step!.gain).toBeLessThan(1);
    });
});
