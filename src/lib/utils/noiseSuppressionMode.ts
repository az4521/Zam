/**
 * Which noise suppression cleans up the user's own microphone:
 *  - "deepfilter": DeepFilterNet3 ($lib/audio/deepFilter), a neural model.
 *  - "plugin:<pluginId>/<filterId>": a plugin's filter
 *    ($lib/audio/micFilters); DeepFilterNet3 wherever it can't run.
 *  - "browser": the browser's getUserMedia `noiseSuppression` (WebRTC's
 *    classic suppressor in Chromium; weak against anything but steady hum).
 *  - "off": neither.
 */
import { isPluginFilterKey, type PluginFilterKey } from "$lib/audio/micFilters";

export type NoiseSuppressionMode =
    "deepfilter" | PluginFilterKey | "browser" | "off";

/** Stored value, else the legacy `noiseSuppression` boolean: on maps to
 *  DeepFilterNet3, off stays off. */
export function normalizeNoiseSuppressionMode(
    stored: string | null,
    legacyNoiseSuppression: boolean,
): NoiseSuppressionMode {
    if (
        stored === "deepfilter" ||
        stored === "browser" ||
        stored === "off" ||
        isPluginFilterKey(stored)
    )
        return stored;
    return legacyNoiseSuppression ? "deepfilter" : "off";
}

/** Whether the mode runs a neural model in Zam's chain. */
export function isNeuralNoiseSuppression(mode: NoiseSuppressionMode): boolean {
    return mode === "deepfilter" || isPluginFilterKey(mode);
}

/** The mode actually used: a neural model where the browser can't run one
 *  (no AudioWorklet or WASM SIMD) falls back to the browser's suppressor
 *  rather than to nothing. */
export function effectiveNoiseSuppression(
    mode: NoiseSuppressionMode,
    neuralSupported: boolean,
): NoiseSuppressionMode {
    return isNeuralNoiseSuppression(mode) && !neuralSupported
        ? "browser"
        : mode;
}

/** The getUserMedia `noiseSuppression` constraint. Off under Zam's models:
 *  two suppressors in a row smear the voice. */
export function browserNoiseSuppressionFor(
    effective: NoiseSuppressionMode,
): boolean {
    return effective === "browser";
}
