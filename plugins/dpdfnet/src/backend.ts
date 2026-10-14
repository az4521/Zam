/**
 * DPDFNet noise suppression (Ceva's DPDFNet-2, 48 kHz: DeepFilterNet2 with
 * dual-path RNN blocks, Apache-2.0; see model/LICENSE), as a Zam mic filter.
 * Measured 2026-10-13 on real speech in nine kinds of noise it beat
 * DeepFilterNet3 everywhere (PESQ 2.65 vs 2.31, DNSMOS overall 2.65 vs 2.50),
 * kept the voice at its level, and doesn't care how loud the mic is. It costs
 * about ten times as much, so it runs off the audio thread and only where the
 * device keeps up:
 *
 *  - the audio thread (worklet.js) frames the mic and plays the result back;
 *    model calls go over a MessagePort to a backend:
 *  - the desktop app: native ONNX Runtime in the plugin's native host
 *    (native/host.cjs, via zam.native), about 1.6x as fast as WASM;
 *  - everywhere else, or if that won't start: ONNX Runtime Web in a Worker
 *    (worker.ts).
 *
 * Before a backend is used it is timed (benchmark): a device too slow for it
 * gets Zam's DeepFilterNet3 instead, and the verdict is remembered. During a
 * call the worklet reports misses; a backend that can't keep up after the
 * worklet has given it all the slack it may is reported through onFailure,
 * and Zam swaps DeepFilterNet3 in.
 */
import type {
    MicFilterInstance,
    ZamPluginApi,
} from "../../../src/lib/plugins/types";
import { DPDF_BINS, decodeFrame, encodeFrame } from "./worklet.js";
import { control, initMessage, parseReply } from "./protocol";

export const DPDFNET_SAMPLE_RATE = 48000;
/** Same cap as Zam's DeepFilterNet3: the pause gate and leveller after it
 *  are tuned around it. */
export const DPDFNET_ATTENUATION_DB = 25;

/** The plugin's files (manifest `assets`). */
export const ASSETS = {
    worklet: "assets/worklet.js",
    worker: "assets/worker.js",
    model: "assets/model.onnx",
    ortModule: "assets/ort.wasm.min.mjs",
    ortGlue: "assets/ort-wasm-simd-threaded.mjs",
    ortWasm: "assets/ort-wasm-simd-threaded.wasm",
};

const SLACK_GROWTH = 8;
/** 400 ms: past that the call is better off on DeepFilterNet3. */
const SLACK_LIMIT = 40;

/** Frames (10 ms) the output runs behind the backend, so its answers have
 *  time to arrive. The audio thread renders in bursts of the context's base
 *  latency (one 10 ms callback on a desktop, up to ~90 ms on some Android
 *  devices): every frame of a burst is made before any answer can come back,
 *  so the slack starts at a burst plus one frame and the worklet widens it
 *  (up to SLACK_GROWTH more) when answers still come late. Measured on an
 *  API 35 emulator (base latency 91 ms): a fixed maximum of 8 missed 12% of
 *  frames for good; widening to 14 missed none. */
export function slackFor(baseLatencyS: number): {
    slack: number;
    maxSlack: number;
} {
    const burst = Math.ceil((baseLatencyS > 0 ? baseLatencyS : 0.01) * 100);
    const slack = Math.min(SLACK_LIMIT - SLACK_GROWTH, Math.max(2, burst + 1));
    return { slack, maxSlack: slack + SLACK_GROWTH };
}

export type BackendKind = "native" | "worker";

/** Round trip a backend must manage per 10 ms frame, measured from the main
 *  thread over the same port the audio thread will use. The backend has its
 *  own thread, so it may use most of one core; the margin is for the rest of
 *  a call competing for it. (Measured 2026-10-13 on a Ryzen 5800X: Worker
 *  3.2 ms, native about 2 ms.) The overload monitor catches a device that
 *  passes here and still can't keep up. */
export const BENCH_MAX_MEDIAN_MS = 6;
export const BENCH_MAX_P90_MS = 9;
const BENCH_WARMUP = 8;
const BENCH_FRAMES = 32;
const INIT_TIMEOUT_MS = 30_000;
/** A device found too slow is not tried again for this long; one whose
 *  backend died mid-call ("stalled", which may have been a one-off crash)
 *  only for the hour. */
