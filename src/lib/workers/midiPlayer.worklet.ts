/**
 * Real-time MIDI synthesis for utils/midiStream.ts. Runs in the audio thread:
 * spessasynth_core plays the song block by block, so playback starts without
 * rendering the whole file to WAV first. Loaded with `?worker&url` so the
 * synth is bundled into this one file (an AudioWorklet can't import modules).
 *
 * The sound bank arrives once ("bank"); songs then come one at a time
 * ("song"), each with an id that every reply carries, so the main side can
 * drop replies for a song it has already moved on from.
 *
 * spessasynth_core's TextDecoder and TextEncoder calls are all in name and
 * metadata helpers this file never reaches (BasicMIDI.fromArrayBuffer and
 * SoundBankLoader.fromArrayBuffer only read binary data), so the worklet
 * scope needs no polyfill.
 */
import {
    BasicMIDI,
    InterpolationTypes,
    SoundBankLoader,
    SpessaSynthProcessor,
    SpessaSynthSequencer,
} from "spessasynth_core";
import {
    applyChannelMessage,
    type WorkletIn,
    type WorkletOut,
} from "./midiPlayer.messages";

/** The worklet global scope's own names, typed here since DOM lib omits them. */
const scope = globalThis as unknown as {
    AudioWorkletProcessor: new () => {
        readonly port: MessagePort;
    };
    registerProcessor: (
        name: string,
        ctor: new () => AudioWorkletProcessor,
    ) => void;
    sampleRate: number;
};

interface AudioWorkletProcessor {
    readonly port: MessagePort;
    process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
}

const BLOCK = 128;
/** Voice cap on phones and tablets (the synth default is 350). */
const MOBILE_VOICE_CAP = 96;
/** Reverb and release tail played after the last event, then "ended". */
const TAIL_SECONDS = 2;
/** MIDI channel controller 121: resets that channel's controllers to their defaults. */
const RESET_ALL_CONTROLLERS = 121;
/** How often "time" is posted, in seconds of audio. */
const REPORT_SECONDS = 0.25;

class MidiPlayerProcessor extends scope.AudioWorkletProcessor {
    private synth: SpessaSynthProcessor | null = null;
    private seq: SpessaSynthSequencer | null = null;
    /** Id of the song in the sequencer; 0 until the first song loads. */
    private songId = 0;
    /** What the user asked for. A finished song still counts as playing until its tail is out. */
    private playing = false;
    /** Live mode: the synth renders without a song, for notes sent as "midi". */
    private live = false;
    /** Live mode is off: frames left to render while the last voices and reverb decay. */
    private liveTail = 0;
    private tailFrames = 0;
    private framesSinceReport = 0;
    private readonly reportFrames = Math.round(
        REPORT_SECONDS * scope.sampleRate,
    );
    private readonly tailTotal = Math.round(TAIL_SECONDS * scope.sampleRate);

    constructor() {
        super();
        this.port.onmessage = (e: MessageEvent<WorkletIn>) =>
            this.handle(e.data);
    }

    private post(msg: WorkletOut): void {
        this.port.postMessage(msg);
    }

    private report(): void {
        const seq = this.seq;
        if (!seq || this.songId === 0) return;
        this.framesSinceReport = 0;
        this.post({
            type: "time",
            id: this.songId,
            currentTime: seq.currentTime,
            duration: seq.duration,
        });
    }

    private handle(msg: WorkletIn): void {
        switch (msg.type) {
            case "bank":
                void this.loadBank(msg);
                return;
            case "song":
                this.loadSong(msg);
                return;
            case "midi":
                this.playLive(msg);
                return;
            case "live":
                this.setLive(msg.on);
                return;
        }
        const seq = this.seq;
        if (!seq) return;
        switch (msg.type) {
            case "play":
                this.playing = true;
                // After the song ends the sequencer sits paused at the end;
                // a play from there starts the song again.
                if (seq.isFinished) {
                    seq.isFinished = false;
                    seq.currentTime = 0;
                }
                this.tailFrames = this.tailTotal;
                if (seq.paused) seq.play();
                this.report();
                break;
            case "pause":
                this.playing = false;
                if (!seq.paused) seq.pause();
                this.report();
                break;
            case "seek":
                if (seq.isFinished) seq.isFinished = false;
                seq.currentTime = Math.min(Math.max(0, msg.time), seq.duration);
                this.tailFrames = this.tailTotal;
                // A seek after the song ended resumes it if the user is playing.
                if (this.playing && seq.paused) seq.play();
                this.report();
                break;
        }
    }

