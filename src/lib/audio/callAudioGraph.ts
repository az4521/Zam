/**
 * Web Audio path for remote call audio that an <audio> element cannot play
 * on its own: per-user boost above 100% and incoming-voice normalization.
 *
 * Each routed element keeps its LiveKit-attached remote stream but is muted
 * (Chromium only feeds remote WebRTC audio to Web Audio while a media element
 * is playing it; LiveKit's own webAudioMix does the same). Its stream runs
 * source -> normalization gain -> user gain -> shared limiter, and the mix
 * plays through ONE output <audio> element, so output-device selection keeps
 * using HTMLMediaElement.setSinkId (AudioContext.setSinkId is Chromium-only).
 */
import {
    rmsDb,
    nextSpeechLevel,
    normalizationGain,
    gainTimeConstant,
    createSpeechGate,
    speechWindow,
    type SpeechGate,
} from "./voiceNormalization";
import { createSoftClipper } from "./softClip";

const NORMALIZE_TICK_MS = 100;

interface RoutedSource {
    source: MediaStreamAudioSourceNode;
    analyser: AnalyserNode;
    norm: GainNode;
    gain: GainNode;
    level: number | null;
    gate: SpeechGate;
}

export interface CallAudioGraph {
    /** Route an element's stream through the graph. False when it cannot
     *  (no MediaStream yet, or the graph throws); the caller keeps the
     *  element on its direct path. */
    route(el: HTMLAudioElement): boolean;
    has(el: HTMLAudioElement): boolean;
    remove(el: HTMLAudioElement): void;
    /** Linear user gain (master x per-user level, 0..5) for a routed element. */
    setGain(el: HTMLAudioElement, gain: number): void;
    setNormalize(on: boolean): void;
    setSink(deviceId: string | null): void;
    setMuted(muted: boolean): void;
    /** Whether the context is held suspended by autoplay policy. */
    readonly suspended: boolean;
    resume(): Promise<void>;
    close(): void;
}

export function createCallAudioGraph(opts: {
    sinkId: string | null;
    muted: boolean;
    normalize: boolean;
    onSuspendedChange: () => void;
}): CallAudioGraph | null {
    if (typeof AudioContext === "undefined") return null;
    let ctx: AudioContext;
    let out: HTMLAudioElement;
    let limiter: GainNode;
    try {
        ctx = new AudioContext();
        // Soft clipper on the mix: a 500% boost of someone already loud would
        // otherwise hard-clip.
        const clipper = createSoftClipper(ctx);
        limiter = clipper.input;
        const dest = ctx.createMediaStreamDestination();
        clipper.output.connect(dest);
        out = document.createElement("audio");
        out.autoplay = true;
        out.srcObject = dest.stream;
        document.body.appendChild(out);
    } catch {
        return null;
    }
    out.muted = opts.muted;
    const sinkOut = out as HTMLAudioElement & {
        setSinkId?: (id: string) => Promise<void>;
    };
    const setSink = (id: string | null) =>
        void sinkOut.setSinkId?.(id ?? "").catch(() => {});
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
            // Only speech moves the level: a pause full of the speaker's
            // room noise would otherwise read as a quiet voice and be
            // turned up until the noise floor was audible.
            const db = rmsDb(buf);
            if (speechWindow(r.gate, db, NORMALIZE_TICK_MS / 1000))
                r.level = nextSpeechLevel(r.level, db);
            const target = normalizationGain(r.level);
            if (target === null) continue;
            const current = r.norm.gain.value;
            r.norm.gain.setTargetAtTime(
                target,
                now,
                gainTimeConstant(current, target),
            );
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
        void out.play().catch(() => {});
    };
    ctx.onstatechange = () => opts.onSuspendedChange();
    void start();

    return {
        route(el) {
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
                routed.set(el, {
                    source,
                    analyser,
                    norm,
                    gain,
                    level: null,
                    gate: createSpeechGate(),
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
            r.source.disconnect();
            r.gain.disconnect();
            syncTimer();
        },
        setGain(el, gain) {
            const r = routed.get(el);
            // A short ramp, not a jump: dragging the slider must not click.
            r?.gain.gain.setTargetAtTime(gain, ctx.currentTime, 0.02);
        },
        setNormalize(on) {
            normalize = on;
            if (!on)
                for (const r of routed.values()) {
                    r.level = null;
                    r.norm.gain.setTargetAtTime(1, ctx.currentTime, 0.1);
                }
            syncTimer();
        },
        setSink,
        setMuted(muted) {
            out.muted = muted;
        },
        get suspended() {
            return !closed && ctx.state === "suspended";
        },
        resume: start,
        close() {
            if (closed) return;
            closed = true;
            syncTimer();
            routed.clear();
            ctx.onstatechange = null;
            out.pause();
            out.srcObject = null;
            out.remove();
            void ctx.close().catch(() => {});
        },
    };
}
