/**
 * Which noise suppression cleans up the user's own microphone:
 *  - "deepfilter": DeepFilterNet3 ($lib/audio/deepFilter), a neural model.
 *  - "browser": the browser's getUserMedia `noiseSuppression` (WebRTC's
 *    classic suppressor in Chromium; weak against anything but steady hum).
 *  - "off": neither.
 */
export type NoiseSuppressionMode = "deepfilter" | "browser" | "off";

/** Stored value, else the legacy `noiseSuppression` boolean: on maps to
 *  DeepFilterNet3, off stays off. */
export function normalizeNoiseSuppressionMode(
    stored: string | null,
    legacyNoiseSuppression: boolean,
): NoiseSuppressionMode {
    if (stored === "deepfilter" || stored === "browser" || stored === "off")
        return stored;
    return legacyNoiseSuppression ? "deepfilter" : "off";
}

/** The mode actually used: DeepFilterNet3 where the browser can't run it
 *  (no AudioWorklet or WASM SIMD) falls back to the browser's suppressor
 *  rather than to nothing. */
export function effectiveNoiseSuppression(
    mode: NoiseSuppressionMode,
    deepFilterSupported: boolean,
): NoiseSuppressionMode {
    return mode === "deepfilter" && !deepFilterSupported ? "browser" : mode;
}

/** The getUserMedia `noiseSuppression` constraint. Off under DeepFilterNet3:
 *  two suppressors in a row smear the voice. */
export function browserNoiseSuppressionFor(
    effective: NoiseSuppressionMode,
): boolean {
    return effective === "browser";
}
