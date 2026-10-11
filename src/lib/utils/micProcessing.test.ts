import { describe, it, expect } from "vitest";
import { planMicProcessing, sameChain } from "./micProcessing";
import {
    normalizeNoiseSuppressionMode,
    effectiveNoiseSuppression,
} from "./noiseSuppressionMode";

describe("normalizeNoiseSuppressionMode", () => {
    it("keeps a stored mode", () => {
        expect(normalizeNoiseSuppressionMode("browser", true)).toBe("browser");
        expect(normalizeNoiseSuppressionMode("off", true)).toBe("off");
        expect(normalizeNoiseSuppressionMode("deepfilter", false)).toBe(
            "deepfilter",
        );
    });
    it("migrates the legacy boolean: on becomes DeepFilterNet3", () => {
        expect(normalizeNoiseSuppressionMode(null, true)).toBe("deepfilter");
        expect(normalizeNoiseSuppressionMode(null, false)).toBe("off");
        expect(normalizeNoiseSuppressionMode("rnnoise", false)).toBe("off");
    });
});

describe("effectiveNoiseSuppression", () => {
    it("falls back to the browser's suppressor, not to none", () => {
        expect(effectiveNoiseSuppression("deepfilter", false)).toBe("browser");
        expect(effectiveNoiseSuppression("deepfilter", true)).toBe(
            "deepfilter",
        );
        expect(effectiveNoiseSuppression("off", false)).toBe("off");
    });
});

describe("planMicProcessing", () => {
    it("runs both stages in Zam's chain and nothing in the browser", () => {
        expect(planMicProcessing("deepfilter", "zam", true)).toEqual({
            noiseSuppression: false,
            autoGainControl: false,
            chain: { denoise: true, level: true },
        });
    });
    it("leaves everything to the browser when asked", () => {
        expect(planMicProcessing("browser", "browser", true)).toEqual({
            noiseSuppression: true,
            autoGainControl: true,
            chain: null,
        });
    });
    it("uses the browser's suppressor where DeepFilterNet3 can't run", () => {
        expect(planMicProcessing("deepfilter", "off", false)).toEqual({
            noiseSuppression: true,
            autoGainControl: false,
            chain: null,
        });
    });
    it("can mix: DeepFilterNet3 with the browser's AGC", () => {
        expect(planMicProcessing("deepfilter", "browser", true)).toEqual({
            noiseSuppression: false,
            autoGainControl: true,
            chain: { denoise: true, level: false },
        });
    });
});

describe("sameChain", () => {
    it("compares stage by stage", () => {
        const a = { denoise: true, level: false };
        expect(sameChain(a, { denoise: true, level: false })).toBe(true);
        expect(sameChain(a, { denoise: true, level: true })).toBe(false);
        expect(sameChain(null, null)).toBe(true);
        expect(sameChain(a, null)).toBe(false);
    });
});
