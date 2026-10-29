/**
 * Loads RNNoise (rnnoise.worklet.js, running rnnoise.wasm) into an
 * AudioContext: Zam's default noise suppression for the user's own mic. It
 * needs a 48 kHz context, an AudioWorklet and WebAssembly, nothing else (no
 * SIMD, no download: the 1.4 MB module ships with the app).
 */
// no-inline: a data: URL worklet module could be refused by a CSP.
import rnnoiseWorkletUrl from "./rnnoise.worklet.js?url&no-inline";
import rnnoiseWasmUrl from "./rnnoise.wasm?url";
import { RNNOISE_FRAME } from "./rnnoise.worklet.js";

export const RNNOISE_SAMPLE_RATE = 48000;
/** Delay RNNoise adds (it works in whole 10 ms frames), in seconds. */
export const RNNOISE_DELAY_S = RNNOISE_FRAME / RNNOISE_SAMPLE_RATE;

export function rnnoiseSupported(): boolean {
    return (
        typeof AudioWorkletNode !== "undefined" &&
        typeof WebAssembly !== "undefined"
    );
}

let wasmBytes: Promise<ArrayBuffer> | null = null;
const loaded = new WeakMap<BaseAudioContext, Promise<void>>();

function loadWasm(): Promise<ArrayBuffer> {
    if (!wasmBytes) {
        wasmBytes = fetch(rnnoiseWasmUrl).then((r) => {
            if (!r.ok) throw new Error(`rnnoise.wasm: HTTP ${r.status}`);
            return r.arrayBuffer();
        });
        wasmBytes.catch(() => (wasmBytes = null));
    }
    return wasmBytes;
}

export async function createRnnoiseNode(
    ctx: BaseAudioContext,
): Promise<AudioWorkletNode> {
    if (ctx.sampleRate !== RNNOISE_SAMPLE_RATE)
        throw new Error(`RNNoise needs 48 kHz, got ${ctx.sampleRate}`);
    let ready = loaded.get(ctx);
    if (!ready) {
        ready = ctx.audioWorklet.addModule(rnnoiseWorkletUrl);
        loaded.set(ctx, ready);
        ready.catch(() => loaded.delete(ctx));
    }
    const [, wasm] = await Promise.all([ready, loadWasm()]);
    return new AudioWorkletNode(ctx, "zam-rnnoise", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: "explicit",
        outputChannelCount: [1],
        // Copied per node; it's ~1.4 MB.
        processorOptions: { wasm },
    });
}

/** Fetch the module ahead of a call, so the mic goes live without waiting. */
export function prepareRnnoise(): Promise<boolean> {
    if (!rnnoiseSupported()) return Promise.resolve(false);
    return loadWasm().then(
        () => true,
        () => false,
    );
}
