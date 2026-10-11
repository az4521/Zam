/**
 * DeepFilterNet3 noise suppression (@lofcz/deepfilternet-web: libDF built to
 * WASM SIMD, weights baked in). The model is one ~34 MB wasm (about 11 MB
 * compressed) kept on the device:
 *  - Android and desktop ship it inside the app (Capacitor and Electron serve
 *    the bundled build), so it is read from disk.
 *  - The web / PWA keeps it in its own Cache Storage cache. Not the service
 *    worker's shell cache, which is per version and wiped on every deploy;
 *    the model file only changes when the package does, so it survives
 *    deploys and is re-fetched only when its content hash changes. The
 *    service worker leaves this file alone (swCacheRouting) so it is not
 *    stored twice. Prefetched in the background after startup.
 * The compiled module is shared for the page, and calls wait for it before
 * the mic goes live (prepareDeepFilter).
 *
 * The model works on 48 kHz mono in 10 ms frames, inside an AudioWorklet, so
 * nodes must live in a 48 kHz AudioContext.
 */
import { Capacitor } from "@capacitor/core";
import dfWasmUrl from "@lofcz/deepfilternet-web/df_bg.wasm?url";
import dfWorkletUrl from "@lofcz/deepfilternet-web/worklet?url";
// no-inline: a data: URL worklet module could be refused by a CSP.
import textDecoderShimUrl from "./workletTextDecoder.js?url&no-inline";

export const DEEP_FILTER_SAMPLE_RATE = 48000;
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

/** Survives deploys: holds only the current model file, keyed by its
 *  content-hashed URL. */
export const MODEL_CACHE_NAME = "zam-models-v1";

/** Whether the app itself ships the model (Android APK, Electron build). */
function modelIsBundled(): boolean {
    return (
        Capacitor.isNativePlatform() ||
        (typeof window !== "undefined" && window.desktop !== undefined)
    );
}

function modelUrl(): string {
    return new URL(dfWasmUrl, location.href).href;
}

/** "\0asm": a missing file can come back as the SPA's index.html with a 200. */
function isWasm(bytes: ArrayBuffer): boolean {
    const b = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
    return b[0] === 0 && b[1] === 0x61 && b[2] === 0x73 && b[3] === 0x6d;
}

async function download(url: string): Promise<ArrayBuffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`DeepFilterNet wasm: HTTP ${res.status}`);
    const bytes = await res.arrayBuffer();
    if (!isWasm(bytes)) throw new Error("DeepFilterNet wasm: not a wasm file");
    return bytes;
}

async function openModelCache(): Promise<Cache | null> {
    if (modelIsBundled() || typeof caches === "undefined") return null;
    try {
        return await caches.open(MODEL_CACHE_NAME);
    } catch {
        return null; // storage blocked (private mode, disabled site data)
    }
}

/** The model's bytes: from disk (bundled), the model cache, or the network
 *  (then stored). Drops any older model version from the cache. */
async function modelBytes(): Promise<ArrayBuffer> {
    const url = modelUrl();
    const cache = await openModelCache();
    if (!cache) return download(url);
    const hit = await cache.match(url).catch(() => undefined);
    if (hit?.ok) {
        const bytes = await hit.arrayBuffer();
        if (isWasm(bytes)) return bytes;
    }
    const bytes = await download(url);
    try {
        await cache.put(
            url,
            new Response(bytes.slice(0), {
                headers: { "Content-Type": "application/wasm" },
            }),
        );
        for (const req of await cache.keys())
            if (req.url !== url) await cache.delete(req);
    } catch {
        /* quota or blocked storage: still usable this session */
    }
    return bytes;
}

let modulePromise: Promise<WebAssembly.Module> | null = null;

function loadModule(): Promise<WebAssembly.Module> {
    if (!modulePromise) {
        modulePromise = modelBytes().then((b) => WebAssembly.compile(b));
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
            const cache = await openModelCache();
            if (!cache) return;
            if (await cache.match(modelUrl()).catch(() => undefined)) return;
            await modelBytes();
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
    attenuationLimitDb = 100,
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
