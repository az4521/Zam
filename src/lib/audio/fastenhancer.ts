/**
 * Loads FastEnhancer (fastenhancer.worklet.js, running fastenhancer.wasm)
 * into an AudioContext: Zam's default noise suppression for the user's own
 * mic, in two sizes. Base (400 KB of weights) is the default; Tiny (110 KB,
 * about a third of Base's CPU: 0.45 against 1.5 ms per 10.7 ms hop on a
 * Ryzen 5800X) sits between it and RNNoise. It needs a 48 kHz context, an
 * AudioWorklet and WebAssembly SIMD (the same as DeepFilterNet3), and
 * nothing else: no download (the 72 KB module and the weights ship with the
 * app) and no ONNX runtime.
 */
// no-inline: a data: URL worklet module could be refused by a CSP.
import fastEnhancerWorkletUrl from "./fastenhancer.worklet.js?url&no-inline";
import fastEnhancerWasmUrl from "./fastenhancer.wasm?url";
import fastEnhancerBaseUrl from "./fastenhancer_b.bin?url";
import fastEnhancerTinyUrl from "./fastenhancer_t.bin?url";
import {
    FE_BASE,
    FE_DELAY,
    FE_SAMPLE_RATE,
    FE_TINY,
} from "./fastenhancer.worklet.js";
import { deepFilterSupported } from "./deepFilter";

export const FASTENHANCER_SAMPLE_RATE = FE_SAMPLE_RATE;
/** Delay FastEnhancer adds, in seconds. */
export const FASTENHANCER_DELAY_S = FE_DELAY / FE_SAMPLE_RATE;

export type FastEnhancerModel = "base" | "tiny";

const MODELS = {
    base: { url: fastEnhancerBaseUrl, dims: FE_BASE },
    tiny: { url: fastEnhancerTinyUrl, dims: FE_TINY },
} as const;

/** Same needs as DeepFilterNet3: AudioWorklet, WebAssembly and its SIMD. */
export function fastEnhancerSupported(): boolean {
    return deepFilterSupported();
}

const files = new Map<FastEnhancerModel, Promise<[ArrayBuffer, ArrayBuffer]>>();
const loaded = new WeakMap<BaseAudioContext, Promise<void>>();

const get = (url: string) =>
    fetch(url).then((r) => {
        if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
        return r.arrayBuffer();
    });

/** The engine module and a model's weights. */
export function loadFastEnhancerFiles(
    model: FastEnhancerModel,
): Promise<[ArrayBuffer, ArrayBuffer]> {
    let p = files.get(model);
    if (!p) {
        p = Promise.all([get(fastEnhancerWasmUrl), get(MODELS[model].url)]);
        files.set(model, p);
        p.catch(() => files.delete(model));
    }
    return p;
}

export function fastEnhancerDims(model: FastEnhancerModel) {
    return MODELS[model].dims;
}

/** Adds the worklet module to `ctx` (once). */
export function loadFastEnhancerWorklet(ctx: BaseAudioContext): Promise<void> {
    let ready = loaded.get(ctx);
    if (!ready) {
        ready = ctx.audioWorklet.addModule(fastEnhancerWorkletUrl);
        loaded.set(ctx, ready);
        ready.catch(() => loaded.delete(ctx));
    }
    return ready;
}

export async function createFastEnhancerNode(
    ctx: BaseAudioContext,
    model: FastEnhancerModel = "base",
): Promise<AudioWorkletNode> {
    if (ctx.sampleRate !== FE_SAMPLE_RATE)
        throw new Error(`FastEnhancer needs 48 kHz, got ${ctx.sampleRate}`);
    const [, [wasm, weights]] = await Promise.all([
        loadFastEnhancerWorklet(ctx),
        loadFastEnhancerFiles(model),
    ]);
    return new AudioWorkletNode(ctx, "zam-fastenhancer", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: "explicit",
        outputChannelCount: [1],
        // Copied per node; ~0.5 MB together.
        processorOptions: { wasm, weights, dims: MODELS[model].dims },
    });
}

/** Fetch the files ahead of a call, so the mic goes live without waiting. */
export function prepareFastEnhancer(
    model: FastEnhancerModel = "base",
): Promise<boolean> {
    if (!fastEnhancerSupported()) return Promise.resolve(false);
    return loadFastEnhancerFiles(model).then(
        () => true,
        () => false,
    );
}
