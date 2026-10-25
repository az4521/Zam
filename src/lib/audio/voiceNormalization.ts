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

/** One voice's normalization state: its smoothed speech level and the gate
 *  that decides which windows count as speech. */
export interface NormalizerState {
    gate: SpeechGate;
    level: number | null;
}

/** A fresh normalizer, or one resuming a remembered level and noise floor
 *  ($lib/audio/normalizerMemory) so it needn't learn the voice again. */
export function createNormalizer(seed?: {
    level: number;
    floor: number | null;
}): NormalizerState {
    return {
        gate: { floor: seed?.floor ?? null },
        level: seed?.level ?? null,
    };
}

/** Feed one window (`windowS` long, `windowDb` loud) and get the gain to move
 *  towards, with the time constant to move at it. Null while no speech has
 *  been heard: hold the gain in place. Only speech moves the level: a pause
 *  full of room noise would otherwise read as a quiet voice and be turned up
 *  until the noise floor was audible. */
export function normalizerStep(
    state: NormalizerState,
    windowDb: number,
    windowS: number,
    currentGain: number,
): { gain: number; timeConstant: number } | null {
    if (speechWindow(state.gate, windowDb, windowS))
        state.level = nextSpeechLevel(state.level, windowDb);
    const gain = normalizationGain(state.level);
    if (gain === null) return null;
    return { gain, timeConstant: gainTimeConstant(currentGain, gain) };
}

/** A window counts as speech only this far above the noise floor. A fixed
 *  level gate alone isn't enough: room noise, or what noise suppression
 *  leaves of it, easily sits above -55 dBFS, and a level estimate fed by it
 *  drifts down in every pause, so the gain climbs and the noise floor
 *  becomes audible, then the next word comes in far too loud. */
export const SPEECH_ABOVE_FLOOR_DB = 12;
/** Noise floor follower: drops quickly to a quieter room (per window),
 *  creeps up over about this many seconds so speech doesn't drag it up. */
export const NOISE_FLOOR_FALL = 0.3;
export const NOISE_FLOOR_RISE_S = 12;

/** Per-source state for speechWindow. */
export interface SpeechGate {
    floor: number | null;
}

export function createSpeechGate(): SpeechGate {
    return { floor: null };
}

/** Track the noise floor with one window (`windowS` long) and say whether
 *  that window is speech: above `minDb` and SPEECH_ABOVE_FLOOR_DB over the
 *  floor as it stood before this window. */
export function speechWindow(
    gate: SpeechGate,
    windowDb: number,
    windowS: number,
    minDb = NORMALIZE_GATE_DB,
): boolean {
    if (!Number.isFinite(windowDb)) return false;
    const floor = gate.floor;
    gate.floor =
        floor === null
            ? windowDb
            : floor +
              (windowDb < floor
                  ? NOISE_FLOOR_FALL
                  : Math.min(1, windowS / NOISE_FLOOR_RISE_S)) *
                  (windowDb - floor);
    return (
        floor !== null &&
        windowDb >= minDb &&
        windowDb >= floor + SPEECH_ABOVE_FLOOR_DB
    );
}
