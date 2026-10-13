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
 * The drive corrects for how loud the mic is, not for each word: it follows a
 * slow estimate and moves only in steps of DRIVE_STEP_DB. A drive that rode
 * the voice changed the model's input mid-word, and the cut after the model
 * could never cancel it exactly (measured: worse than no drive at -25 dBFS).
 */

/** Speech level the model is fed at, in dBFS RMS. */
export const DRIVE_TARGET_DB = -23;
/** Windows quieter than this are mic self-noise or silence and leave the
 *  estimate alone. Lower than normalization's gate: speech at -60 dBFS is
 *  exactly what needs lifting. */
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
/** Per-window weight of a new measurement in the level estimate (one window
 *  per 50 ms): settles within a couple of seconds of speech either way, a
 *  little faster when the voice gets louder. */
export const DRIVE_LEVEL_RISE = 0.1;
export const DRIVE_LEVEL_FALL = 0.03;

/** Fold one window's raw input level into the drive's slow level estimate;
 *  gated windows leave it alone, the first one seeds it. */
export function nextDriveLevel(
    previous: number | null,
    windowDb: number,
): number | null {
    if (!Number.isFinite(windowDb) || windowDb < DRIVE_GATE_DB) return previous;
    if (previous === null) return windowDb;
    const weight = windowDb > previous ? DRIVE_LEVEL_RISE : DRIVE_LEVEL_FALL;
    return previous + weight * (windowDb - previous);
}

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
