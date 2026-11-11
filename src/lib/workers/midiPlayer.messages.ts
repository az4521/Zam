/**
 * Messages between the real-time MIDI player (utils/midiStream.ts), its
 * AudioWorklet (midiPlayer.worklet.ts) and the bank prep worker
 * (midiBankPrep.worker.ts). Mostly types, so every side can import them; the
 * few pure helpers at the end have no dependencies, so the worklet and the
 * tests can use them too.
 */

/** A sample the bank stores compressed, decoded to mono float PCM. */
export interface DecodedSample {
    /** Index into the bank's `samples` (same parse order on both sides). */
    index: number;
    sampleRate: number;
    pcm: Float32Array;
}

export interface BankPrepRequest {
    bank: ArrayBuffer;
}

export type BankPrepResponse = { samples: DecodedSample[] } | { error: string };

export type WorkletIn =
    /** Once per engine: the bank and its decoded samples move to the worklet. */
    | {
          type: "bank";
          bank: ArrayBuffer;
          samples: DecodedSample[];
          /** Linear interpolation and fewer voices, for phones and tablets. */
          mobile: boolean;
      }
    /** A new song, replacing the current one. `id` tags every reply about it. */
    | { type: "song"; id: number; midi: ArrayBuffer }
    | { type: "play" }
    | { type: "pause" }
    | { type: "seek"; time: number }
    /** One raw channel voice message (status 0x80-0xEF), played live. */
    | { type: "midi"; status: number; data1: number; data2: number }
    /** Live mode: on stops the song and renders the synth; off stops its notes. */
    | { type: "live"; on: boolean };

/** Replies. `id` is the song's id; 0 is the bank (an error with id 0 means the bank failed). */
export type WorkletOut =
    | { type: "bank" }
    /** Sent ~4 times a second while playing, and after each song load and control message. */
    | { type: "time"; id: number; currentTime: number; duration: number }
    | { type: "ended"; id: number }
    | { type: "error"; id: number; message: string };

/**
 * Throws RangeError unless `status` is a channel voice status (0x80-0xEF) and
 * both data bytes are 7-bit integers (0-127). Unused data bytes must still be
 * valid numbers.
 */
export function checkChannelMessage(
    status: number,
    data1: number,
    data2: number,
): void {
    if (!Number.isInteger(status) || status < 0x80 || status > 0xef) {
        throw new RangeError(`MIDI status out of range: ${status}`);
    }
    for (const data of [data1, data2]) {
        if (!Number.isInteger(data) || data < 0 || data > 127) {
            throw new RangeError(`MIDI data byte out of range: ${data}`);
        }
    }
}

/** The synth calls a channel voice message can map to. spessasynth_core's SpessaSynthProcessor fits. */
export interface ChannelSynth {
    noteOn(channel: number, note: number, velocity: number): void;
    noteOff(channel: number, note: number): void;
    polyPressure(channel: number, note: number, pressure: number): void;
    channelPressure(channel: number, pressure: number): void;
    controllerChange(channel: number, controller: number, value: number): void;
    programChange(channel: number, program: number): void;
    /** 14-bit value, 8192 is centre. */
    pitchWheel(channel: number, pitch: number): void;
}

/**
 * Plays one raw channel voice message on `synth`. Note on with velocity 0 is a
 * note off. Pitch bend is data1 = LSB, data2 = MSB. Messages with a status
 * outside 0x80-0xEF are ignored.
 */
export function applyChannelMessage(
    synth: ChannelSynth,
    status: number,
    data1: number,
    data2: number,
): void {
    const channel = status & 0x0f;
    switch (status & 0xf0) {
        case 0x80:
            synth.noteOff(channel, data1);
            return;
        case 0x90:
            if (data2 === 0) synth.noteOff(channel, data1);
            else synth.noteOn(channel, data1, data2);
            return;
        case 0xa0:
            synth.polyPressure(channel, data1, data2);
            return;
        case 0xb0:
            synth.controllerChange(channel, data1, data2);
            return;
        case 0xc0:
            synth.programChange(channel, data1);
            return;
        case 0xd0:
            synth.channelPressure(channel, data1);
            return;
        case 0xe0:
            synth.pitchWheel(channel, data1 | (data2 << 7));
            return;
    }
}
