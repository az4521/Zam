/**
 * Loads FastEnhancer (fastenhancer.worklet.js, running fastenhancer.wasm
 * with the Base model's weights) into an AudioContext: Zam's default noise
 * suppression for the user's own mic. It needs a 48 kHz context, an
 * AudioWorklet and WebAssembly SIMD (the same as DeepFilterNet3), and
 * nothing else: no download (the 72 KB module and 400 KB of weights ship
 * with the app) and no ONNX runtime.
 */
// no-inline: a data: URL worklet module could be refused by a CSP.
import fastEnhancerWorkletUrl from "./fastenhancer.worklet.js?url&no-inline";
import fastEnhancerWasmUrl from "./fastenhancer.wasm?url";
import fastEnhancerWeightsUrl from "./fastenhancer_b.bin?url";
import { FE_DELAY, FE_SAMPLE_RATE } from "./fastenhancer.worklet.js";
import { deepFilterSupported } from "./deepFilter";

export const FASTENHANCER_SAMPLE_RATE = FE_SAMPLE_RATE;
/** Delay FastEnhancer adds, in seconds. */
export const FASTENHANCER_DELAY_S = FE_DELAY / FE_SAMPLE_RATE;

/** Same needs as DeepFilterNet3: AudioWorklet, WebAssembly and its SIMD. */
export function fastEnhancerSupported(): boolean {
    return deepFilterSupported();
}

let files: Promise<[ArrayBuffer, ArrayBuffer]> | null = null;
const loaded = new WeakMap<BaseAudioContext, Promise<void>>();

function loadFiles(): Promise<[ArrayBuffer, ArrayBuffer]> {
    if (!files) {
        const get = (url: string) =>
            fetch(url).then((r) => {
                if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
                return r.arrayBuffer();
            });
        files = Promise.all([
            get(fastEnhancerWasmUrl),
            get(fastEnhancerWeightsUrl),
        ]);
        files.catch(() => (files = null));
    }
    return files;
}

export async function createFastEnhancerNode(
    ctx: BaseAudioContext,
): Promise<AudioWorkletNode> {
    if (ctx.sampleRate !== FE_SAMPLE_RATE)
        throw new Error(`FastEnhancer needs 48 kHz, got ${ctx.sampleRate}`);
    let ready = loaded.get(ctx);
    if (!ready) {
        ready = ctx.audioWorklet.addModule(fastEnhancerWorkletUrl);
        loaded.set(ctx, ready);
        ready.catch(() => loaded.delete(ctx));
    }
    const [, [wasm, weights]] = await Promise.all([ready, loadFiles()]);
    return new AudioWorkletNode(ctx, "zam-fastenhancer", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: "explicit",
        outputChannelCount: [1],
        // Copied per node; ~0.5 MB together.
        processorOptions: { wasm, weights },
    });
}

/** Fetch the files ahead of a call, so the mic goes live without waiting. */
export function prepareFastEnhancer(): Promise<boolean> {
    if (!fastEnhancerSupported()) return Promise.resolve(false);
    return loadFiles().then(
        () => true,
        () => false,
    );
}
