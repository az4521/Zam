/**
 * Messages between the real-time MIDI player (utils/midiStream.ts), its
 * AudioWorklet (midiPlayer.worklet.ts) and the bank prep worker
 * (midiBankPrep.worker.ts). Types only, so every side can import them.
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
    | { type: "seek"; time: number };

/** Replies. `id` is the song's id; 0 is the bank (an error with id 0 means the bank failed). */
export type WorkletOut =
    | { type: "bank" }
    /** Sent ~4 times a second while playing, and after each song load and control message. */
    | { type: "time"; id: number; currentTime: number; duration: number }
    | { type: "ended"; id: number }
    | { type: "error"; id: number; message: string };
