import { describe, it, expect } from "vitest";
import { planMicProcessing, normalizeAttenuationDb } from "./micProcessing";
import {
    normalizeNoiseSuppressionMode,
    effectiveNoiseSuppression,
} from "./noiseSuppressionMode";

describe("normalizeNoiseSuppressionMode", () => {
    it("keeps a stored mode", () => {
        expect(
            normalizeNoiseSuppressionMode("plugin:dpdfnet/dpdfnet", false),
        ).toBe("plugin:dpdfnet/dpdfnet");
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
        expect(effectiveNoiseSuppression("plugin:dpdfnet/dpdfnet", false)).toBe(
            "browser",
        );
        expect(effectiveNoiseSuppression("plugin:dpdfnet/dpdfnet", true)).toBe(
            "plugin:dpdfnet/dpdfnet",
        );
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
            chain: {
                denoise: "deepfilter",
                level: "agc2",
                pauseGate: false,
                attenuationDb: 25,
            },
        });
        expect(
            planMicProcessing("plugin:dpdfnet/dpdfnet", "zam", true),
        ).toEqual({
            noiseSuppression: false,
            autoGainControl: false,
            chain: {
                denoise: "plugin:dpdfnet/dpdfnet",
                level: "agc2",
                pauseGate: false,
                attenuationDb: 25,
            },
        });
    });
    it("can normalize the mic like incoming voices", () => {
        expect(planMicProcessing("deepfilter", "normalize", true)).toEqual({
            noiseSuppression: false,
            autoGainControl: false,
            chain: {
                denoise: "deepfilter",
                level: "normalize",
                pauseGate: false,
                attenuationDb: 25,
            },
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
            chain: {
                denoise: "deepfilter",
                level: null,
                pauseGate: false,
                attenuationDb: 25,
            },
        });
    });
});

describe("mic tuning", () => {
    it("passes the debug tuning into the chain", () => {
        expect(
            planMicProcessing("deepfilter", "off", true, {
                pauseGate: true,
                attenuationDb: 40,
            }).chain,
        ).toEqual({
            denoise: "deepfilter",
            level: null,
            pauseGate: true,
            attenuationDb: 40,
        });
    });
    it("clamps the stored attenuation", () => {
        expect(normalizeAttenuationDb(null)).toBe(25);
        expect(normalizeAttenuationDb("junk")).toBe(25);
        expect(normalizeAttenuationDb("1")).toBe(6);
        expect(normalizeAttenuationDb("500")).toBe(100);
        expect(normalizeAttenuationDb("30")).toBe(30);
    });
});

describe("plugin filter keys", () => {
    it("rejects malformed plugin keys", () => {
        expect(normalizeNoiseSuppressionMode("plugin:", true)).toBe(
            "deepfilter",
        );
        expect(normalizeNoiseSuppressionMode("plugin:a/b/c", true)).toBe(
            "deepfilter",
        );
        expect(normalizeNoiseSuppressionMode("plugin:../x", false)).toBe("off");
        expect(normalizeNoiseSuppressionMode("dpdfnet", true)).toBe(
            "deepfilter",
        );
    });
});
