/**
 * The call's mic processing as a LiveKit audio processor: the user's mic
 * track runs through Zam's mic chain ($lib/audio/micChain: DeepFilterNet3
 * and/or AGC2) and LiveKit sends the chain's output instead.
 *
 * Runs in its own 48 kHz AudioContext rather than LiveKit's (whose rate
 * follows the output device): DeepFilterNet3 only works at 48 kHz. A device
 * switch only swaps the source node; the context, and a DeepFilterNet3
 * that has already loaded, carry over.
 *
 * A settings change mid-call goes through reconfigure(), which rebuilds the
 * chain inside this processor and keeps sending on the same track. Swapping
 * processors with LiveKit's setProcessor/stopProcessor instead re-applies the
 * mic's saved constraints first (applyConstraints), which can throw
 * OverconstrainedError right after a restart, and by then it has already
 * torn the old processor down, leaving the call sending a dead track.
 */
import type {
    AudioProcessorOptions,
    Track,
    TrackProcessor,
} from "livekit-client";
import {
    createMicChain,
    type MicChain,
    type MicChainOptions,
} from "./micChain";
import { DEEP_FILTER_SAMPLE_RATE } from "./deepFilter";

/** How long to wait for a suspended context before sending the raw mic. */
const RESUME_WAIT_MS = 300;
/** How long init waits for DeepFilterNet3 to splice in. The join compiles
 *  the model beforehand, so this only covers the worklet's own start-up. */
const DENOISE_WAIT_MS = 2000;

export type MicProcessor = TrackProcessor<
    Track.Kind.Audio,
    AudioProcessorOptions
> & {
    readonly config: MicChainOptions;
    /** Switch to another chain without LiveKit swapping the processor. */
    reconfigure(config: MicChainOptions): Promise<void>;
};

/** Neither stage: the raw mic, still sent through this processor. */
export const PASSTHROUGH_CHAIN: MicChainOptions = {
    denoise: null,
    level: false,
};

export function createMicProcessor(initial: MicChainOptions): MicProcessor {
    let config = initial;
    let ctx: AudioContext | null = null;
    let chain: MicChain | null = null;
    let dest: MediaStreamAudioDestinationNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;

    const teardown = () => {
        source?.disconnect();
        source = null;
        chain?.destroy();
        chain = null;
        dest?.stream.getTracks().forEach((t) => t.stop());
        dest = null;
        if (ctx) void ctx.close().catch(() => {});
        ctx = null;
        processor.processedTrack = undefined;
    };

    const init = async ({ track }: AudioProcessorOptions): Promise<void> => {
        teardown();
        try {
            ctx = new AudioContext({ sampleRate: DEEP_FILTER_SAMPLE_RATE });
            if (ctx.state !== "running")
                await Promise.race([
                    ctx.resume().catch(() => {}),
                    new Promise((r) => setTimeout(r, RESUME_WAIT_MS)),
                ]);
            // A context that won't run would send silence; with no
            // processedTrack LiveKit sends the raw mic instead.
            if (ctx.state !== "running") throw new Error("context suspended");
            chain = createMicChain(ctx, config);
            dest = ctx.createMediaStreamDestination();
            chain.output.connect(dest);
            // Throws where a 48 kHz context can't take a mic at another rate
            // (older Firefox): fall back to the raw mic.
            source = ctx.createMediaStreamSource(new MediaStream([track]));
            source.connect(chain.input);
            const ready = chain.denoiseReady;
            await Promise.race([
                ready,
                new Promise((r) => setTimeout(r, DENOISE_WAIT_MS)),
            ]);
            processor.processedTrack = dest.stream.getAudioTracks()[0];
        } catch (err) {
            console.warn("Mic processing unavailable, sending raw mic:", err);
            teardown();
        }
    };

    const restart = async (opts: AudioProcessorOptions): Promise<void> => {
        if (!ctx || !chain || ctx.state === "closed") return init(opts);
        source?.disconnect();
        try {
            source = ctx.createMediaStreamSource(new MediaStream([opts.track]));
            source.connect(chain.input);
        } catch {
            await init(opts);
        }
    };

    const reconfigure = async (next: MicChainOptions): Promise<void> => {
        if (next.denoise === config.denoise && next.level === config.level)
            return;
        config = next;
        // Not running (init failed or not yet called): the next init uses it.
        if (!ctx || !chain || !dest || !source || ctx.state === "closed")
            return;
        const old = chain;
        const fresh = createMicChain(ctx, config);
        chain = fresh;
        source.connect(fresh.input);
        // Keep sending the old chain until DeepFilterNet3 is in the new one.
        await Promise.race([
            fresh.denoiseReady,
            new Promise((r) => setTimeout(r, DENOISE_WAIT_MS)),
        ]);
        if (chain !== fresh || !dest) {
            fresh.destroy();
            return;
        }
        fresh.output.connect(dest);
        old.destroy();
    };

    const processor: MicProcessor = {
        name: "zam-mic-processor",
        get config() {
            return config;
        },
        reconfigure,
        processedTrack: undefined,
        init,
        restart,
        async destroy() {
            teardown();
        },
    };
    return processor;
}
