/**
 * Synthesized call sounds (house decision: no binary sound assets). One
 * shared AudioContext, recipes as plain data so tuning is editing numbers.
 * Safe to import in jsdom: WebAudio is only touched at play time.
 */

import type { CallSoundName } from "$lib/utils/callSounds";

export interface ToneSegment {
    type: OscillatorType;
    /** Start/end frequency in Hz (equal = steady tone). */
    from: number;
    to: number;
    /** Offset from sound start, seconds. */
    at: number;
    duration: number;
    /** Peak gain 0..1, pre master volume. */
    peak: number;
}

export const SOUND_RECIPES: Record<CallSoundName, ToneSegment[]> = {
    // Join/leave cues need to cut through a busy call: brighter triangle
    // timbre in a higher register (C5-G5) than the old soft sines, as
    // rising/falling melodic motifs. Self events (rarer, more important) get a
    // 3-note triad plus an octave-up sine sparkle on the accent note; peer
    // events get a lighter, quicker 2-note fifth.
    selfJoin: [
        { type: "triangle", from: 523, to: 523, at: 0, duration: 0.12, peak: 0.55 },
        { type: "triangle", from: 659, to: 659, at: 0.12, duration: 0.12, peak: 0.58 },
        { type: "triangle", from: 784, to: 784, at: 0.24, duration: 0.18, peak: 0.62 },
        { type: "sine", from: 1568, to: 1568, at: 0.24, duration: 0.18, peak: 0.22 },
    ],
    selfLeave: [
        { type: "sine", from: 1046, to: 1046, at: 0, duration: 0.12, peak: 0.2 },
        { type: "triangle", from: 784, to: 784, at: 0, duration: 0.12, peak: 0.6 },
        { type: "triangle", from: 659, to: 659, at: 0.12, duration: 0.12, peak: 0.56 },
        { type: "triangle", from: 523, to: 523, at: 0.24, duration: 0.18, peak: 0.55 },
    ],
    peerJoin: [
        { type: "triangle", from: 523, to: 523, at: 0, duration: 0.1, peak: 0.5 },
        { type: "triangle", from: 784, to: 784, at: 0.11, duration: 0.16, peak: 0.56 },
    ],
    peerLeave: [
        { type: "triangle", from: 784, to: 784, at: 0, duration: 0.1, peak: 0.56 },
        { type: "triangle", from: 523, to: 523, at: 0.11, duration: 0.16, peak: 0.5 },
    ],
    // Mute/unmute are a descending / ascending two-note square wave. The square
    // timbre sets them apart from deafen/undeafen; the lower peak keeps the
    // harmonic-rich square from being louder than the triangle cues.
    mute: [
        { type: "square", from: 500, to: 500, at: 0, duration: 0.07, peak: 0.3 },
        { type: "square", from: 350, to: 350, at: 0.08, duration: 0.1, peak: 0.3 },
    ],
    unmute: [
        { type: "square", from: 350, to: 350, at: 0, duration: 0.07, peak: 0.3 },
        { type: "square", from: 500, to: 500, at: 0.08, duration: 0.1, peak: 0.3 },
    ],
    // Deafen/undeafen are a descending / ascending THREE-note triangle run —
    // the extra note sets them clearly apart from the two-note mute/unmute.
    deafen: [
        { type: "triangle", from: 660, to: 660, at: 0, duration: 0.07, peak: 0.45 },
        { type: "triangle", from: 550, to: 550, at: 0.09, duration: 0.07, peak: 0.45 },
        { type: "triangle", from: 440, to: 440, at: 0.18, duration: 0.12, peak: 0.45 },
    ],
    undeafen: [
        { type: "triangle", from: 440, to: 440, at: 0, duration: 0.07, peak: 0.45 },
        { type: "triangle", from: 550, to: 550, at: 0.09, duration: 0.07, peak: 0.45 },
        { type: "triangle", from: 660, to: 660, at: 0.18, duration: 0.12, peak: 0.45 },
    ],
    error: [
        {
            type: "sawtooth",
            from: 220,
            to: 220,
            at: 0,
            duration: 0.16,
            peak: 0.3,
        },
        {
            type: "sawtooth",
            from: 180,
            to: 180,
            at: 0.18,
            duration: 0.22,
            peak: 0.3,
        },
    ],
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let volume = 0.5;
let enabled = true;
let sinkId: string | null = null;

function applySink(): void {
    if (!ctx) return;
    const c = ctx as AudioContext & {
        setSinkId?: (id: string) => Promise<void>;
    };
    // Chromium 110+; elsewhere sounds go to the default output.
    void c.setSinkId?.(sinkId ?? "").catch(() => {});
}

function ensureContext(): boolean {
    if (typeof AudioContext === "undefined") return false;
    if (!ctx) {
        ctx = new AudioContext();
        master = ctx.createGain();
        master.gain.value = enabled ? volume : 0;
        master.connect(ctx.destination);
        applySink();
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return true;
}

/** Schedule one pass of `segments` into `dest`, starting at audio time `t0`.
 *  Pushes created oscillators into `out` when given (the ring needs handles to
 *  cancel; one-shots do not). */
function scheduleSegments(
    dest: GainNode,
    segments: ToneSegment[],
    t0: number,
    out?: OscillatorNode[],
): void {
    if (!ctx) return;
    for (const seg of segments) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = seg.type;
        osc.frequency.setValueAtTime(seg.from, t0 + seg.at);
        if (seg.to !== seg.from)
            osc.frequency.exponentialRampToValueAtTime(
                seg.to,
                t0 + seg.at + seg.duration,
            );
        gain.gain.setValueAtTime(0.0001, t0 + seg.at);
        gain.gain.linearRampToValueAtTime(seg.peak, t0 + seg.at + 0.012);
        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            t0 + seg.at + seg.duration,
        );
        osc.connect(gain);
        gain.connect(dest);
        osc.start(t0 + seg.at);
        osc.stop(t0 + seg.at + seg.duration + 0.05);
        out?.push(osc);
    }
}

