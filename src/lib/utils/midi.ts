/**
 * MIDI playback for `m.audio` attachments. Browsers can't decode Standard MIDI
 * Files in `<audio>` (it loads, reports 0:00 and never plays), so we render
 * the file to a WAV blob and hand the player that instead.
 *
 * The real renderer uses a sound bank (./midiSoundBank.ts). This file is the
 * fallback for when there is none: it synthesizes offline with plain WebAudio
 * oscillators/noise. The timbres are deliberately simple: the goal is "sounds
 * like the tune", not General MIDI fidelity.
 */
import { renderMidiWithSoundBank } from "./midiSoundBank";

const MIDI_MIME_TYPES = new Set([
    "audio/midi",
    "audio/mid",
    "audio/x-midi",
    "audio/x-mid",
    "audio/sp-midi",
]);

/** True when an attachment's mimetype or filename says it's a MIDI file. */
export function isMidiAttachment(
    mimetype: string | null | undefined,
    filename: string | null | undefined,
): boolean {
    const base = (mimetype ?? "").toLowerCase().split(";")[0].trim();
    if (MIDI_MIME_TYPES.has(base)) return true;
    return /\.(midi?|kar|rmi)$/i.test((filename ?? "").trim());
}

export type MidiEvent =
    | {
          time: number;
          kind: "noteOn";
          channel: number;
          note: number;
          velocity: number;
      }
    | { time: number; kind: "noteOff"; channel: number; note: number }
    | {
          time: number;
          kind: "cc";
          channel: number;
          controller: number;
          value: number;
      }
    | { time: number; kind: "program"; channel: number; program: number }
    /** `value` is the raw 14-bit bend, centred on 8192. */
    | { time: number; kind: "bend"; channel: number; value: number };

export interface MidiSong {
    /** Channel events in playback order, `time` in seconds. */
    events: MidiEvent[];
    /** Time of the last event, in seconds. */
    duration: number;
}

type RawEvent =
    | { tick: number; kind: "tempo"; usPerQuarter: number }
    | (MidiEvent extends infer E
          ? E extends MidiEvent
              ? Omit<E, "time"> & { tick: number }
              : never
          : never);

/** Parse a Standard MIDI File (format 0/1/2) into timed channel events. */
export function parseMidi(data: ArrayBuffer | Uint8Array): MidiSong {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const ascii = (at: number) =>
        String.fromCharCode(
            bytes[at],
            bytes[at + 1],
            bytes[at + 2],
            bytes[at + 3],
        );

    // RIFF-wrapped MIDI (.rmi): the SMF lives in the "data" chunk.
    let pos = 0;
    if (bytes.length >= 12 && ascii(0) === "RIFF" && ascii(8) === "RMID") {
        pos = 12;
        while (pos + 8 <= bytes.length && ascii(pos) !== "data") {
            pos += 8 + view.getUint32(pos + 4, true);
        }
        pos += 8;
    }
    if (pos + 14 > bytes.length || ascii(pos) !== "MThd") {
        throw new Error("Not a MIDI file");
    }
    const headerLen = view.getUint32(pos + 4);
    const trackCount = view.getUint16(pos + 10);
    const division = view.getUint16(pos + 12);
    pos += 8 + headerLen;

    const raw: RawEvent[] = [];
    for (let t = 0; t < trackCount && pos + 8 <= bytes.length; t++) {
        const len = view.getUint32(pos + 4);
        const isTrack = ascii(pos) === "MTrk";
        const start = pos + 8;
        const end = Math.min(start + len, bytes.length);
        pos = start + len;
        if (!isTrack) {
            t--; // unknown chunk: skip without consuming a track slot
            continue;
        }
        parseTrack(bytes, start, end, raw);
    }

    // Stable sort keeps same-tick events in track/file order.
    raw.sort((a, b) => a.tick - b.tick);

    const events: MidiEvent[] = [];
    let secondsPerTick: number;
    const smpte = (division & 0x8000) !== 0;
    if (smpte) {
        const fps = 256 - (division >> 8);
        const ticksPerFrame = division & 0xff;
        secondsPerTick = 1 / (fps * ticksPerFrame || 1);
    } else {
        secondsPerTick = 0.5 / (division || 480);
    }
    let lastTick = 0;
    let time = 0;
    for (const ev of raw) {
        time += (ev.tick - lastTick) * secondsPerTick;
        lastTick = ev.tick;
        if (ev.kind === "tempo") {
            if (!smpte && ev.usPerQuarter > 0) {
                secondsPerTick = ev.usPerQuarter / 1e6 / (division || 480);
            }
            continue;
        }
        const { tick: _tick, ...rest } = ev;
        events.push({ ...rest, time } as MidiEvent);
    }
    return { events, duration: time };
}