const VERDICT_TTL_MS = 14 * 24 * 3600 * 1000;
const STALLED_TTL_MS = 3600 * 1000;
const VERDICT_KEY = "verdict";

export interface Verdict {
    ok: boolean;
    backend: BackendKind;
    medianMs: number | null;
    reason?: string;
    at: number;
}

/** Minimal storage (zam.storage, or a fake in tests). */
export interface VerdictStore {
    get<T>(k: string, fb?: T): T;
    set(k: string, v: unknown): void;
}

export function readVerdict(
    store: VerdictStore,
    now = Date.now(),
): Verdict | null {
    const v = store.get<Verdict | null>(VERDICT_KEY, null);
    if (!v || typeof v.ok !== "boolean" || typeof v.at !== "number")
        return null;
    const ttl = v.reason === "stalled" ? STALLED_TTL_MS : VERDICT_TTL_MS;
    return now - v.at > ttl ? null : v;
}

export function fastEnough(r: { medianMs: number; p90Ms: number }): boolean {
    return r.medianMs <= BENCH_MAX_MEDIAN_MS && r.p90Ms <= BENCH_MAX_P90_MS;
}

export class TooSlowError extends Error {}

export interface WorkletStats {
    type: "stats";
    frames: number;
    sent: number;
    received: number;
    misses: number;
    skipped: number;
    slack: number;
}

/** Watch the worklet's once-a-second stats; call `fail` when the backend has
 *  stalled (nothing back for 3 s while frames went out) or still misses more
 *  than 5% of frames for 3 s at the widest slack. */
export function createOverloadMonitor(
    maxSlack: number,
    fail: (reason: string) => void,
): (s: WorkletStats) => void {
    let prev: WorkletStats | null = null;
    let stalled = 0;
    let overloaded = 0;
    let done = false;
    return (s) => {
        if (done) return;
        if (prev) {
            const frames = s.frames - prev.frames;
            const misses = s.misses - prev.misses;
            stalled =
                s.received === prev.received &&
                s.sent + s.skipped > prev.sent + prev.skipped
                    ? stalled + 1
                    : 0;
            overloaded =
                s.slack >= maxSlack && frames > 0 && misses / frames > 0.05
                    ? overloaded + 1
                    : 0;
            const reason =
                stalled >= 3 ? "stalled" : overloaded >= 3 ? "overload" : null;
            if (reason) {
                done = true;
                fail(reason);
            }
        }
        prev = s;
    };
}

/** The next message on `port` that `pick` accepts (others are ignored). */
function nextMessage<T>(
    port: MessagePort,
    pick: (data: unknown) => T | null,
    timeoutMs: number,
): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            port.onmessage = null;
            reject(new Error("DPDFNet backend timed out"));
        }, timeoutMs);
        port.onmessage = (e) => {
            let v: T | null;
            try {
                v = pick(e.data);
            } catch (err) {
                clearTimeout(timer);
                port.onmessage = null;
                reject(err);
                return;
            }
            if (v === null) return;
            clearTimeout(timer);
            port.onmessage = null;
            resolve(v);
        };
    });
}

