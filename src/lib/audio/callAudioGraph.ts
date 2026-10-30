/**
 * Web Audio path for remote call audio that an <audio> element cannot play
 * on its own: per-user boost above 100% and incoming-voice normalization.
 *
 * Each routed element keeps its LiveKit-attached remote stream but is muted
 * (Chromium only feeds remote WebRTC audio to Web Audio while a media element
 * is playing it; LiveKit's own webAudioMix does the same). Its stream runs
 * source -> normalization gain -> user gain -> shared limiter, and the mix
 * plays straight out of the context, with output-device selection through
 * AudioContext.setSinkId. Where that is missing it plays through ONE output
 * <audio> element instead, selected with HTMLMediaElement.setSinkId.
 */
import {
    rmsDb,
    createNormalizer,
    normalizationGain,
    normalizerStep,
    type NormalizerState,
} from "./voiceNormalization";
import { rememberLevel, rememberedLevel } from "./normalizerMemory";
import { createSoftClipper } from "./softClip";

const NORMALIZE_TICK_MS = 100;

interface RoutedSource {
    source: MediaStreamAudioSourceNode;
    analyser: AnalyserNode;
    norm: GainNode;
    gain: GainNode;
    state: NormalizerState;
    /** Whose voice, for remembering its level between calls. */
    key: string | null;
}

export interface CallAudioGraph {
    /** Route an element's stream through the graph. False when it cannot
     *  (no MediaStream yet, or the graph throws); the caller keeps the
     *  element on its direct path. `key` names the voice (a user id) so
     *  normalization resumes the level it had last time. */
    route(el: HTMLAudioElement, key?: string): boolean;
    has(el: HTMLAudioElement): boolean;
    remove(el: HTMLAudioElement): void;
    /** Linear user gain (master x per-user level, 0..5) for a routed element. */
    setGain(el: HTMLAudioElement, gain: number): void;
    /** Decode a clip for playBuffer. Null when it is not decodable audio. */
    decode(bytes: ArrayBuffer): Promise<AudioBuffer | null>;
    /** Play a decoded clip once into the mix (soundboard). Returns a stop
     *  function, or null when the graph is closed. `onEnd` runs when the
     *  clip finishes or is stopped. */
    playBuffer(
        buffer: AudioBuffer,
        gain: number,
        onEnd?: () => void,
    ): (() => void) | null;
    setNormalize(on: boolean): void;
    setSink(deviceId: string | null): void;
    setMuted(muted: boolean): void;
    /** Whether the context is held suspended by autoplay policy. */
    readonly suspended: boolean;
    resume(): Promise<void>;
    close(): void;
}

type AudioContextWithSink = AudioContext & {
    setSinkId?: (id: string) => Promise<void>;
};