function parseTrack(
    bytes: Uint8Array,
    start: number,
    end: number,
    out: RawEvent[],
): void {
    let p = start;
    let tick = 0;
    let running = 0;
    const readVarLen = () => {
        let v = 0;
        for (let i = 0; i < 4 && p < end; i++) {
            const b = bytes[p++];
            v = (v << 7) | (b & 0x7f);
            if (!(b & 0x80)) break;
        }
        return v;
    };
    while (p < end) {
        tick += readVarLen();
        if (p >= end) break;
        let status = bytes[p];
        if (status & 0x80) {
            p++;
        } else if (running) {
            status = running; // running status: reuse, don't consume
        } else {
            break; // corrupt track
        }

        if (status === 0xff) {
            const type = bytes[p++];
            const len = readVarLen();
            if (type === 0x51 && len === 3 && p + 3 <= end) {
                const us =
                    (bytes[p] << 16) | (bytes[p + 1] << 8) | bytes[p + 2];
                out.push({ tick, kind: "tempo", usPerQuarter: us });
            }
            p += len;
            if (type === 0x2f) break; // end of track
            continue;
        }
        if (status === 0xf0 || status === 0xf7) {
            p += readVarLen();
            continue;
        }
        if (status >= 0xf0) continue; // stray system message, no data

        running = status;
        const kind = status & 0xf0;
        const channel = status & 0x0f;
        const a = bytes[p++] & 0x7f;
        if (kind === 0xc0) {
            out.push({ tick, kind: "program", channel, program: a });
            continue;
        }
        if (kind === 0xd0) continue; // channel pressure: ignored
        const b = bytes[p++] & 0x7f;
        if (kind === 0x90 && b > 0) {
            out.push({ tick, kind: "noteOn", channel, note: a, velocity: b });
        } else if (kind === 0x80 || kind === 0x90) {
            out.push({ tick, kind: "noteOff", channel, note: a });
        } else if (kind === 0xb0) {
            out.push({ tick, kind: "cc", channel, controller: a, value: b });
        } else if (kind === 0xe0) {
            out.push({ tick, kind: "bend", channel, value: (b << 7) | a });
        }
        // 0xa0 (poly aftertouch): ignored
    }
}

// ---------------------------------------------------------------------------
// Synthesis
// ---------------------------------------------------------------------------

const SAMPLE_RATE = 32000;
const TAIL_SECONDS = 2;
/** Bounds so a hostile/huge file can't hang the tab or eat all memory. */
const MAX_SECONDS = 15 * 60;
const MAX_NOTES = 40000;
const DRUM_CHANNEL = 9;
/** Seconds of voices created per render suspension (see renderMidi). */
const SCHEDULE_CHUNK = 1;
const SCHEDULE_LEAD = 0.1;

interface Patch {
    wave: OscillatorType;
    /** Relative loudness, compensating for waveform energy. */
    level: number;
    attack: number;
    /** Time constant of the decay toward `sustain`. */
    decay: number;
    /** Sustain as a fraction of the peak (0 = fully percussive). */
    sustain: number;
    release: number;
    /** Channel low-pass cutoff (Hz) to tame bright waveforms. */
    cutoff: number;
}

