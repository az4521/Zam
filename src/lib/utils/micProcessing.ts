/**
 * What processing the user's own mic gets, from the two settings: which
 * stages Zam's mic chain runs, and which the browser's getUserMedia does.
 */
import type {
    DenoiseEngine,
    MicChainOptions,
    MicLevelStage,
} from "$lib/audio/micChain";
import { isPluginFilterKey } from "$lib/audio/micFilters";
import { browserAgcFor, type MicGainMode } from "./micGainMode";
import {
    browserNoiseSuppressionFor,
    effectiveNoiseSuppression,
    type NoiseSuppressionMode,
} from "./noiseSuppressionMode";

/** DeepFilterNet3's default cap on how much it may take off any part of the
 *  signal, in dB ($lib/audio/deepFilter). 100 is effectively unlimited. */
export const DEFAULT_ATTENUATION_DB = 25;
export const MIN_ATTENUATION_DB = 6;
export const MAX_ATTENUATION_DB = 100;

/** Stored attenuation cap, clamped; the default for nothing or garbage. */
export function normalizeAttenuationDb(stored: string | null): number {
    const n = stored === null ? NaN : Number(stored);
    if (!Number.isFinite(n)) return DEFAULT_ATTENUATION_DB;
    return Math.min(
        MAX_ATTENUATION_DB,
        Math.max(MIN_ATTENUATION_DB, Math.round(n)),
    );
}

/** Debug-screen tuning of the mic chain. */
export interface MicTuning {
    pauseGate: boolean;
    attenuationDb: number;
}

export const DEFAULT_MIC_TUNING: MicTuning = {
    pauseGate: false,
    attenuationDb: DEFAULT_ATTENUATION_DB,
};

export interface MicProcessingPlan {
    /** getUserMedia constraints. */
    noiseSuppression: boolean;
    autoGainControl: boolean;
    /** Zam's mic chain stages, or null when it isn't needed at all. */
    chain: MicChainOptions | null;
}

export function planMicProcessing(
    noise: NoiseSuppressionMode,
    gain: MicGainMode,
    neuralSupported: boolean,
    tuning: MicTuning = DEFAULT_MIC_TUNING,
): MicProcessingPlan {
    const ns = effectiveNoiseSuppression(noise, neuralSupported);
    const denoise: DenoiseEngine | null =
        ns === "fastenhancer" ||
        ns === "rnnoise" ||
        ns === "deepfilter" ||
        isPluginFilterKey(ns)
            ? ns
            : null;
    const level: MicLevelStage =
        gain === "zam" ? "agc2" : gain === "normalize" ? "normalize" : null;
    return {
        noiseSuppression: browserNoiseSuppressionFor(ns),
        autoGainControl: browserAgcFor(gain),
        chain: denoise || level ? { denoise, level, ...tuning } : null,
    };
}
