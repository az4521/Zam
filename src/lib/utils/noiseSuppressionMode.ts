/**
 * Which noise suppression cleans up the user's own microphone:
 *  - "fastenhancer": FastEnhancer ($lib/audio/fastenhancer), a small neural
 *    model that ships with the app and holds a voice at one level. The
 *    default.
 *  - "fastenhancer-tiny": FastEnhancer's Tiny model, about a third of the
 *    CPU; between it and RNNoise.
 *  - "rnnoise": RNNoise ($lib/audio/rnnoise), older and smaller, the same in
 *    that respect; runs where WebAssembly SIMD is missing.
 *  - "deepfilter": DeepFilterNet3 ($lib/audio/deepFilter), a neural model.
 *  - "plugin:<pluginId>/<filterId>": a plugin's filter
 *    ($lib/audio/micFilters); DeepFilterNet3 wherever it can't run.
 *  - "browser": the browser's getUserMedia `noiseSuppression` (WebRTC's
 *    classic suppressor in Chromium; weak against anything but steady hum).
 *  - "off": neither.
 */
import { isPluginFilterKey, type PluginFilterKey } from "$lib/audio/micFilters";
import { rnnoiseSupported } from "$lib/audio/rnnoise";

export type NoiseSuppressionMode =
    | "fastenhancer"
    | "fastenhancer-tiny"
    | "rnnoise"
    | "deepfilter"
    | PluginFilterKey
    | "browser"
    | "off";

/** Stored value, else the legacy `noiseSuppression` boolean: on maps to
 *  FastEnhancer, off stays off. */
export function normalizeNoiseSuppressionMode(
    stored: string | null,
    legacyNoiseSuppression: boolean,
): NoiseSuppressionMode {
    if (
        stored === "fastenhancer" ||
        stored === "fastenhancer-tiny" ||
        stored === "rnnoise" ||
        stored === "deepfilter" ||
        stored === "browser" ||
        stored === "off" ||
        isPluginFilterKey(stored)
    )
        return stored;
    return legacyNoiseSuppression ? "fastenhancer" : "off";
}

/** Whether the mode runs a neural model in Zam's chain. */
export function isNeuralNoiseSuppression(mode: NoiseSuppressionMode): boolean {
    return (
        mode === "fastenhancer" ||
        mode === "fastenhancer-tiny" ||
        mode === "rnnoise" ||
        mode === "deepfilter" ||
        isPluginFilterKey(mode)
    );
}

/** Whether the mode can run on either the CPU or the GPU (the GPU
 *  acceleration setting applies to it). */
export function noiseSuppressionHasGpu(mode: NoiseSuppressionMode): boolean {
    return mode === "fastenhancer" || mode === "fastenhancer-tiny";
}

/** GPU acceleration for a mode the user hasn't set it for. On where the GPU
 *  is cheaper: FastEnhancer (about 7% of a core against 16% on a 5800X), not
 *  Tiny, which costs about the same on the CPU as the GPU's fixed overhead. */
export function noiseSuppressionGpuDefault(
    mode: NoiseSuppressionMode,
): boolean {
    return mode === "fastenhancer";
}

/** The user's GPU acceleration choices, per mode. */
export type NoiseSuppressionGpuChoices = Record<string, boolean>;

/** Stored choices (a JSON object of booleans); none for anything else. */
export function normalizeNoiseSuppressionGpu(
    stored: string | null,
): NoiseSuppressionGpuChoices {
    try {
        const v: unknown = stored === null ? null : JSON.parse(stored);
        if (!v || typeof v !== "object" || Array.isArray(v)) return {};
        return Object.fromEntries(
            Object.entries(v).filter(([, b]) => typeof b === "boolean"),
        ) as NoiseSuppressionGpuChoices;
    } catch {
        return {};
    }
}

/** Whether `mode` runs on the GPU: the user's choice, else its default. */
export function noiseSuppressionUsesGpu(
    mode: NoiseSuppressionMode,
    choices: NoiseSuppressionGpuChoices,
): boolean {
    if (!noiseSuppressionHasGpu(mode)) return false;
    return choices[mode] ?? noiseSuppressionGpuDefault(mode);
}

/** The mode actually used: a neural model where the browser can't run one
 *  (no AudioWorklet or WASM SIMD) falls back to RNNoise, which needs no SIMD,
 *  and where even that can't run to the browser's suppressor, rather than to
 *  nothing. */
export function effectiveNoiseSuppression(
    mode: NoiseSuppressionMode,
    neuralSupported: boolean,
): NoiseSuppressionMode {
    if (!isNeuralNoiseSuppression(mode)) return mode;
    if (mode === "rnnoise") return rnnoiseSupported() ? mode : "browser";
    if (neuralSupported) return mode;
    return rnnoiseSupported() &&
        (mode === "fastenhancer" || mode === "fastenhancer-tiny")
        ? "rnnoise"
        : "browser";
}

/** The getUserMedia `noiseSuppression` constraint. Off under Zam's models:
 *  two suppressors in a row smear the voice. */
export function browserNoiseSuppressionFor(
    effective: NoiseSuppressionMode,
): boolean {
    return effective === "browser";
}