/** One rough patch per General MIDI family (program >> 3). */
const FAMILY_PATCHES: Patch[] = [
    /* piano */ {
        wave: "triangle",
        level: 1,
        attack: 0.004,
        decay: 0.9,
        sustain: 0,
        release: 0.2,
        cutoff: 6000,
    },
    /* chromatic perc */ {
        wave: "sine",
        level: 1,
        attack: 0.002,
        decay: 0.45,
        sustain: 0,
        release: 0.3,
        cutoff: 8000,
    },
    /* organ */ {
        wave: "square",
        level: 0.35,
        attack: 0.01,
        decay: 0.2,
        sustain: 0.9,
        release: 0.06,
        cutoff: 3500,
    },
    /* guitar */ {
        wave: "triangle",
        level: 1,
        attack: 0.003,
        decay: 0.7,
        sustain: 0,
        release: 0.12,
        cutoff: 5000,
    },
    /* bass */ {
        wave: "triangle",
        level: 1.3,
        attack: 0.004,
        decay: 1.2,
        sustain: 0.25,
        release: 0.08,
        cutoff: 2500,
    },
    /* strings */ {
        wave: "sawtooth",
        level: 0.35,
        attack: 0.06,
        decay: 0.5,
        sustain: 0.85,
        release: 0.25,
        cutoff: 3000,
    },
    /* ensemble */ {
        wave: "sawtooth",
        level: 0.3,
        attack: 0.08,
        decay: 0.5,
        sustain: 0.85,
        release: 0.3,
        cutoff: 2800,
    },
    /* brass */ {
        wave: "sawtooth",
        level: 0.35,
        attack: 0.03,
        decay: 0.4,
        sustain: 0.7,
        release: 0.12,
        cutoff: 3500,
    },
    /* reed */ {
        wave: "square",
        level: 0.3,
        attack: 0.02,
        decay: 0.3,
        sustain: 0.8,
        release: 0.08,
        cutoff: 3000,
    },
    /* pipe */ {
        wave: "sine",
        level: 1,
        attack: 0.03,
        decay: 0.3,
        sustain: 0.9,
        release: 0.1,
        cutoff: 8000,
    },
    /* synth lead */ {
        wave: "sawtooth",
        level: 0.3,
        attack: 0.01,
        decay: 0.3,
        sustain: 0.8,
        release: 0.1,
        cutoff: 5000,
    },
    /* synth pad */ {
        wave: "sawtooth",
        level: 0.25,
        attack: 0.25,
        decay: 0.8,
        sustain: 0.8,
        release: 0.6,
        cutoff: 2200,
    },
    /* synth fx */ {
        wave: "triangle",
        level: 0.8,
        attack: 0.05,
        decay: 0.8,
        sustain: 0.5,
        release: 0.4,
        cutoff: 5000,
    },
    /* ethnic */ {
        wave: "triangle",
        level: 1,
        attack: 0.003,
        decay: 0.6,
        sustain: 0,
        release: 0.15,
        cutoff: 5000,
    },
    /* percussive */ {
        wave: "sine",
        level: 1,
        attack: 0.002,
        decay: 0.3,
        sustain: 0,
        release: 0.1,
        cutoff: 6000,
    },
    /* sound fx */ {
        wave: "sine",
        level: 0.6,
        attack: 0.02,
        decay: 0.5,
        sustain: 0.4,
        release: 0.3,
        cutoff: 6000,
    },
];

function patchFor(program: number): Patch {
    // Overdriven/distortion guitars sustain and are brighter than the family.
    if (program === 29 || program === 30) {
        return {
            wave: "sawtooth",
            level: 0.3,
            attack: 0.005,
            decay: 0.8,
            sustain: 0.6,
            release: 0.1,
            cutoff: 3000,
        };
    }
    return FAMILY_PATCHES[(program >> 3) & 15];
}

/** Envelope value at `t` for a voice started at `start` (see scheduleEnvelope). */
function envelopeAt(p: Patch, peak: number, start: number, t: number): number {
    const attackEnd = start + p.attack;
    if (t <= attackEnd) return peak * Math.max(0, (t - start) / p.attack);
    const sus = peak * p.sustain;
    return sus + (peak - sus) * Math.exp(-(t - attackEnd) / p.decay);
}

interface Voice {
    osc: OscillatorNode;
    env: GainNode;
    patch: Patch;
    peak: number;
    start: number;
    /** Percussive patches are silent by here even if the note is held. */
    hardStop: number;
}

interface ChannelState {
    input: GainNode;
    volume: GainNode;
    filter: BiquadFilterNode;
    panner: StereoPannerNode;
    program: number;
    vol: number;
    expr: number;
    bendCents: number;
    bendRange: number;
    rpn: number;
    sustainPedal: boolean;
    /** Keyed by note number; a note can retrigger before its off. */
    active: Map<number, Voice[]>;
    /** Notes released while the sustain pedal was down. */
    held: Voice[];
}

