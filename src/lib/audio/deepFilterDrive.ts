/**
 * Input drive for DeepFilterNet3. The model judges speech partly by its
 * absolute level. Measured 2026-10-13 with real (TTS) speech through the
 * worklet: speech at -20 to -30 dBFS passes almost untouched (SDR 24-25 dB),
 * at -40 it starts losing detail (18.5 dB), at -50 it is mangled (2.7 dB, 6 dB
 * of the voice gone) and at -60 it is deleted outright. A mic without the
 * browser's AGC (Zam's leveller runs after the model, so it is off) often sits
 * at -40 to -50, so the model heard the voice as too quiet and the leveller
 * then turned the damage up.
 *
 * The mic chain lifts the model's input into its comfortable range with this
 * gain and takes the same gain off again after the model, so what leaves the
 * chain is as loud as before; only the model sees the louder signal.
 *
 * The drive corrects for how loud the mic is, not for each word or pause. It
 * follows only speech: windows well above the room's noise floor. 1.19.9
 * followed every window above -70 dBFS, so in each pause room noise read as
 * a quiet voice and the drive climbed towards +30 dB, then fell back when
 * speech returned: 87 moves in a simulated 76 s call, heard as loudness
 * pumping, a thin "helium" voice while the model's own normalization caught
 * up with each jump, and muffling from the boosted noise. It also aimed too
 * high: pushing a normal mic (-32 dBFS) louder didn't help the model and
 * slightly hurt it, so the target sits just above where the model starts to
 * struggle and a normal mic is left alone.
 */

/** Speech is lifted to at least this level, in dBFS RMS. */
export const DRIVE_TARGET_DB = -30;
/** Windows quieter than this are never speech. Lower than normalization's
 *  gate: speech at -60 dBFS is exactly what needs lifting. */
export const DRIVE_GATE_DB = -70;
/** Drive only ever boosts, by up to +30 dB; louder input already suits the
 *  model. */
export const DRIVE_MAX_GAIN = 10 ** (30 / 20);
/** DeepFilterNet3's delay through the worklet (1952 samples at 48 kHz,
 *  measured): the gain taken off after the model follows the drive by this
 *  much, so the two cancel while the drive is moving. */
export const DEEP_FILTER_DELAY_S = 1952 / 48000;
/** The drive moves only once it is this far from where it should be. */
export const DRIVE_STEP_DB = 3;
/** How long one move takes. */
export const DRIVE_GLIDE_S = 0.5;

/** The drive that brings input at `levelDb` to the target, between unity and
 *  DRIVE_MAX_GAIN. Null until anything above the gate has been heard. */
export function driveGain(levelDb: number | null): number | null {
    if (levelDb === null) return null;
    const gain = 10 ** ((DRIVE_TARGET_DB - levelDb) / 20);
    return Math.min(DRIVE_MAX_GAIN, Math.max(1, gain));
}

/** The drive to move to from `current`, or null to stay put: only when the
 *  wanted drive is at least DRIVE_STEP_DB away. */
export function nextDrive(
    current: number,
    wanted: number | null,
): number | null {
    if (wanted === null) return null;
    return Math.abs(20 * Math.log10(wanted / current)) >= DRIVE_STEP_DB
        ? wanted
        : null;
}

/** Gain curve that undoes a linear drive ramp from `from` to `to`: sampled
 *  1/drive, which setValueCurveAtTime interpolates between. */
export function undriveCurve(
    from: number,
    to: number,
    points = 32,
): Float32Array<ArrayBuffer> {
    const curve = new Float32Array(points);
    for (let i = 0; i < points; i++)
        curve[i] = 1 / (from + ((to - from) * i) / (points - 1));
    return curve;
}

/** A window is speech only this far above the room's noise floor. */
export const DRIVE_SPEECH_ABOVE_FLOOR_DB = 12;
/** Noise floor follower, per window: drops quickly to a quieter room, creeps
 *  up slowly (about 12 s) so speech doesn't drag it up. */
export const DRIVE_FLOOR_FALL = 0.3;
export const DRIVE_FLOOR_RISE = 0.004;
/** Speech level estimate weights, per speech window: settles over a few
 *  seconds of talking. */
export const DRIVE_SPEECH_RISE = 0.05;
export const DRIVE_SPEECH_FALL = 0.02;
/** The model's input may run this far over the target before the drive is
 *  pulled down at once, without waiting for the slow estimate. */
export const DRIVE_OVERLOAD_DB = 12;

export interface DriveState {
    floor: number | null;
    speech: number | null;
}

export function createDriveState(): DriveState {
    return { floor: null, speech: null };
}

/** One 50 ms window of raw input: update the noise floor and, for speech
 *  windows only, the speech level; return the drive to move to, or null. */
export function driveTick(
    state: DriveState,
    windowDb: number,
    current: number,
): number | null {
    if (!Number.isFinite(windowDb)) return null;
    const { floor } = state;
    state.floor =
        floor === null
            ? windowDb
            : floor +
              (windowDb < floor ? DRIVE_FLOOR_FALL : DRIVE_FLOOR_RISE) *
                  (windowDb - floor);
    const isSpeech =
        windowDb >= DRIVE_GATE_DB &&
        floor !== null &&
        windowDb >= floor + DRIVE_SPEECH_ABOVE_FLOOR_DB;
    if (!isSpeech) return null;
    const prev = state.speech;
    state.speech =
        prev === null
            ? windowDb
            : prev +
              (windowDb > prev ? DRIVE_SPEECH_RISE : DRIVE_SPEECH_FALL) *
                  (windowDb - prev);
    const driven = windowDb + 20 * Math.log10(current);
    if (driven > DRIVE_TARGET_DB + DRIVE_OVERLOAD_DB) {
        state.speech = Math.max(state.speech, windowDb);
    }
    return nextDrive(current, driveGain(state.speech));
}
