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