const volumeCurve = (vol: number, expr: number) =>
    (vol / 127) ** 2 * (expr / 127) ** 2;

/** Synthesize a MIDI file to a stereo AudioBuffer. */
export async function renderMidi(data: ArrayBuffer): Promise<AudioBuffer> {
    const song = parseMidi(data);
    const length = Math.min(song.duration + TAIL_SECONDS, MAX_SECONDS);
    const ctx = new OfflineAudioContext(
        2,
        Math.max(1, Math.ceil(length * SAMPLE_RATE)),
        SAMPLE_RATE,
    );
    const master = ctx.createGain();
    master.connect(ctx.destination);

    const noise = ctx.createBuffer(1, SAMPLE_RATE, SAMPLE_RATE);
    const noiseData = noise.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++)
        noiseData[i] = Math.random() * 2 - 1;

    const channels: ChannelState[] = [];
    for (let c = 0; c < 16; c++) {
        const input = ctx.createGain();
        const volume = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        const panner = ctx.createStereoPanner();
        filter.type = "lowpass";
        filter.Q.value = 0.5;
        const patch = patchFor(0);
        filter.frequency.value = c === DRUM_CHANNEL ? 18000 : patch.cutoff;
        volume.gain.value = volumeCurve(100, 127);
        input.connect(filter).connect(volume).connect(panner).connect(master);
        channels.push({
            input,
            volume,
            filter,
            panner,
            program: 0,
            vol: 100,
            expr: 127,
            bendCents: 0,
            bendRange: 2,
            rpn: 0x3fff,
            sustainPedal: false,
            active: new Map(),
            held: [],
        });
    }

    const release = (v: Voice, t: number) => {
        const level = envelopeAt(v.patch, v.peak, v.start, t);
        v.env.gain.cancelScheduledValues(t);
        v.env.gain.setValueAtTime(level, t);
        v.env.gain.setTargetAtTime(0, t, v.patch.release / 3);
        v.osc.stop(Math.min(v.hardStop, t + v.patch.release * 2 + 0.05));
    };

    let notes = 0;
    const handle = (ev: MidiEvent) => {
        const t = ev.time;
        const ch = channels[ev.channel];
        switch (ev.kind) {
            case "noteOn": {
                if (++notes > MAX_NOTES) break;
                const vel = ev.velocity / 127;
                if (ev.channel === DRUM_CHANNEL) {
                    playDrum(ctx, ch.input, noise, ev.note, vel, t);
                    break;
                }
                const patch = patchFor(ch.program);
                const osc = ctx.createOscillator();
                const env = ctx.createGain();
                osc.type = patch.wave;
                osc.frequency.value = 440 * 2 ** ((ev.note - 69) / 12);
                osc.detune.value = ch.bendCents;
                const peak = vel * vel * patch.level * 0.3;
                env.gain.setValueAtTime(0, t);
                env.gain.linearRampToValueAtTime(peak, t + patch.attack);
                env.gain.setTargetAtTime(
                    peak * patch.sustain,
                    t + patch.attack,
                    patch.decay,
                );
                osc.connect(env).connect(ch.input);
                osc.start(t);
                const hardStop =
                    patch.sustain === 0 ? t + patch.decay * 7 : Infinity;
                const voice: Voice = {
                    osc,
                    env,
                    patch,
                    peak,
                    start: t,
                    hardStop,
                };
                const list = ch.active.get(ev.note);
                if (list) list.push(voice);
                else ch.active.set(ev.note, [voice]);
                break;
            }
            case "noteOff": {
                const voice = ch.active.get(ev.note)?.shift();
                if (!voice) break;
                if (ch.sustainPedal) ch.held.push(voice);
                else release(voice, t);
                break;
            }
            case "program":
                ch.program = ev.program;
                if (ev.channel !== DRUM_CHANNEL) {
                    ch.filter.frequency.setValueAtTime(
                        patchFor(ev.program).cutoff,
                        t,
                    );
                }
                break;
            case "bend":
                ch.bendCents = ((ev.value - 8192) / 8192) * ch.bendRange * 100;
                for (const list of ch.active.values()) {
                    for (const v of list)
                        v.osc.detune.setValueAtTime(ch.bendCents, t);
                }
                for (const v of ch.held)
                    v.osc.detune.setValueAtTime(ch.bendCents, t);
                break;
            case "cc":
                switch (ev.controller) {
                    case 7:
                        ch.vol = ev.value;
                        ch.volume.gain.setValueAtTime(
                            volumeCurve(ch.vol, ch.expr),
                            t,
                        );
                        break;
                    case 11:
                        ch.expr = ev.value;
                        ch.volume.gain.setValueAtTime(
                            volumeCurve(ch.vol, ch.expr),
                            t,
                        );
                        break;
                    case 10:
                        ch.panner.pan.setValueAtTime(
                            Math.max(-1, (ev.value - 64) / 63),
                            t,
                        );
                        break;
                    case 64:
                        ch.sustainPedal = ev.value >= 64;
                        if (!ch.sustainPedal) {
                            for (const v of ch.held) release(v, t);
                            ch.held = [];
                        }
                        break;
                    case 101:
                        ch.rpn = (ev.value << 7) | (ch.rpn & 0x7f);
                        break;
                    case 100:
                        ch.rpn = (ch.rpn & 0x3f80) | ev.value;
                        break;
                    case 6: // data entry: RPN 0 = pitch-bend range
                        if (ch.rpn === 0) ch.bendRange = ev.value;
                        break;
                    case 120: // all sound off
                    case 123: // all notes off
                        for (const list of ch.active.values()) {
                            for (const v of list) release(v, t);
                        }
                        ch.active.clear();
                        for (const v of ch.held) release(v, t);
                        ch.held = [];
                        break;
                    case 121: // reset all controllers
                        ch.expr = 127;
                        ch.bendCents = 0;
                        ch.sustainPedal = false;
                        ch.volume.gain.setValueAtTime(
                            volumeCurve(ch.vol, ch.expr),
                            t,
                        );
                        break;
                }
                break;
        }
    };

    // Close any notes still sounding at the end of the song.
    const closeAll = () => {
        const end = Math.min(song.duration, length);
        for (const ch of channels) {
            for (const list of ch.active.values())
                for (const v of list) release(v, end);
            for (const v of ch.held) release(v, end);
        }
    };

    const events = song.events.filter((ev) => ev.time < length);
    let next = 0;
    const scheduleUntil = (limit: number) => {
        while (next < events.length && events[next].time < limit) {
            handle(events[next++]);
        }
        if (next === events.length) {
            closeAll();
            next++; // only once
        }
    };

    // Every node connected to the graph costs render time from the moment it
    // exists, even before it starts, so building all voices up front made an
    // 90s song take ~15s. Instead suspend the render each chunk and create
    // just the next chunk's voices. Firefox lacks OfflineAudioContext.suspend;
    // there we fall back to scheduling everything up front.
    if (typeof ctx.suspend === "function") {
        scheduleUntil(SCHEDULE_CHUNK);
        for (let at = SCHEDULE_CHUNK; at < length; at += SCHEDULE_CHUNK) {
            // Suspend a little early so the chunk's first notes aren't late.
            ctx.suspend(at - SCHEDULE_LEAD).then(() => {
                scheduleUntil(at + SCHEDULE_CHUNK);
                return ctx.resume();
            });
        }
    } else {
        scheduleUntil(Infinity);
    }

    return ctx.startRendering();
}

