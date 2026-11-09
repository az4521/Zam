/**
 * Real-time MIDI playback through the sound bank. The song is synthesized as
 * it plays (workers/midiPlayer.worklet.ts), so it starts at once rather than
 * after midiUrlToWavUrl has rendered the whole file. Opens only when there is
 * a bank and AudioWorklet; otherwise it resolves null and the caller uses the
 * WAV path (which also covers the WebAudio oscillator fallback).
 *
 * One engine serves every player: a single AudioContext and worklet hold the
 * sound bank, and each player's song is swapped in when it starts. A player
 * is a MidiStream handle; only one handle owns the engine at a time, and the
 * others are paused where they were. The engine goes away after a minute
 * without playback, so the bank's memory comes back.
 */
import midiPlayerWorkletUrl from "$lib/workers/midiPlayer.worklet.ts?worker&url";
import type {
    BankPrepRequest,
    BankPrepResponse,
    DecodedSample,
    WorkletIn,
    WorkletOut,
} from "$lib/workers/midiPlayer.messages";
import { parseMidi } from "./midi";
import { findPlaybackSoundBank, type SoundBank } from "./midiSoundBank";

export interface MidiStreamEvents {
    /** Playback position and song length, in seconds. About 4 a second. */
    onTime: (currentTime: number, duration: number) => void;
    /** Audio is running for this player. */
    onPlaying: () => void;
    onEnded: () => void;
    /** Another player took the engine. This one stays where it is; play() resumes it there. */
    onPreempted: () => void;
    /** The browser won't start audio (autoplay policy). Paused; the next play() retries. */
    onBlocked: () => void;
    /** The song or the bank couldn't play. The caller should destroy the stream and use the WAV path. */
    onError: () => void;
}

export interface MidiStreamOptions {
    /** Phones and tablets: linear interpolation and a lower voice cap. */
    mobile: boolean;
}

/** Engine news for the player that owns it. */
type OwnerEvent =
    | { type: "time"; currentTime: number; duration: number }
    | { type: "playing" }
    | { type: "ended" }
    | { type: "preempted" }
    | { type: "blocked" }
    | { type: "error" };

/** Time with nothing playing before the engine tears down. */
const IDLE_MS = 60_000;
/** How long a resume may take before the browser counts as having blocked audio. */
const RESUME_WAIT_MS = 1000;

/** Song ids are unique across the page, so a late reply can't match a newer song. */
let nextSongId = 1;

/** A bank ready to hand to the worklet. The buffers move there, so this is used once. */
interface PreparedBank {
    key: string;
    data: ArrayBuffer;
    samples: DecodedSample[];
}

/**
 * Decodes the bank's Opus samples in a short-lived worker. The worker is
 * terminated once it answers, so nothing is kept between songs.
 */
function prepareBank(bank: ArrayBuffer): Promise<DecodedSample[]> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(
            new URL("../workers/midiBankPrep.worker.ts", import.meta.url),
            { type: "module" },
        );
        worker.onmessage = (e: MessageEvent<BankPrepResponse>) => {
            worker.terminate();
            if ("samples" in e.data) resolve(e.data.samples);
            else reject(new Error(e.data.error));
        };
        worker.onerror = () => {
            worker.terminate();
            reject(new Error("MIDI bank worker failed"));
        };
        const msg: BankPrepRequest = { bank };
        worker.postMessage(msg, [bank]);
    });
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One player. Its song is loaded into the engine when it plays, and it keeps
 * its position so it can pick up there again after another player took over.
 */
export class MidiStream {
    /** Where the song was last heard, in seconds. Loading the song seeks here. */
    position = 0;
    private wantPlay = false;
    private closed = false;
    private readonly midi: ArrayBuffer;
    /** @internal Read by the engine when it builds the worklet. */
    readonly mobile: boolean;
    private readonly events: MidiStreamEvents;

    constructor(
        midi: ArrayBuffer,
        options: MidiStreamOptions,
        events: MidiStreamEvents,
    ) {
        this.midi = midi;
        this.mobile = options.mobile;
        this.events = events;
    }

    /** True from play() until pause, the end, a preemption or a block. */
    get isPlaying(): boolean {
        return this.wantPlay;
    }

