/**
 * Pure loudness maths for incoming-voice normalization: measure a window of
 * samples, smooth the speech level, and turn it into a gain that brings that
 * speaker to a common target. The Web Audio wiring lives in callAudioGraph.
 */

/** Speech level everyone is pulled towards, in dBFS RMS. */
export const NORMALIZE_TARGET_DB = -20;
/** Windows quieter than this are pauses or room noise: they neither move the
 *  level estimate nor the gain, so silence is never pumped up. */
export const NORMALIZE_GATE_DB = -55;
/** Gain range normalization may apply: -12 dB to +18 dB. */
export const NORMALIZE_MIN_GAIN = 0.25;
export const NORMALIZE_MAX_GAIN = 8;
/** Per-window weight of a new measurement in the smoothed level: high when
 *  the voice gets louder, so a sudden shout is caught within a few windows,
 *  low when it gets quieter, so one soft word does not swing the gain up. */
export const NORMALIZE_LEVEL_RISE = 0.6;
export const NORMALIZE_LEVEL_FALL = 0.1;

/** RMS of a window in dBFS; -Infinity for digital silence. */
export function rmsDb(samples: ArrayLike<number>): number {
    if (samples.length === 0) return -Infinity;
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / samples.length);
    return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
}

/** Fold one window's level into the smoothed speech level. Gated windows
 *  leave it unchanged; the first speech window seeds it directly. */
export function nextSpeechLevel(
    previous: number | null,
    windowDb: number,
): number | null {
    if (!Number.isFinite(windowDb) || windowDb < NORMALIZE_GATE_DB)
        return previous;
    if (previous === null) return windowDb;
    const weight =
        windowDb > previous ? NORMALIZE_LEVEL_RISE : NORMALIZE_LEVEL_FALL;
    return previous + weight * (windowDb - previous);
}

/** The gain that brings speech at `levelDb` to the target, clamped. Null
 *  before any speech has been heard: hold whatever gain is in place. */
export function normalizationGain(levelDb: number | null): number | null {
    if (levelDb === null) return null;
    const gain = 10 ** ((NORMALIZE_TARGET_DB - levelDb) / 20);
    return Math.min(NORMALIZE_MAX_GAIN, Math.max(NORMALIZE_MIN_GAIN, gain));
}

/** Time constant (s) for moving from `current` to `target` gain: turning
 *  someone down is quick so a sudden shout does not blast, turning them up
 *  is slow so a brief quiet word does not drag the room noise up with it. */
export function gainTimeConstant(current: number, target: number): number {
    return target < current ? 0.15 : 1.5;
}
