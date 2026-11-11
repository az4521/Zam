/**
 * zam.midi: the plugin-facing wrappers over Zam's MIDI engine (the live
 * synth in utils/pluginMidi.ts and the song player of utils/midiStream.ts).
 * Everything a plugin opens is closed when it unloads.
 */
import { interfaceState } from "../stores/interface.svelte";
import { parseMidi } from "../utils/midi";
import { midiDurationSeconds, openMidiStream } from "../utils/midiStream";
import { openPluginMidiSynth, pluginMidiAvailable } from "../utils/pluginMidi";
import type { Disposable, PluginMidiPlayer, PluginMidiSynth } from "./types";

type Listeners<A extends unknown[]> = Set<(...args: A) => void>;

function listen<A extends unknown[]>(
    set: Listeners<A>,
    cb: (...args: A) => void,
): Disposable {
    set.add(cb);
    return { dispose: () => void set.delete(cb) };
}

function emit<A extends unknown[]>(set: Listeners<A>, ...args: A): void {
    for (const cb of [...set]) {
        try {
            cb(...args);
        } catch (e) {
            console.error("[plugin] midi handler threw", e);
        }
    }
}

function int(name: string, v: number, min: number, max: number): number {
    if (!Number.isInteger(v) || v < min || v > max)
        throw new RangeError(`${name} must be an integer ${min}-${max}`);
    return v;
}

const lowPower = () => interfaceState.isMobile || interfaceState.isTouchscreen;

export function midiAvailable(): Promise<boolean> {
    return pluginMidiAvailable();
}

/** Open the live synth. `onOpen` gets the handle to close on unload. */
export async function openSynth(
    onOpen: (d: Disposable) => Disposable,
): Promise<PluginMidiSynth | null> {
    const preempted: Listeners<[]> = new Set();
    const raw = await openPluginMidiSynth(
        {
            onPreempted: () => emit(preempted),
            onBlocked: () => {},
            onError: () => emit(preempted),
        },
        { mobile: lowPower() },
    );
    if (!raw) return null;
    const hold = onOpen({ dispose: () => raw.close() });
    const send = (status: number, d1: number, d2: number) =>
        raw.send(status, d1, d2);
    const ch = (c: number) => int("channel", c, 0, 15);
    const b = (name: string, v: number) => int(name, v, 0, 127);
    return {
        noteOn: (c, note, vel) =>
            send(0x90 | ch(c), b("note", note), b("velocity", vel)),
        noteOff: (c, note) => send(0x80 | ch(c), b("note", note), 0),
        programChange: (c, program) =>
            send(0xc0 | ch(c), b("program", program), 0),
        controlChange: (c, controller, value) =>
            send(0xb0 | ch(c), b("controller", controller), b("value", value)),
        pitchBend: (c, value) => {
            const v = int("value", value, 0, 16383);
            send(0xe0 | ch(c), v & 0x7f, v >> 7);
        },
        allNotesOff: (channel) => {
            for (const c of channel === undefined
                ? [...Array(16).keys()]
                : [ch(channel)]) {
                // CC 123 (all notes off) lets release tails play; 120 (all
                // sound off) would cut them.
                send(0xb0 | c, 123, 0);
            }
        },
        onPreempted: (cb) => listen(preempted, cb),
        close: () => hold.dispose(),
    };
}

/** A song in a player. Throws on bytes that are not MIDI. */
export async function playSong(
    midi: ArrayBuffer | Uint8Array,
    onOpen: (d: Disposable) => Disposable,
): Promise<PluginMidiPlayer | null> {
    const bytes = new Uint8Array(
        midi instanceof Uint8Array
            ? midi.buffer.slice(
                  midi.byteOffset,
                  midi.byteOffset + midi.byteLength,
              )
            : midi.slice(0),
    ).buffer as ArrayBuffer;
    parseMidi(bytes);
    const time: Listeners<[number, number]> = new Set();
    const ended: Listeners<[]> = new Set();
    const preempted: Listeners<[]> = new Set();
    const blocked: Listeners<[]> = new Set();
    let duration = midiDurationSeconds(bytes);
    const stream = await openMidiStream(
        bytes,
        { mobile: lowPower() },
        {
            onTime: (t, d) => {
                duration = d;
                emit(time, t, d);
            },
            onPlaying: () => {},
            onEnded: () => emit(ended),
            onPreempted: () => emit(preempted),
            onBlocked: () => emit(blocked),
            onError: () => emit(ended),
        },
    );
    if (!stream) return null;
    const hold = onOpen({ dispose: () => stream.destroy() });
    return {
        play: () => stream.play(),
        pause: () => stream.pause(),
        seek: (t) => stream.seek(Math.max(0, Number(t) || 0)),
        get duration() {
            return duration;
        },
        onTime: (cb) => listen(time, cb),
        onEnded: (cb) => listen(ended, cb),
        onPreempted: (cb) => listen(preempted, cb),
        onBlocked: (cb) => listen(blocked, cb),
        close: () => hold.dispose(),
    };
}