export function playCallSound(name: CallSoundName): void {
    if (!enabled) return;
    if (!ensureContext() || !ctx || !master) return;
    scheduleSegments(master, SOUND_RECIPES[name], ctx.currentTime + 0.02);
}

/**
 * Message-notification ping (loud DMs / mentions). Synthesized, and routed on
 * its own gain straight to the destination — it is NOT a voice-call cue, so the
 * call-sound toggle/volume must not touch it. The caller gates it on the
 * notification-sound setting.
 */
export const PING_PATTERN: ToneSegment[] = [
    { type: "sine", from: 988, to: 988, at: 0, duration: 0.08, peak: 0.55 },
    { type: "sine", from: 1319, to: 1319, at: 0.09, duration: 0.2, peak: 0.55 },
];

export function playPing(): void {
    if (!ensureContext() || !ctx) return;
    const dest = ctx.createGain();
    dest.gain.value = 0.7;
    dest.connect(ctx.destination);
    scheduleSegments(dest, PING_PATTERN, ctx.currentTime + 0.02);
    // Release the transient gain node once the sound has finished.
    setTimeout(() => {
        try {
            dest.disconnect();
        } catch {
            // already gone
        }
    }, 600);
}

/** Mirror the persisted call-sound settings into the engine. */
export function configureCallSounds(opts: {
    volume?: number;
    enabled?: boolean;
    sinkId?: string | null;
}): void {
    if (opts.volume !== undefined)
        volume = Math.min(1, Math.max(0, opts.volume));
    if (opts.enabled !== undefined) enabled = opts.enabled;
    if (opts.sinkId !== undefined) {
        sinkId = opts.sinkId;
        applySink();
    }
    if (master) master.gain.value = enabled ? volume : 0;
}

/** One ring cycle: four tones — high, high, low, low — then silence to fill the
 *  RING_CYCLE_S slot before the next cycle. Triangle at a high peak so it rings
 *  loud and bright. */
export const RING_PATTERN: ToneSegment[] = [
    { type: "triangle", from: 880, to: 880, at: 0, duration: 0.16, peak: 0.7 },
    { type: "triangle", from: 880, to: 880, at: 0.2, duration: 0.16, peak: 0.7 },
    { type: "triangle", from: 587, to: 587, at: 0.4, duration: 0.16, peak: 0.7 },
    { type: "triangle", from: 587, to: 587, at: 0.6, duration: 0.16, peak: 0.7 },
];

/** Length of one ring cycle: the four tones span ~0.76s, the rest is the pause
 *  before the pattern repeats. */
const RING_CYCLE_S = 1.6;

/** Call-waiting blip: one short, quiet double-tap that sits under live call
 *  audio instead of competing with it. */
export const RING_BLIP_PATTERN: ToneSegment[] = [
    { type: "sine", from: 660, to: 660, at: 0, duration: 0.07, peak: 0.18 },
    { type: "sine", from: 880, to: 880, at: 0.11, duration: 0.07, peak: 0.18 },
];

