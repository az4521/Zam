/**
 * Loads WebRTC's AGC2 (agc2.worklet.js, running agc2.wasm) into an
 * AudioContext: the auto gain control for the user's own mic.
 */
// no-inline: a data: URL worklet module could be refused by a CSP.
import agc2WorkletUrl from "./agc2.worklet.js?url&no-inline";
import agc2WasmUrl from "./agc2.wasm?url";
import { AGC2_FRAME_MS } from "./agc2.worklet.js";

/** Delay AGC2 adds (it works in whole 10 ms frames), in seconds. */
export const AGC2_DELAY_S = AGC2_FRAME_MS / 1000;

let wasmBytes: Promise<ArrayBuffer> | null = null;
const loaded = new WeakMap<BaseAudioContext, Promise<void>>();

function loadWasm(): Promise<ArrayBuffer> {
    if (!wasmBytes) {
        wasmBytes = fetch(agc2WasmUrl).then((r) => {
            if (!r.ok) throw new Error(`agc2.wasm: HTTP ${r.status}`);
            return r.arrayBuffer();
        });
        wasmBytes.catch(() => (wasmBytes = null));
    }
    return wasmBytes;
}

export async function createAgc2Node(
    ctx: BaseAudioContext,
): Promise<AudioWorkletNode> {
    let ready = loaded.get(ctx);
    if (!ready) {
        ready = ctx.audioWorklet.addModule(agc2WorkletUrl);
        loaded.set(ctx, ready);
        ready.catch(() => loaded.delete(ctx));
    }
    const [, wasm] = await Promise.all([ready, loadWasm()]);
    return new AudioWorkletNode(ctx, "zam-agc2", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: "explicit",
        outputChannelCount: [1],
        // Copied per node; it's ~90 KB.
        processorOptions: { wasm },
    });
}
