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
    selfJoin: [
        { type: "sine", from: 480, to: 480, at: 0, duration: 0.09, peak: 0.5 },
        {
            type: "sine",
            from: 660,
            to: 660,
            at: 0.1,
            duration: 0.14,
            peak: 0.5,
        },
    ],
    selfLeave: [
        { type: "sine", from: 660, to: 660, at: 0, duration: 0.09, peak: 0.5 },
        {
            type: "sine",
            from: 440,
            to: 440,
            at: 0.1,
            duration: 0.14,
            peak: 0.5,
        },
    ],
    peerJoin: [
        { type: "sine", from: 520, to: 640, at: 0, duration: 0.15, peak: 0.4 },
    ],
    peerLeave: [
        { type: "sine", from: 640, to: 520, at: 0, duration: 0.15, peak: 0.4 },
    ],
    mute: [
        {
            type: "triangle",
            from: 320,
            to: 320,
            at: 0,
            duration: 0.08,
            peak: 0.45,
        },
    ],
    unmute: [
        {
            type: "triangle",
            from: 520,
            to: 520,
            at: 0,
            duration: 0.08,
            peak: 0.45,
        },
    ],
    deafen: [
        {
            type: "triangle",
            from: 500,
            to: 500,
            at: 0,
            duration: 0.07,
            peak: 0.45,
        },
        {
            type: "triangle",
            from: 350,
            to: 350,
            at: 0.08,
            duration: 0.1,
            peak: 0.45,
        },
    ],
    undeafen: [
        {
            type: "triangle",
            from: 350,
            to: 350,
            at: 0,
            duration: 0.07,
            peak: 0.45,
        },
        {
            type: "triangle",
            from: 500,
            to: 500,
            at: 0.08,
            duration: 0.1,
            peak: 0.45,
        },
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

export function playCallSound(name: CallSoundName): void {
    if (!enabled) return;
    if (!ensureContext() || !ctx || !master) return;
    const t0 = ctx.currentTime + 0.02;
    for (const seg of SOUND_RECIPES[name]) {
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
        gain.connect(master);
        osc.start(t0 + seg.at);
        osc.stop(t0 + seg.at + seg.duration + 0.05);
    }
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
