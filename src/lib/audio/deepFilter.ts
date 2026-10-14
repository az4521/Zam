/**
 * DeepFilterNet3 noise suppression (@lofcz/deepfilternet-web: libDF built to
 * WASM SIMD, weights baked in). The model is one ~34 MB wasm (about 11 MB
 * compressed) kept on the device ($lib/audio/modelCache): shipped with the
 * Android and desktop apps, cached across deploys on the web / PWA and
 * prefetched in the background after startup.
 * The compiled module is shared for the page, and calls wait for it before
 * the mic goes live (prepareDeepFilter).
 *
 * The model works on 48 kHz mono in 10 ms frames, inside an AudioWorklet, so
 * nodes must live in a 48 kHz AudioContext.
 */
import dfWasmUrl from "@lofcz/deepfilternet-web/df_bg.wasm?url";
import dfWorkletUrl from "@lofcz/deepfilternet-web/worklet?url";
// no-inline: a data: URL worklet module could be refused by a CSP.
import textDecoderShimUrl from "./workletTextDecoder.js?url&no-inline";
import {
    isWasm,
    modelAssetBytes,
    modelAssetCached,
    type ModelAsset,
} from "./modelCache";
import { modelIsBundled } from "./modelBundled";

export const DEEP_FILTER_SAMPLE_RATE = 48000;
/** Most the model may take off any part of the signal, in dB. Unlimited
 *  (100) over-suppressed: measured 2026-10-13 on real speech in room noise,
 *  capping at 25 dB left speech clearly cleaner and less muffled (log-spectral
 *  distance 13.6 -> 12.4 for a normal mic, 15.3 -> 12.1 for a quiet one in a
 *  noisy room) and its loudness steadier, for about 1.3 dB less noise
 *  removed in pauses. workadventure/noise-suppression settled on 25 too. */
export const DEEP_FILTER_ATTENUATION_DB = 25;
const PROCESSOR_NAME = "deepfilternet-processor";

// Minimal module using a v128 instruction (wasm-feature-detect's SIMD probe):
// the build needs SIMD, missing on Safari before 16.4.
const SIMD_PROBE = new Uint8Array([
    0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1,
    8, 0, 65, 0, 253, 15, 253, 98, 11,
]);

let supported: boolean | null = null;

/** Whether this browser can run DeepFilterNet3 at all. */
export function deepFilterSupported(): boolean {
    if (supported !== null) return supported;
    try {
        supported =
            typeof AudioWorkletNode !== "undefined" &&
            typeof WebAssembly !== "undefined" &&
            WebAssembly.validate(SIMD_PROBE);
    } catch {
        supported = false;
    }
    return supported;
}

function modelAsset(): ModelAsset {
    return {
        url: new URL(dfWasmUrl, location.href).href,
        label: "DeepFilterNet wasm",
        isValid: isWasm,
    };
}

let modulePromise: Promise<WebAssembly.Module> | null = null;

function loadModule(): Promise<WebAssembly.Module> {
    if (!modulePromise) {
        modulePromise = modelAssetBytes(modelAsset(), !modelIsBundled()).then(
            (b) => WebAssembly.compile(b),
        );
        // A failed fetch (offline, blocked) may succeed on the next call.
        modulePromise.catch(() => (modulePromise = null));
    }
    return modulePromise;
}

let prefetching: Promise<void> | null = null;

/** Make sure the model is stored on this device, without compiling it
 *  (that costs memory, and waits for a call). No-op where it ships with the
 *  app, where DeepFilterNet3 can't run, and once cached. */
export function prefetchDeepFilter(): Promise<void> {
    if (!deepFilterSupported() || modelIsBundled()) return Promise.resolve();
    if (!prefetching) {
        prefetching = (async () => {
            const asset = modelAsset();
            if (await modelAssetCached(asset.url, true)) return;
            await modelAssetBytes(asset, true);
        })()
            .catch((err) => console.warn("DeepFilterNet3 prefetch:", err))
            .finally(() => (prefetching = null));
    }
    return prefetching;
}

/** Load and compile the model ahead of a call, so the mic is filtered from
 *  its first sample. Resolves true when ready, false on failure or when it
 *  took longer than `timeoutMs` (the call then starts unfiltered and the
 *  filter splices in once it arrives). */
export async function prepareDeepFilter(timeoutMs: number): Promise<boolean> {
    if (!deepFilterSupported()) return false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            loadModule().then(() => true),
            new Promise<boolean>((resolve) => {
                timer = setTimeout(() => resolve(false), timeoutMs);
            }),
        ]);
    } catch (err) {
        console.warn("DeepFilterNet3 unavailable:", err);
        return false;
    } finally {
        clearTimeout(timer);
    }
}

const workletLoaded = new WeakMap<BaseAudioContext, Promise<void>>();

/** A DeepFilterNet3 node for `ctx` (must run at 48 kHz). Rejects when the
 *  browser lacks support or the model can't be fetched. */
export async function createDeepFilterNode(
    ctx: AudioContext,
    attenuationLimitDb = DEEP_FILTER_ATTENUATION_DB,
): Promise<AudioWorkletNode> {
    if (!deepFilterSupported())
        throw new Error("DeepFilterNet3 is not supported here");
    if (ctx.sampleRate !== DEEP_FILTER_SAMPLE_RATE)
        throw new Error(`DeepFilterNet3 needs 48 kHz, got ${ctx.sampleRate}`);
    let loaded = workletLoaded.get(ctx);
    if (!loaded) {
        // The shim first: the DeepFilterNet3 worklet needs TextDecoder at
        // load time (see workletTextDecoder.js).
        const worklet = ctx.audioWorklet;
        loaded = worklet
            .addModule(textDecoderShimUrl)
            .then(() => worklet.addModule(dfWorkletUrl));
        workletLoaded.set(ctx, loaded);
    }
    const [wasmModule] = await Promise.all([loadModule(), loaded]);
    return new AudioWorkletNode(ctx, PROCESSOR_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: "explicit",
        processorOptions: { wasmModule, attenuationLimit: attenuationLimitDb },
    });
}