export function createCallAudioGraph(opts: {
    sinkId: string | null;
    muted: boolean;
    normalize: boolean;
    onSuspendedChange: () => void;
}): CallAudioGraph | null {
    if (typeof AudioContext === "undefined") return null;
    let ctx: AudioContext;
    // Null when the mix plays straight out of the context (see below).
    let out: HTMLAudioElement | null = null;
    let limiter: GainNode;
    let deafen: GainNode;
    try {
        ctx = new AudioContext();
        // Soft clipper on the mix: a 500% boost of someone already loud would
        // otherwise hard-clip.
        const clipper = createSoftClipper(ctx);
        limiter = clipper.input;
        deafen = ctx.createGain();
        deafen.gain.value = opts.muted ? 0 : 1;
        clipper.output.connect(deafen);
        // Where the context can pick its output device, play straight to it.
        // Going through a MediaStream into an <audio> element instead puts a
        // second clock in the path: Chromium time-stretches that stream to
        // absorb drift, so call audio and soundboard clips slowed down under
        // CPU or audio-device contention (OBS running) and sped up again to
        // catch up.
        if (typeof (ctx as AudioContextWithSink).setSinkId === "function") {
            deafen.connect(ctx.destination);
        } else {
            const dest = ctx.createMediaStreamDestination();
            deafen.connect(dest);
            out = document.createElement("audio");
            out.autoplay = true;
            out.srcObject = dest.stream;
            document.body.appendChild(out);
        }
    } catch {
        return null;
    }
    const sinkTarget = out as
        | (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> })
        | null;
    const setSink = (id: string | null) => {
        const target = sinkTarget ?? (ctx as AudioContextWithSink);
        void target.setSinkId?.(id ?? "")?.catch(() => {});
    };
    setSink(opts.sinkId);

    const routed = new Map<HTMLAudioElement, RoutedSource>();
    let normalize = opts.normalize;
    let timer: ReturnType<typeof setInterval> | null = null;
    let closed = false;
    const buf = new Float32Array(2048);

    const tick = () => {
        const now = ctx.currentTime;
        for (const r of routed.values()) {
            r.analyser.getFloatTimeDomainData(buf);
            const step = normalizerStep(
                r.state,
                rmsDb(buf),
                NORMALIZE_TICK_MS / 1000,
                r.norm.gain.value,
            );
            if (step === null) continue;
            r.norm.gain.setTargetAtTime(step.gain, now, step.timeConstant);
            if (r.key) rememberLevel(r.key, r.state);
        }
    };
    const syncTimer = () => {
        const want = normalize && routed.size > 0 && !closed;
        if (want && timer === null)
            timer = setInterval(tick, NORMALIZE_TICK_MS);
        else if (!want && timer !== null) {
            clearInterval(timer);
            timer = null;
        }
    };

    const start = async () => {
        try {
            if (ctx.state === "suspended") await ctx.resume();
        } catch {
            /* stays suspended; surfaced via `suspended` */
        }
        void out?.play().catch(() => {});
    };
    ctx.onstatechange = () => opts.onSuspendedChange();
    void start();

    return {
        route(el, key) {
            if (closed || routed.has(el)) return routed.has(el);
            const stream = el.srcObject;
            if (!(stream instanceof MediaStream)) return false;
            try {
                const source = ctx.createMediaStreamSource(stream);
                const analyser = ctx.createAnalyser();
                analyser.fftSize = buf.length;
                const norm = ctx.createGain();
                const gain = ctx.createGain();
                source.connect(analyser);
                source.connect(norm);
                norm.connect(gain);
                gain.connect(limiter);
                const seed = key ? rememberedLevel(key) : null;
                const state = createNormalizer(seed ?? undefined);
                // Start at the remembered gain rather than gliding up to it.
                const startGain = normalize
                    ? normalizationGain(state.level)
                    : null;
                if (startGain !== null) norm.gain.value = startGain;
                routed.set(el, {
                    source,
                    analyser,
                    norm,
                    gain,
                    state,
                    key: key ?? null,
                });
            } catch {
                return false;
            }
            syncTimer();
            void start();
            return true;
        },
        has: (el) => routed.has(el),
        remove(el) {
            const r = routed.get(el);
            if (!r) return;
            routed.delete(el);
            if (r.key && normalize) rememberLevel(r.key, r.state, true);
            r.source.disconnect();
            r.gain.disconnect();
            syncTimer();
        },
        setGain(el, gain) {
            const r = routed.get(el);
            // A short ramp, not a jump: dragging the slider must not click.
            r?.gain.gain.setTargetAtTime(gain, ctx.currentTime, 0.02);
        },
        async decode(bytes) {
            if (closed) return null;
            try {
                return await ctx.decodeAudioData(bytes);
            } catch {
                return null;
            }
        },
        playBuffer(buffer, gain, onEnd) {
            if (closed) return null;
            try {
                const src = ctx.createBufferSource();
                const g = ctx.createGain();
                g.gain.value = gain;
                src.buffer = buffer;
                src.connect(g);
                g.connect(limiter);
                src.onended = () => {
                    src.disconnect();
                    g.disconnect();
                    onEnd?.();
                };
                void start();
                src.start();
                return () => {
                    try {
                        src.stop();
                    } catch {
                        /* already stopped */
                    }
                };
            } catch {
                return null;
            }
        },
        setNormalize(on) {
            normalize = on;
            if (!on)
                for (const r of routed.values()) {
                    r.state.level = null;
                    r.norm.gain.setTargetAtTime(1, ctx.currentTime, 0.1);
                }
            syncTimer();
        },
        setSink,
        setMuted(muted) {
            deafen.gain.value = muted ? 0 : 1;
        },
        get suspended() {
            return !closed && ctx.state === "suspended";
        },
        resume: start,
        close() {
            if (closed) return;
            closed = true;
            syncTimer();
            if (normalize)
                for (const r of routed.values())
                    if (r.key) rememberLevel(r.key, r.state, true);
            routed.clear();
            ctx.onstatechange = null;
            if (out) {
                out.pause();
                out.srcObject = null;
                out.remove();
            }
            void ctx.close().catch(() => {});
        },
    };
}