    private async loadBank(msg: Extract<WorkletIn, { type: "bank" }>) {
        try {
            const bank = SoundBankLoader.fromArrayBuffer(msg.bank);
            // Opus samples were decoded on the main side (midiBankPrep.worker);
            // the synth can't read them, so their PCM replaces the bytes.
            for (const s of msg.samples) {
                bank.samples[s.index].setAudioData(s.pcm, s.sampleRate);
            }
            const synth = new SpessaSynthProcessor(scope.sampleRate, {
                maxBufferSize: BLOCK,
                eventsEnabled: false,
            });
            synth.setSystemParameter(
                "interpolationType",
                msg.mobile
                    ? InterpolationTypes.linear
                    : InterpolationTypes.hermite,
            );
            if (msg.mobile) {
                synth.setSystemParameter("voiceCap", MOBILE_VOICE_CAP);
            }
            synth.soundBankManager.addSoundBank(bank, "main");
            await synth.processorInitialized;
            const seq = new SpessaSynthSequencer(synth);
            seq.loopCount = 0;
            this.synth = synth;
            this.seq = seq;
            this.post({ type: "bank" });
        } catch (err) {
            this.post({
                type: "error",
                id: 0,
                message: err instanceof Error ? err.message : String(err),
            });
        }
    }

    /**
     * Swaps in a new song, paused at 0. Notes from the last song stop at once.
     * The sequencer's load then seeks to 0, which sends the synth a reset, so
     * every channel's controllers go back to their defaults.
     */
    private loadSong(msg: Extract<WorkletIn, { type: "song" }>): void {
        const synth = this.synth;
        const seq = this.seq;
        if (!synth || !seq) return;
        try {
            const song = BasicMIDI.fromArrayBuffer(msg.midi);
            // A song with no length would leave the sequencer on the old one.
            if (!(song.duration > 0)) throw new Error("MIDI has no duration");
            this.songId = 0;
            this.playing = false;
            this.live = false;
            this.liveTail = 0;
            seq.pause();
            synth.stopAllChannels(true);
            seq.loadNewSongList([song]);
            this.songId = msg.id;
            this.tailFrames = 0;
            this.framesSinceReport = 0;
            this.report();
        } catch (err) {
            this.post({
                type: "error",
                id: msg.id,
                message: err instanceof Error ? err.message : String(err),
            });
        }
    }

    /**
     * Entering live mode stops the song (paused where it was) and resets every
     * channel's controllers. Leaving it stops the live notes, and the synth
     * keeps rendering their release and reverb tail.
     */
    private setLive(on: boolean): void {
        const synth = this.synth;
        const seq = this.seq;
        if (!synth || !seq) return;
        if (on) {
            if (this.live) return;
            this.live = true;
            this.liveTail = 0;
            this.playing = false;
            if (!seq.paused) seq.pause();
            synth.stopAllChannels(true);
            for (let channel = 0; channel < 16; channel++) {
                synth.controllerChange(channel, RESET_ALL_CONTROLLERS, 0);
            }
        } else {
            if (!this.live) return;
            this.live = false;
            synth.stopAllChannels(false);
            this.liveTail = this.tailTotal;
        }
    }

    private playLive(msg: Extract<WorkletIn, { type: "midi" }>): void {
        const synth = this.synth;
        if (!synth || !this.live) return;
        applyChannelMessage(synth, msg.status, msg.data1, msg.data2);
    }

    process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
        const out = outputs[0];
        const left = out?.[0];
        if (!left) return true;
        const right = out[1] ?? left;
        const seq = this.seq;
        const synth = this.synth;
        if (!seq || !synth) {
            left.fill(0);
            right.fill(0);
            return true;
        }
        const frames = left.length;
        if (!this.playing) {
            if (!this.live && this.liveTail <= 0) {
                left.fill(0);
                right.fill(0);
                return true;
            }
            // Live notes, or the tail after them: render until it has decayed.
            synth.process(left, right, 0, frames);
            if (!this.live) {
                this.liveTail =
                    synth.voiceCount > 0
                        ? this.tailTotal
                        : this.liveTail - frames;
            }
            return true;
        }
        if (!seq.isFinished) {
            seq.processTick();
            this.framesSinceReport += frames;
            if (this.framesSinceReport >= this.reportFrames) this.report();
        }
        synth.process(left, right, 0, frames);
        if (seq.isFinished) {
            this.tailFrames -= frames;
            if (this.tailFrames <= 0) {
                this.playing = false;
                this.report();
                this.post({ type: "ended", id: this.songId });
            }
        }
        return true;
    }
}

scope.registerProcessor("zam-midi-player", MidiPlayerProcessor);
