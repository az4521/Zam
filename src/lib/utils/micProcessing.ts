/**
 * What processing the user's own mic gets, from the two settings: which
 * stages Zam's mic chain runs, and which the browser's getUserMedia does.
 */
import type { DenoiseEngine } from "$lib/audio/micChain";
import { isPluginFilterKey } from "$lib/audio/micFilters";
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
    chain: { denoise: DenoiseEngine | null; level: boolean } | null;
}

export function planMicProcessing(
    noise: NoiseSuppressionMode,
    gain: MicGainMode,
    neuralSupported: boolean,
): MicProcessingPlan {
    const ns = effectiveNoiseSuppression(noise, neuralSupported);
    const denoise: DenoiseEngine | null =
        ns === "deepfilter" || isPluginFilterKey(ns) ? ns : null;
    const level = gain === "zam";
    return {
        noiseSuppression: browserNoiseSuppressionFor(ns),
        autoGainControl: browserAgcFor(gain),
        chain: denoise || level ? { denoise, level } : null,
    };
}
