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

export interface VoiceContent {
    /** Amplitude bars (0..1024). Empty when the sender stored none. */
    waveform: number[];
    /** Clip length in milliseconds (0 when unknown). */
    durationMs: number;
}

/**
 * Extract the voice-message metadata (waveform + duration) from an m.audio
 * event's content, or null when it isn't a voice message (MSC3245). Fed
 * untrusted content, so every field is defensively parsed — a malformed
 * waveform/duration degrades to [] / 0 rather than throwing.
 */
export function parseVoiceContent(content: unknown): VoiceContent | null {
    if (typeof content !== "object" || content === null) return null;
    const c = content as Record<string, unknown>;
    const isVoice = "org.matrix.msc3245.voice" in c || "m.voice" in c;
    if (!isVoice) return null;

    const audio = (c["org.matrix.msc1767.audio"] ?? c["m.audio"]) as
        | Record<string, unknown>
        | undefined;

    let waveform: number[] = [];
    const rawWave = audio?.waveform;
    if (Array.isArray(rawWave)) {
        waveform = rawWave
            .filter(
                (n): n is number => typeof n === "number" && Number.isFinite(n),
            )
            .map((n) => Math.max(0, Math.min(1024, Math.round(n))));
    }

    const info = c.info as Record<string, unknown> | undefined;
    const durRaw = audio?.duration ?? info?.duration;
    const durationMs =
        typeof durRaw === "number" && Number.isFinite(durRaw) && durRaw >= 0
            ? durRaw
            : 0;

    return { waveform, durationMs };
}