/** Rough GM percussion: kicks/toms are pitched sine sweeps, the rest noise. */
function playDrum(
    ctx: OfflineAudioContext,
    out: AudioNode,
    noise: AudioBuffer,
    note: number,
    vel: number,
    t: number,
): void {
    const gain = vel * vel * 0.5;
    const tone = (from: number, to: number, dur: number, level: number) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.frequency.setValueAtTime(from, t);
        osc.frequency.exponentialRampToValueAtTime(to, t + dur * 0.5);
        env.gain.setValueAtTime(gain * level, t);
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(env).connect(out);
        osc.start(t);
        osc.stop(t + dur);
    };
    const hiss = (
        type: BiquadFilterType,
        freq: number,
        dur: number,
        level: number,
    ) => {
        const src = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const env = ctx.createGain();
        src.buffer = noise;
        src.loop = true;
        filter.type = type;
        filter.frequency.value = freq;
        env.gain.setValueAtTime(gain * level, t);
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(filter).connect(env).connect(out);
        src.start(t);
        src.stop(t + dur);
    };

    switch (note) {
        case 35:
        case 36: // kicks
            tone(140, 45, 0.35, 1.6);
            break;
        case 38:
        case 40: // snares
            tone(190, 150, 0.1, 0.6);
            hiss("bandpass", 2500, 0.18, 1.2);
            break;
        case 37: // side stick
            hiss("bandpass", 4000, 0.04, 1);
            break;
        case 39: // clap
            hiss("bandpass", 1500, 0.15, 1.2);
            break;
        case 42:
        case 44: // closed / pedal hi-hat
            hiss("highpass", 7000, 0.05, 0.6);
            break;
        case 46: // open hi-hat
            hiss("highpass", 7000, 0.3, 0.5);
            break;
        case 49:
        case 52:
        case 55:
        case 57: // crash / china / splash
            hiss("highpass", 5000, 1.1, 0.5);
            break;
        case 51:
        case 53:
        case 59: // rides
            hiss("highpass", 6000, 0.45, 0.35);
            break;
        case 41:
        case 43:
        case 45:
        case 47:
        case 48:
        case 50: {
            // toms, low -> high
            const f = 70 + (note - 41) * 18;
            tone(f * 1.5, f, 0.3, 1.2);
            break;
        }
        default:
            hiss("bandpass", 3000 + (note % 12) * 400, 0.08, 0.8);
    }
}

