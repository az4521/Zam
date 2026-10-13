/**
 * What processing the user's own mic gets, from the two settings: which
 * stages Zam's mic chain runs, and which the browser's getUserMedia does.
 */
import { browserAgcFor, type MicGainMode } from "./micGainMode";
import {
    browserNoiseSuppressionFor,
    effectiveNoiseSuppression,
    type NoiseSuppressionMode,
} from "./noiseSuppressionMode";

export interface MicProcessingPlan {
    /** getUserMedia constraints. */
    noiseSuppression: boolean;
    autoGainControl: boolean;
    /** Zam's mic chain stages, or null when it isn't needed at all. */
    chain: { denoise: boolean; level: boolean } | null;
}

export function planMicProcessing(
    noise: NoiseSuppressionMode,
    gain: MicGainMode,
    deepFilterSupported: boolean,
): MicProcessingPlan {
    const ns = effectiveNoiseSuppression(noise, deepFilterSupported);
    const denoise = ns === "deepfilter";
    const level = gain === "zam";
    return {
        noiseSuppression: browserNoiseSuppressionFor(ns),
        autoGainControl: browserAgcFor(gain),
        chain: denoise || level ? { denoise, level } : null,
    };
}