/** Median and 90th percentile round trip of one frame, in ms. */
export async function benchmark(
    port: MessagePort,
): Promise<{ medianMs: number; p90Ms: number }> {
    let seed = 7;
    const rand = () =>
        ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 -
        1;
    const spec = new Float32Array(DPDF_BINS * 2);
    const times: number[] = [];
    for (let i = 0; i < BENCH_WARMUP + BENCH_FRAMES; i++) {
        // Room-noise-like spectrum, so the model does its usual work.
        for (let k = 0; k < spec.length; k++) spec[k] = rand() * 0.5;
        const answer = nextMessage(
            port,
            (d) => {
                const f = decodeFrame(d);
                if (f?.seq === i) return f;
                const r = parseReply(d);
                if (r?.type === "error") throw new Error(r.message);
                return null;
            },
            2000,
        );
        const t0 = performance.now();
        port.postMessage(encodeFrame(i, spec));
        await answer;
        if (i >= BENCH_WARMUP) times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    return {
        medianMs: times[Math.floor(times.length / 2)],
        p90Ms: times[Math.floor(times.length * 0.9)],
    };
}

interface Backend {
    kind: BackendKind;
    port: MessagePort;
    close(): void;
}

function closePort(port: MessagePort): void {
    try {
        port.postMessage(control({ type: "close" }));
    } catch {
        /* already gone */
    }
    port.close();
}

export function dpdfnetSupported(): boolean {
    return (
        typeof AudioWorkletNode !== "undefined" &&
        typeof WebAssembly !== "undefined" &&
        typeof Worker !== "undefined" &&
        typeof MessageChannel !== "undefined"
    );
}

export function createDpdfnet(zam: ZamPluginApi) {
    const writeVerdict = (v: Verdict) => zam.storage.set(VERDICT_KEY, v);
    const knownTooSlow = () => readVerdict(zam.storage)?.ok === false;

    // ---- the Worker (one per page) ----
    let worker: { w: Worker; loaded: Promise<void> } | null = null;

    async function ensureWorker() {
        if (worker) return worker;
        const [workerUrl, ortModuleUrl, ortGlueUrl, ortWasm, model] =
            await Promise.all([
                zam.assets.url(ASSETS.worker, "text/javascript"),
                zam.assets.url(ASSETS.ortModule, "text/javascript"),
                zam.assets.url(ASSETS.ortGlue, "text/javascript"),
                zam.assets.get(ASSETS.ortWasm),
                zam.assets.get(ASSETS.model),
            ]);
        if (worker) return worker;
        const w = new Worker(workerUrl, {
            type: "module",
            name: "zam-dpdfnet",
        });
        const loaded = new Promise<void>((resolve, reject) => {
            w.addEventListener("message", (e) => {
                if (e.data?.type === "loaded") resolve();
                else if (e.data?.type === "load-error")
                    reject(new Error(e.data.message));
            });
            w.addEventListener("error", (e) =>
                reject(
                    new Error(e.message || "the DPDFNet Worker didn't start"),
                ),
            );
        });
        w.postMessage(
            { type: "load", ortModuleUrl, ortGlueUrl, ortWasm, model },
            [ortWasm, model],
        );
        const entry = { w, loaded };
        worker = entry;
        loaded.catch(() => {
            if (worker === entry) worker = null;
            w.terminate();
        });
        return entry;
    }

    async function open(
        kind: BackendKind,
    ): Promise<{ b: Backend; model?: ArrayBuffer }> {
        if (kind === "native") {
            const [port, model] = await Promise.all([
                zam.native.connect(),
                zam.assets.get(ASSETS.model),
            ]);
            return { b: { kind, port, close: () => closePort(port) }, model };
        }
        const wk = await ensureWorker();
        await wk.loaded;
        const ch = new MessageChannel();
        wk.w.postMessage({ type: "connect" }, [ch.port2]);
        return {
            b: { kind, port: ch.port1, close: () => closePort(ch.port1) },
        };
    }

    async function initBackend(b: Backend, model?: ArrayBuffer): Promise<void> {
        const ready = nextMessage(b.port, parseReply, INIT_TIMEOUT_MS);
        const cores = navigator.hardwareConcurrency || 2;
        b.port.postMessage(initMessage(cores >= 4 ? 2 : 1, model?.byteLength));
        // Copied, not transferred: a transferred ArrayBuffer sent to a port
        // whose other end is in Electron's main/utility process is dropped
        // without an error (measured: Electron 44, the init never arrived).
        if (model) b.port.postMessage(model);
        const reply = await ready;
        if (reply.type === "error") throw new Error(reply.message);
    }

    /** A started backend that passed the benchmark, its state fresh. The
     *  native one first; one that fails to start (not one that is merely
     *  slow) falls through to the Worker. */
    async function startBackend(): Promise<Backend> {
        const order: BackendKind[] = [];
        if (zam.native.available()) order.push("native");
        order.push("worker");
        let lastErr: unknown = new Error("no DPDFNet backend available");
        for (const kind of order) {
            let b: Backend | null = null;
            try {
                const opened = await open(kind);
                b = opened.b;
                await initBackend(b, opened.model);
            } catch (err) {
                console.warn(`DPDFNet ${kind} backend unavailable:`, err);
                b?.close();
                lastErr = err;
                continue;
            }
            const r = await benchmark(b.port).catch((err) => {
                b.close();
                throw err;
            });
            const ok = fastEnough(r);
            writeVerdict({
                ok,
                backend: kind,
                medianMs: Math.round(r.medianMs * 100) / 100,
                reason: ok ? undefined : "benchmark",
                at: Date.now(),
            });
            if (!ok) {
                b.close();
                throw new TooSlowError(
                    `DPDFNet too slow here (${kind}: median ${r.medianMs.toFixed(1)} ms, p90 ${r.p90Ms.toFixed(1)} ms)`,
                );
            }
            b.port.postMessage(control({ type: "reset" }));
            return b;
        }
        throw lastErr;
    }

    const workletLoaded = new WeakMap<BaseAudioContext, Promise<void>>();

    async function create(ctx: AudioContext): Promise<MicFilterInstance> {
        if (!dpdfnetSupported()) throw new Error("DPDFNet can't run here");
        if (ctx.sampleRate !== DPDFNET_SAMPLE_RATE)
            throw new Error(`DPDFNet needs 48 kHz, got ${ctx.sampleRate}`);
        if (knownTooSlow())
            throw new TooSlowError("DPDFNet was too slow on this device");
        let loaded = workletLoaded.get(ctx);
        if (!loaded) {
            loaded = zam.assets
                .url(ASSETS.worklet, "text/javascript")
                .then((url) => ctx.audioWorklet.addModule(url));
            workletLoaded.set(ctx, loaded);
            loaded.catch(() => workletLoaded.delete(ctx));
        }
        const [backend] = await Promise.all([startBackend(), loaded]);
        const { slack, maxSlack } = slackFor(ctx.baseLatency);
        const node = new AudioWorkletNode(ctx, "zam-dpdfnet", {
            numberOfInputs: 1,
            numberOfOutputs: 2,
            outputChannelCount: [1, 1],
            channelCount: 1,
            channelCountMode: "explicit",
            processorOptions: {
                attenuationDb: DPDFNET_ATTENUATION_DB,
                slack,
                maxSlack,
            },
        });
        const inst: MicFilterInstance = {
            node,
            dryOutput: 1,
            onFailure: null,
            close() {
                node.port.onmessage = null;
                node.port.postMessage({ type: "stop" });
                backend.close();
            },
        };
        const monitor = createOverloadMonitor(maxSlack, (reason) => {
            writeVerdict({
                ok: false,
                backend: backend.kind,
                medianMs: null,
                reason,
                at: Date.now(),
            });
            inst.onFailure?.(reason);
        });
        // Straight from the audio thread to the backend. Should the port
        // refuse to move, the main thread relays instead.
        let relay = false;
        try {
            node.port.postMessage({ type: "backend" }, [backend.port]);
        } catch {
            relay = true;
            node.port.postMessage({ type: "relay" });
            backend.port.onmessage = (e) => {
                if (e.data instanceof ArrayBuffer || ArrayBuffer.isView(e.data))
                    node.port.postMessage(e.data);
            };
        }
        node.port.onmessage = (e) => {
            const d = e.data;
            if (relay && (d instanceof ArrayBuffer || ArrayBuffer.isView(d)))
                backend.port.postMessage(d);
            else if (d?.type === "stats") monitor(d);
        };
        return inst;
    }

    /** Ahead of a call: fetch the files, start a backend once (the model
     *  stays loaded) and time it, so the call's own start is quick. */
    async function prepare(
        timeoutMs: number,
    ): Promise<"ready" | "timeout" | "failed"> {
        if (!dpdfnetSupported() || knownTooSlow()) return "failed";
        let timer: ReturnType<typeof setTimeout> | undefined;
        const work = (async (): Promise<"ready"> => {
            (await startBackend()).close();
            return "ready";
        })().catch((err): "failed" => {
            if (err instanceof TooSlowError) console.info(err.message);
            else console.warn("DPDFNet unavailable:", err);
            return "failed";
        });
        try {
            return await Promise.race([
                work,
                new Promise<"timeout">((resolve) => {
                    timer = setTimeout(() => resolve("timeout"), timeoutMs);
                }),
            ]);
        } finally {
            clearTimeout(timer);
        }
    }

    /** Get the files onto the device (no model loading). */
    async function prefetch(): Promise<void> {
        if (!dpdfnetSupported()) return;
        for (const p of Object.values(ASSETS))
            if (!(await zam.assets.cached(p))) await zam.assets.get(p);
    }

    function dispose(): void {
        worker?.w.terminate();
        worker = null;
    }

    return {
        available: () => dpdfnetSupported() && !knownTooSlow(),
        create,
        prepare,
        prefetch,
        dispose,
    };
}
