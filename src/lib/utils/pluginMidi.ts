/**
 * Live synth for plugins: raw MIDI notes played through Zam's sound bank, on
 * the same engine that plays songs (utils/midiStream.ts). A plugin gets a
 * handle, sends channel messages, and closes it when done.
 */
import { MidiLiveSynth } from "./midiStream";
import { findPlaybackSoundBank } from "./midiSoundBank";

export interface PluginMidiSynthHandle {
    send(status: number, data1: number, data2: number): void;
    close(): void;
}

export interface PluginMidiSynthEvents {
    onPreempted: () => void;
    onBlocked: () => void;
    onError: () => void;
}

/**
 * Resolves null when this device can't (no AudioWorklet or no sound bank).
 * Rejects if audio is blocked (autoplay policy: must be called from a click).
 * Calls claim synchronously before any await.
 */
export async function openPluginMidiSynth(
    events: PluginMidiSynthEvents,
    opts?: { mobile?: boolean },
): Promise<PluginMidiSynthHandle | null> {
    if (typeof AudioWorkletNode === "undefined") return null;
    const synth = new MidiLiveSynth({ mobile: opts?.mobile ?? false }, events);
    const live = await synth.open();
    if (!live) return null;
    return {
        send: (status, data1, data2) => live.send(status, data1, data2),
        close: () => live.close(),
    };
}

/** Whether a live synth (or MIDI playback) can run here: AudioWorklet + a sound bank. */
export async function pluginMidiAvailable(): Promise<boolean> {
    if (typeof AudioWorkletNode === "undefined") return false;
    try {
        return (await findPlaybackSoundBank()) !== null;
    } catch {
        return false;
    }
}