    /** Starts this song. Call it from a click where the browser allows audio. */
    play(): void {
        if (this.closed || this.wantPlay) return;
        this.wantPlay = true;
        engine.claim(this);
    }

    pause(): void {
        if (!this.wantPlay) return;
        this.wantPlay = false;
        engine.pause(this);
    }

    seek(time: number): void {
        this.position = time;
        engine.seek(this, time);
    }

    /** Device-local volume and mute (see rememberVolume.ts). Shared by every player. */
    setVolume(volume: number, muted: boolean): void {
        engine.setVolume(volume, muted);
    }

    destroy(): void {
        if (this.closed) return;
        this.closed = true;
        this.wantPlay = false;
        engine.release(this);
    }

    /** @internal Called by the engine for the player that owns it. */
    engineEvent(ev: OwnerEvent): void {
        if (this.closed) return;
        switch (ev.type) {
            case "time":
                this.position = ev.currentTime;
                this.events.onTime(ev.currentTime, ev.duration);
                break;
            case "playing":
                this.events.onPlaying();
                break;
            case "ended":
                this.wantPlay = false;
                // A replay from the start, should the engine have let go of it.
                this.position = 0;
                this.events.onEnded();
                break;
            case "preempted":
                if (!this.wantPlay) return;
                this.wantPlay = false;
                this.events.onPreempted();
                break;
            case "blocked":
                this.wantPlay = false;
                this.events.onBlocked();
                break;
            case "error":
                this.wantPlay = false;
                this.events.onError();
                break;
        }
    }

    /** @internal The engine copies the bytes per song, since a load moves them. */
    copyMidi(): ArrayBuffer {
        return this.midi.slice(0);
    }
}

/**
 * The shared synth. Holds one AudioContext and one worklet node, and the id
 * of the song loaded for the owner. Methods are called from MidiStream.
 */
class MidiEngine {
    private ctx: AudioContext | null = null;
    private gain: GainNode | null = null;
    /** addModule() on the context. A context takes the worklet only once. */
    private moduleReady: Promise<void> | null = null;
    /** The resume() asked for by the latest play(), when audio wasn't running. */
    private resuming: Promise<void> | null = null;
    private node: AudioWorkletNode | null = null;
    /** The bank the node holds, or is loading. */
    private bankKey: string | null = null;
    /** Settles once the worklet has the bank: true if it can play songs. */
    private bankLoaded: Promise<boolean> | null = null;
    private bankDone: ((ok: boolean) => void) | null = null;
    /** Bumped when the node is dropped, so a build still in flight stops. */
    private epoch = 0;
    /** A bank decoded ahead of play (see warm). */
    private warmed: { key: string; prepared: Promise<PreparedBank> } | null =
        null;
    private owner: MidiStream | null = null;
    /** Id of the owner's song in the worklet; 0 while there is none. */
    private songId = 0;
    private idleTimer: ReturnType<typeof setTimeout> | null = null;
    private volume = 1;
    private muted = false;

    /**
     * Finds the bank and starts decoding it, so the first play doesn't wait
     * for the decode. Resolves false when there is no bank.
     */
    async warm(): Promise<boolean> {
        this.scheduleIdle();
        const found = await findPlaybackSoundBank();
        if (!found) return false;
        if (this.bankKey !== found.key && this.warmed?.key !== found.key) {
            const data = found.data;
            const prepared = prepareBank(data.slice(0)).then((samples) => ({
                key: found.key,
                data,
                samples,
            }));
            // Only a play takes this; a failure then surfaces there.
            prepared.catch(() => {});
            this.warmed = { key: found.key, prepared };
        }
        return true;
    }

    /**
     * Makes `handle` the owner and starts its song. The context is made and
     * resumed here, synchronously, so this has to run inside the click.
     */
    claim(handle: MidiStream): void {
        this.cancelIdle();
        if (this.owner !== handle) {
            const prev = this.owner;
            this.owner = handle;
            // Anything the worklet still has from the last owner is now stale.
            this.songId = 0;
            this.post({ type: "pause" });
            prev?.engineEvent({ type: "preempted" });
        }
        this.ensureContext();
        void this.start(handle);
    }

