/**
 * Pure helpers for recording voice messages: a normalized waveform for the
 * MSC1767 audio extension, and codec selection for MediaRecorder. No DOM/SDK
 * state — testable in isolation.
 */

/** MSC1767 waveform amplitudes are integers in [0, 1024]. */
const WAVEFORM_MAX = 1024;

/**
 * Downsample a mono PCM channel to `bars` buckets of peak amplitude, scaled to
 * 0..1024 integers. Always returns exactly `bars` values (zero-filled buckets
 * when samples run short); `bars <= 0` returns [].
 */
export function computeWaveform(samples: Float32Array, bars: number): number[] {
    if (!Number.isInteger(bars) || bars <= 0) return [];
    const out = new Array<number>(bars).fill(0);
    if (samples.length === 0) return out;
    // Integer bucket width (>= 1) so that when samples run short the leading
    // buckets pack the samples and the trailing buckets stay zero-filled.
    const bucket = Math.max(1, Math.floor(samples.length / bars));
    for (let b = 0; b < bars; b++) {
        const start = Math.floor(b * bucket);
        const end = Math.min(samples.length, Math.floor((b + 1) * bucket));
        let peak = 0;
        for (let i = start; i < end; i++) {
            const a = Math.abs(samples[i]);
            if (a > peak) peak = a;
        }
        out[b] = Math.min(WAVEFORM_MAX, Math.round(peak * WAVEFORM_MAX));
    }
    return out;
}

const MIME_PREFERENCE = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/webm",
    "audio/mp4",
];

/** Best-supported MediaRecorder audio mime, or "" if recording isn't supported. */
export function pickAudioMimeType(): string {
    const MR = (
        globalThis as unknown as {
            MediaRecorder?: { isTypeSupported?: (t: string) => boolean };
        }
    ).MediaRecorder;
    if (!MR || typeof MR.isTypeSupported !== "function") return "";
    for (const type of MIME_PREFERENCE) {
        if (MR.isTypeSupported(type)) return type;
    }
    return "";
}