/** The ring stops itself after this long. Exported so the store can decide
 *  "is a ring still sounding?" from Date.now() rather than a timer — timers
 *  are throttled in a hidden renderer, which is the tray case. */
export const RING_MAX_MS = 10000;

let ringGain: GainNode | null = null;
let ringVolume = 1;
let ringEnabled = true;

/** The ring hangs off its own gain, NOT `master`: the call-sounds toggle must
 *  not silence ringing. Output device still applies — `setSinkId` is set on
 *  the context, not on a node. */
function ensureRingGain(): GainNode | null {
    if (!ctx) return null;
    if (!ringGain) {
        ringGain = ctx.createGain();
        ringGain.connect(ctx.destination);
    }
    // Drop any pending stop-ramp (see RingHandle.stop) before restoring the
    // level: setting .value is itself a setValueAtTime(now), so a ring started
    // within the ramp's ~15ms would inherit it and fade itself back out.
    ringGain.gain.cancelScheduledValues(ctx.currentTime);
    ringGain.gain.value = ringEnabled ? ringVolume : 0;
    return ringGain;
}

export interface RingHandle {
    /** Silence the ring now. Safe to call repeatedly, and after it has already
     *  finished on its own. */
    stop(): void;
}

/**
 * Start the ringtone. Every cycle is scheduled upfront on the WebAudio clock —
 * there is no timer to be throttled when the window is hidden, which is what
 * makes ringing work from the system tray. Stops itself after RING_MAX_MS.
 */
export function startRingtone(): RingHandle {
    const nodes: OscillatorNode[] = [];
    const handle: RingHandle = {
        stop() {
            const stopping = nodes.slice();
            nodes.length = 0;
            if (!ctx || stopping.length === 0) return;
            const t = ctx.currentTime;
            // Ramp to silence before killing the oscillators: stopping a tone
            // dead at peak truncates the waveform mid-cycle and clicks — and
            // this path runs on every accept and every decline, mid-ring, right
            // before call audio starts. ensureRingGain() restores the level for
            // the next ring.
            if (ringGain) {
                ringGain.gain.cancelScheduledValues(t);
                ringGain.gain.setValueAtTime(ringGain.gain.value, t);
                ringGain.gain.linearRampToValueAtTime(0.0001, t + 0.015);
            }
            for (const osc of stopping) {
                try {
                    osc.stop(t + 0.02);
                } catch {
                    // never started, or already stopped — either is fine
                }
            }
            // Disconnect only after the ramp: doing it now would yank the
            // oscillators out of the graph instantly and undo the ramp.
            setTimeout(() => {
                for (const osc of stopping) osc.disconnect();
            }, 50);
        },
    };
    if (!ringEnabled) return handle;
    if (!ensureContext() || !ctx) return handle;
    const dest = ensureRingGain();
    if (!dest) return handle;
    // Schedule every cycle upfront on the WebAudio clock — no timer to be
    // throttled when the window is hidden, which is what makes ringing work
    // from the system tray. Stops itself after RING_MAX_MS.
    const t0 = ctx.currentTime + 0.02;
    const cycles = Math.floor(RING_MAX_MS / 1000 / RING_CYCLE_S);
    for (let i = 0; i < cycles; i++)
        scheduleSegments(dest, RING_PATTERN, t0 + i * RING_CYCLE_S, nodes);
    return handle;
}

/** One pass of the ringtone, for the ringtone-volume slider — calibrated
 *  against exactly what a call plays. */
export function playRingPreview(): void {
    if (!ringEnabled) return;
    if (!ensureContext() || !ctx) return;
    const dest = ensureRingGain();
    if (!dest) return;
    scheduleSegments(dest, RING_PATTERN, ctx.currentTime + 0.02);
}

/** The busy-case blip. Follows the ring settings, not the call-sound ones. */
export function playRingBlip(): void {
    if (!ringEnabled) return;
    if (!ensureContext() || !ctx) return;
    const dest = ensureRingGain();
    if (!dest) return;
    scheduleSegments(dest, RING_BLIP_PATTERN, ctx.currentTime + 0.02);
}

/** Mirror the persisted ring settings into the engine. */
export function configureRing(opts: {
    enabled?: boolean;
    volume?: number;
}): void {
    if (opts.volume !== undefined)
        ringVolume = Math.min(1, Math.max(0, opts.volume));
    if (opts.enabled !== undefined) ringEnabled = opts.enabled;
    if (ringGain) ringGain.gain.value = ringEnabled ? ringVolume : 0;
}