    pause(handle: MidiStream): void {
        if (this.owner !== handle) return;
        this.post({ type: "pause" });
        this.scheduleIdle();
    }

    seek(handle: MidiStream, time: number): void {
        if (this.owner === handle && this.songId !== 0) {
            this.post({ type: "seek", time });
        }
    }

    /** The handle is closing. Its song stays in the worklet until another takes over. */
    release(handle: MidiStream): void {
        if (this.owner !== handle) return;
        this.post({ type: "pause" });
        this.owner = null;
        this.songId = 0;
        this.scheduleIdle();
    }

    setVolume(volume: number, muted: boolean): void {
        this.volume = volume;
        this.muted = muted;
        if (this.gain) this.gain.gain.value = muted ? 0 : volume;
    }

    private ensureContext(): void {
        if (!this.ctx) {
            const ctx = new AudioContext();
            const gain = ctx.createGain();
            gain.gain.value = this.muted ? 0 : this.volume;
            gain.connect(ctx.destination);
            const moduleReady =
                ctx.audioWorklet.addModule(midiPlayerWorkletUrl);
            moduleReady.catch(() => {});
            this.ctx = ctx;
            this.gain = gain;
            this.moduleReady = moduleReady;
        }
        if (this.ctx.state !== "running") {
            this.resuming = this.ctx.resume().catch(() => {});
        }
    }

    /** Whether audio is running. A resume the browser refuses leaves it suspended. */
    private async unlocked(ctx: AudioContext): Promise<boolean> {
        if (ctx.state !== "running") {
            await Promise.race([
                this.resuming ?? Promise.resolve(),
                wait(RESUME_WAIT_MS),
            ]);
        }
        return ctx.state === "running";
    }

    /**
     * Loads the bank if it changed, then the owner's song, then plays. Each
     * step re-checks that `handle` still owns the engine and still wants to play.
     */
    private async start(handle: MidiStream): Promise<void> {
        try {
            const found = await findPlaybackSoundBank();
            if (this.owner !== handle) return;
            if (!found) return this.fail(handle);
            if (this.bankKey !== found.key) {
                const prepared = await this.takeBank(found);
                if (this.owner !== handle) {
                    // Keep the decode for the next attempt.
                    this.warmed = {
                        key: prepared.key,
                        prepared: Promise.resolve(prepared),
                    };
                    return;
                }
                this.dropNode();
                this.bankKey = prepared.key;
                this.bankLoaded = this.buildNode(prepared, handle.mobile);
            }
            const loaded = (await this.bankLoaded) ?? false;
            if (this.owner !== handle) return;
            if (!loaded) {
                this.dropNode();
                return this.fail(handle);
            }
            const ctx = this.ctx;
            if (!ctx) return;
            if (!(await this.unlocked(ctx))) {
                if (this.owner === handle) {
                    handle.engineEvent({ type: "blocked" });
                    this.scheduleIdle();
                }
                return;
            }
            if (this.owner !== handle || !handle.isPlaying) return;
            if (this.songId === 0) this.sendSong(handle);
            this.post({ type: "play" });
            handle.engineEvent({ type: "playing" });
            this.cancelIdle();
        } catch {
            if (this.owner === handle) this.fail(handle);
        }
    }

    /** The bank for `found`: the warm decode when it matches, else a fresh one. */
    private takeBank(found: SoundBank): Promise<PreparedBank> {
        const warm = this.warmed;
        this.warmed = null;
        if (warm?.key === found.key) return warm.prepared;
        const data = found.data;
        return prepareBank(data.slice(0)).then((samples) => ({
            key: found.key,
            data,
            samples,
        }));
    }

