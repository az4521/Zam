/**
 * Soft clipper for boosted voice audio: exactly linear up to a knee, then a
 * tanh shoulder that approaches full scale, so a boosted shout rounds off
 * instead of hard-clipping. Not a DynamicsCompressorNode: Chromium's adds
 * makeup gain, which would make processed audio louder than unprocessed.
 */

/** Input span the curve covers, as a multiple of full scale; the input gain
 *  pre-scales into the WaveShaper's [-1,1] domain. */
const SOFT_CLIP_RANGE = 8;
/** Below this the clipper is exactly linear. */
const SOFT_CLIP_KNEE = 0.8;

/** Transfer value for a full-scale-relative sample. Pure, for tests. */
export function softClip(x: number): number {
    const mag = Math.abs(x);
    if (mag <= SOFT_CLIP_KNEE) return x;
    const span = 1 - SOFT_CLIP_KNEE;
    return (
        Math.sign(x) *
        (SOFT_CLIP_KNEE + span * Math.tanh((mag - SOFT_CLIP_KNEE) / span))
    );
}

function softClipCurve(): Float32Array<ArrayBuffer> {
    const n = 8193;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++)
        curve[i] = softClip(((i / (n - 1)) * 2 - 1) * SOFT_CLIP_RANGE);
    return curve;
}

/** Connect into `input`, take sound from `output`. */
export function createSoftClipper(ctx: BaseAudioContext): {
    input: GainNode;
    output: WaveShaperNode;
} {
    const input = ctx.createGain();
    input.gain.value = 1 / SOFT_CLIP_RANGE;
    const output = ctx.createWaveShaper();
    output.curve = softClipCurve();
    output.oversample = "2x";
    input.connect(output);
    return { input, output };
}