/** Encode an AudioBuffer as a 16-bit PCM WAV, peak-normalized to -0.5 dBFS. */
export function encodeWav(buffer: AudioBuffer): Blob {
    const channels = buffer.numberOfChannels;
    const frames = buffer.length;
    const data = Array.from({ length: channels }, (_, c) =>
        buffer.getChannelData(c),
    );
    let peak = 0;
    for (const ch of data) {
        for (let i = 0; i < frames; i++) {
            const a = Math.abs(ch[i]);
            if (a > peak) peak = a;
        }
    }
    const scale = peak > 0 ? 0.944 / peak : 1;

    const bytesPerFrame = channels * 2;
    const out = new DataView(new ArrayBuffer(44 + frames * bytesPerFrame));
    const str = (at: number, s: string) => {
        for (let i = 0; i < s.length; i++)
            out.setUint8(at + i, s.charCodeAt(i));
    };
    str(0, "RIFF");
    out.setUint32(4, 36 + frames * bytesPerFrame, true);
    str(8, "WAVE");
    str(12, "fmt ");
    out.setUint32(16, 16, true);
    out.setUint16(20, 1, true); // PCM
    out.setUint16(22, channels, true);
    out.setUint32(24, buffer.sampleRate, true);
    out.setUint32(28, buffer.sampleRate * bytesPerFrame, true);
    out.setUint16(32, bytesPerFrame, true);
    out.setUint16(34, 16, true);
    str(36, "data");
    out.setUint32(40, frames * bytesPerFrame, true);
    let o = 44;
    for (let i = 0; i < frames; i++) {
        for (let c = 0; c < channels; c++) {
            const s = Math.max(-1, Math.min(1, data[c][i] * scale));
            out.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
            o += 2;
        }
    }
    return new Blob([out.buffer], { type: "audio/wav" });
}

/**
 * Turn a MIDI blob URL into a playable WAV blob URL. Always revokes the input
 * URL; the caller owns (and must revoke) the returned one.
 */
export async function midiUrlToWavUrl(midiUrl: string): Promise<string> {
    try {
        const data = await (await fetch(midiUrl)).arrayBuffer();
        // A copy goes to the worker (transferred), keeping `data` for the
        // fallback if there's no sound bank or its render fails.
        const sampled = await renderMidiWithSoundBank(data.slice(0)).catch(
            () => null,
        );
        if (sampled) return URL.createObjectURL(sampled);
        const rendered = await renderMidi(data);
        return URL.createObjectURL(encodeWav(rendered));
    } finally {
        URL.revokeObjectURL(midiUrl);
    }
}