    /**
     * Creates the worklet node and hands it the bank. Resolves once the
     * worklet confirms, false if it failed or the node was dropped meanwhile.
     */
    private async buildNode(
        prepared: PreparedBank,
        mobile: boolean,
    ): Promise<boolean> {
        const ctx = this.ctx;
        const gain = this.gain;
        const moduleReady = this.moduleReady;
        if (!ctx || !gain || !moduleReady) return false;
        const epoch = this.epoch;
        try {
            await moduleReady;
        } catch {
            return false;
        }
        if (epoch !== this.epoch) return false;
        const node = new AudioWorkletNode(ctx, "zam-midi-player", {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [2],
        });
        node.port.onmessage = (e: MessageEvent<WorkletOut>) =>
            this.onWorklet(e.data);
        node.connect(gain);
        this.node = node;
        const msg: WorkletIn = {
            type: "bank",
            bank: prepared.data,
            samples: prepared.samples,
            mobile,
        };
        // Once per bank: the buffers move to the worklet, no copies.
        node.port.postMessage(msg, [
            prepared.data,
            ...prepared.samples.map((s) => s.pcm.buffer),
        ]);
        return new Promise<boolean>((resolve) => {
            this.bankDone = resolve;
        });
    }

    /** Sends the owner's song, at the position it last reached. */
    private sendSong(handle: MidiStream): void {
        const id = nextSongId++;
        this.songId = id;
        const midi = handle.copyMidi();
        this.post({ type: "song", id, midi }, [midi]);
        if (handle.position > 0) {
            this.post({ type: "seek", time: handle.position });
        }
    }

    private onWorklet(msg: WorkletOut): void {
        switch (msg.type) {
            case "bank":
                this.settleBank(true);
                return;
            case "error": {
                if (msg.id === 0) {
                    this.settleBank(false);
                    return;
                }
                if (msg.id !== this.songId || !this.owner) return;
                this.songId = 0;
                this.owner.engineEvent({ type: "error" });
                this.scheduleIdle();
                return;
            }
            case "time":
                if (msg.id !== this.songId) return;
                this.owner?.engineEvent({
                    type: "time",
                    currentTime: msg.currentTime,
                    duration: msg.duration,
                });
                return;
            case "ended":
                if (msg.id !== this.songId || !this.owner) return;
                this.owner.engineEvent({ type: "ended" });
                this.scheduleIdle();
                return;
        }
    }

    private fail(handle: MidiStream): void {
        this.songId = 0;
        handle.engineEvent({ type: "error" });
        this.scheduleIdle();
    }

    private settleBank(ok: boolean): void {
        const done = this.bankDone;
        this.bankDone = null;
        done?.(ok);
    }

    /** Drops the worklet node, and with it the bank it holds. */
    private dropNode(): void {
        this.epoch++;
        this.settleBank(false);
        if (this.node) {
            this.node.port.onmessage = null;
            this.node.port.close();
            this.node.disconnect();
        }
        this.node = null;
        this.bankKey = null;
        this.bankLoaded = null;
        this.songId = 0;
    }

    private post(msg: WorkletIn, transfer: Transferable[] = []): void {
        this.node?.port.postMessage(msg, transfer);
    }

    private scheduleIdle(): void {
        this.cancelIdle();
        this.idleTimer = setTimeout(() => {
            this.idleTimer = null;
            // Never while something is, or is about to be, playing.
            if (this.owner?.isPlaying) return;
            this.teardown();
        }, IDLE_MS);
    }

    private cancelIdle(): void {
        if (this.idleTimer !== null) clearTimeout(this.idleTimer);
        this.idleTimer = null;
    }

    /** Frees the bank, the worklet and the AudioContext. The next play rebuilds them. */
    private teardown(): void {
        this.dropNode();
        void this.ctx?.close().catch(() => {});
        this.ctx = null;
        this.gain = null;
        this.moduleReady = null;
        this.resuming = null;
        this.warmed = null;
        this.owner = null;
    }
}

const engine = new MidiEngine();

/**
 * A real-time player for a MIDI file's bytes, or null when this device can't
 * (no AudioWorklet, or no sound bank). The bank starts decoding here; no
 * audio starts until play().
 */
export async function openMidiStream(
    midi: ArrayBuffer,
    options: MidiStreamOptions,
    events: MidiStreamEvents,
): Promise<MidiStream | null> {
    if (typeof AudioWorkletNode === "undefined") return null;
    if (!(await engine.warm())) return null;
    return new MidiStream(midi, options, events);
}

/** Song length from the file itself, for the player before the synth reports one. */
export function midiDurationSeconds(midi: ArrayBuffer): number {
    try {
        return parseMidi(midi).duration;
    } catch {
        return 0;
    }
}
