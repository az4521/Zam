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
 *    model calls go over a MessagePort to a backend, the first of these that
 *    starts and keeps up:
 *  - WebGPU: the model as hand-written WGSL kernels in a Worker
 *    (webgpu/engine.ts), checked against ONNX Runtime's answers before first
 *    use. The GPU does the work (0.2 ms a frame on a Radeon RX 6000), so it
 *    barely touches the CPU, which the rest of a call needs;
 *  - the desktop and Android apps: native ONNX Runtime in the plugin's
 *    native host (via zam.native), about 1.6x as fast as WASM;
 *  - ONNX Runtime Web (WASM) in the same Worker (worker.ts).
 *
 * Before a backend is used it is timed (benchmark). A GPU too slow for it
 * hands over to the CPU backends; a device whose CPU is too slow too gets
 * Zam's DeepFilterNet3 instead. The verdicts are remembered (the GPU's
 * apart from the CPU's). During a call the worklet reports misses; a backend
 * that can't keep up after the worklet has given it all the slack it may is
 * reported through onFailure, and Zam swaps DeepFilterNet3 in.
 */
import type {
    MicFilterInstance,
    ZamPluginApi,
} from "../../../src/lib/plugins/types";
import { DPDF_BINS, decodeFrame, encodeFrame } from "./worklet.js";
import {
    control,
    initMessage,
    parseReply,
    type EngineKind,
    type WorkerEvent,
    type WorkerMessage,
} from "./protocol";

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
    selftest: "assets/selftest.bin",
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

export type BackendKind = "webgpu" | "native" | "worker";

/** What a backend must manage, measured from the main thread over the same
 *  port the audio thread will use, with BENCH_DEPTH frames in flight as the
 *  audio thread keeps them (it sends a frame every 10 ms without waiting):
 *  a frame per BENCH_MAX_FRAME_MS, and 90% of frames answered within
 *  BENCH_MAX_LATENCY_MS, well inside the smallest slack (20 ms). A CPU
 *  backend has its own thread, so it may use most of one core; the margin
 *  is for the rest of a call competing for it. WebGPU's round trip is
 *  mostly the browser's fixed read-back delay (about 3 ms in Chromium on
 *  Windows), which overlapping frames hide. The overload monitor catches a
 *  device that passes here and still can't keep up. */
export const BENCH_MAX_FRAME_MS = 6;
export const BENCH_MAX_LATENCY_MS = 15;
const BENCH_DEPTH = 2;
const BENCH_WARMUP = 8;
const BENCH_FRAMES = 32;
const INIT_TIMEOUT_MS = 30_000;
/** A device found too slow is not tried again for this long; one whose
 *  backend died mid-call ("stalled", which may have been a one-off crash)
 *  only for the hour; a GPU that wouldn't start, for the day. */
const VERDICT_TTL_MS = 14 * 24 * 3600 * 1000;
const STALLED_TTL_MS = 3600 * 1000;
const UNAVAILABLE_TTL_MS = 24 * 3600 * 1000;
/** The CPU backends' verdict (native, Worker), and the GPU's. */
export const VERDICT_KEY = "verdict";
export const GPU_VERDICT_KEY = "verdict-webgpu";

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
    key = VERDICT_KEY,
): Verdict | null {
    const v = store.get<Verdict | null>(key, null);
    if (!v || typeof v.ok !== "boolean" || typeof v.at !== "number")
        return null;
    const ttl =
        v.reason === "stalled"
            ? STALLED_TTL_MS
            : v.reason === "unavailable"
              ? UNAVAILABLE_TTL_MS
              : VERDICT_TTL_MS;
    return now - v.at > ttl ? null : v;
}

export interface BenchResult {
    /** Round trip of a frame: median and 90th percentile, ms. */
    medianMs: number;
    p90Ms: number;
    /** Time per frame with frames overlapping, ms. */
    frameMs: number;
}

export function fastEnough(r: BenchResult): boolean {
    return r.frameMs <= BENCH_MAX_FRAME_MS && r.p90Ms <= BENCH_MAX_LATENCY_MS;
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

/** Time a backend with BENCH_DEPTH frames in flight (see BENCH_MAX_*). */
export function benchmark(port: MessagePort): Promise<BenchResult> {
    let seed = 7;
    const rand = () =>
        ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 -
        1;
    const spec = new Float32Array(DPDF_BINS * 2);
    const total = BENCH_WARMUP + BENCH_FRAMES;
    const sentAt = new Map<number, number>();
    const times: number[] = [];
    let next = 0;
    let answered = 0;
    let timedFrom = 0;
    return new Promise((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const finish = (err: Error | null, r?: BenchResult) => {
            clearTimeout(timer);
            port.onmessage = null;
            if (err) reject(err);
            else resolve(r!);
        };
        const arm = () => {
            clearTimeout(timer);
            timer = setTimeout(
                () => finish(new Error("DPDFNet backend timed out")),
                2000,
            );
        };
        const send = () => {
            // Room-noise-like spectrum, so the model does its usual work.
            for (let k = 0; k < spec.length; k++) spec[k] = rand() * 0.5;
            sentAt.set(next, performance.now());
            port.postMessage(encodeFrame(next++, spec));
        };
        port.onmessage = (e) => {
            const r = parseReply(e.data);
            if (r?.type === "error") return finish(new Error(r.message));
            const f = decodeFrame(e.data);
            const t0 = f ? sentAt.get(f.seq) : undefined;
            if (!f || t0 === undefined) return;
            sentAt.delete(f.seq);
            const now = performance.now();
            if (f.seq >= BENCH_WARMUP) times.push(now - t0);
            else if (f.seq === BENCH_WARMUP - 1) timedFrom = now;
            if (++answered === total) {
                times.sort((a, b) => a - b);
                return finish(null, {
                    medianMs: times[Math.floor(times.length / 2)],
                    p90Ms: times[Math.floor(times.length * 0.9)],
                    frameMs: (now - timedFrom) / BENCH_FRAMES,
                });
            }
            arm();
            if (next < total) send();
        };
        arm();
        for (let i = 0; i < BENCH_DEPTH; i++) send();
    });
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

/** WebGPU may be there (whether it starts is up to the Worker). */
const webgpuPossible = () =>
    typeof navigator !== "undefined" && "gpu" in navigator;

export function dpdfnetSupported(): boolean {
    return (
        typeof AudioWorkletNode !== "undefined" &&
        typeof WebAssembly !== "undefined" &&
        typeof Worker !== "undefined" &&
        typeof MessageChannel !== "undefined"
    );
}

export function createDpdfnet(zam: ZamPluginApi) {
    const writeVerdict = (v: Verdict) =>
        zam.storage.set(
            v.backend === "webgpu" ? GPU_VERDICT_KEY : VERDICT_KEY,
            v,
        );
    const cpuRuledOut = () => readVerdict(zam.storage)?.ok === false;
    const gpuRuledOut = () =>
        !webgpuPossible() ||
        readVerdict(zam.storage, Date.now(), GPU_VERDICT_KEY)?.ok === false;
    const knownTooSlow = () => cpuRuledOut() && gpuRuledOut();

    // ---- the Worker (one per page), and the engines started in it ----
    interface WorkerEntry {
        w: Worker;
        engines: Map<EngineKind, Promise<string | undefined>>;
    }
    let worker: WorkerEntry | null = null;

    async function ensureWorker(): Promise<WorkerEntry> {
        if (worker) return worker;
        const [workerUrl, model] = await Promise.all([
            zam.assets.url(ASSETS.worker, "text/javascript"),
            zam.assets.get(ASSETS.model),
        ]);
        if (worker) return worker;
        const w = new Worker(workerUrl, {
            type: "module",
            name: "zam-dpdfnet",
        });
        w.postMessage({ type: "model", model } satisfies WorkerMessage, [
            model,
        ]);
        const entry: WorkerEntry = { w, engines: new Map() };
        worker = entry;
        w.addEventListener("error", (e) => {
            console.warn("DPDFNet Worker:", e.message);
            if (worker === entry) worker = null;
            w.terminate();
        });
        return entry;
    }

    /** An engine running in the Worker; resolves with the GPU it runs on,
     *  if that's what it is. Started once (again if it failed). */
    function ensureEngine(
        wk: WorkerEntry,
        engine: EngineKind,
    ): Promise<string | undefined> {
        const started = wk.engines.get(engine);
        if (started) return started;
        const p = new Promise<string | undefined>((resolve, reject) => {
            const done = () => {
                wk.w.removeEventListener("message", onMessage);
                wk.w.removeEventListener("error", onError);
            };
            const onMessage = (e: MessageEvent) => {
                const d = e.data as WorkerEvent;
                if (d?.engine !== engine) return;
                if (d.type === "engine-ready") resolve(d.detail);
                else if (d.type === "engine-error")
                    reject(new Error(d.message));
                else return;
                done();
            };
            const onError = (e: ErrorEvent) => {
                done();
                reject(
                    new Error(e.message || "the DPDFNet Worker didn't start"),
                );
            };
            wk.w.addEventListener("message", onMessage);
            wk.w.addEventListener("error", onError);
            (async () => {
                if (engine === "webgpu") {
                    const selftest = await zam.assets.get(ASSETS.selftest);
                    wk.w.postMessage(
                        {
                            type: "engine",
                            engine,
                            selftest,
                        } satisfies WorkerMessage,
                        [selftest],
                    );
                } else {
                    const [ortModuleUrl, ortGlueUrl, ortWasm] =
                        await Promise.all([
                            zam.assets.url(ASSETS.ortModule, "text/javascript"),
                            zam.assets.url(ASSETS.ortGlue, "text/javascript"),
                            zam.assets.get(ASSETS.ortWasm),
                        ]);
                    wk.w.postMessage(
                        {
                            type: "engine",
                            engine,
                            ortModuleUrl,
                            ortGlueUrl,
                            ortWasm,
                        } satisfies WorkerMessage,
                        [ortWasm],
                    );
                }
            })().catch((err) => {
                done();
                reject(err);
            });
        });
        wk.engines.set(engine, p);
        p.catch(() => {
            if (wk.engines.get(engine) === p) wk.engines.delete(engine);
        });
        return p;
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
        const engine: EngineKind = kind === "webgpu" ? "webgpu" : "wasm";
        const gpu = await ensureEngine(wk, engine);
        if (gpu) console.info(`DPDFNet on WebGPU: ${gpu}`);
        const ch = new MessageChannel();
        wk.w.postMessage({ type: "connect", engine } satisfies WorkerMessage, [
            ch.port2,
        ]);
        return {
            b: { kind, port: ch.port1, close: () => closePort(ch.port1) },
        };
    }

    async function initBackend(b: Backend, model?: ArrayBuffer): Promise<void> {
        const ready = nextMessage(b.port, parseReply, INIT_TIMEOUT_MS);
        // One thread: a second barely shortens a frame (2.3 to 2.15 ms on a
        // Ryzen 5800X) and costs another tenth of a core.
        b.port.postMessage(initMessage(1, model?.byteLength));
        // Copied, not transferred: a transferred ArrayBuffer sent to a port
        // whose other end is in Electron's main/utility process is dropped
        // without an error (measured: Electron 44, the init never arrived).
        if (model) b.port.postMessage(model);
        const reply = await ready;
        if (reply.type === "error") throw new Error(reply.message);
    }

    /** A started backend that passed the benchmark, its state fresh: WebGPU,
     *  then native, then the Worker. One that won't start, and a GPU that
     *  is too slow, fall through to the next; a CPU too slow means the
     *  device is (native is the faster of the two). */
    async function startBackend(): Promise<Backend> {
        const order: BackendKind[] = [];
        if (!gpuRuledOut()) order.push("webgpu");
        if (!cpuRuledOut()) {
            if (zam.native.available()) order.push("native");
            order.push("worker");
        }
        let lastErr: unknown = new TooSlowError(
            "DPDFNet was too slow on this device",
        );
        const gpuFailed = (reason: string) =>
            writeVerdict({
                ok: false,
                backend: "webgpu",
                medianMs: null,
                reason,
                at: Date.now(),
            });
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
                if (kind === "webgpu")
                    gpuFailed(
                        String(err).includes("self-test")
                            ? "selftest"
                            : "unavailable",
                    );
                continue;
            }
            let r: BenchResult;
            try {
                r = await benchmark(b.port);
            } catch (err) {
                b.close();
                if (kind !== "webgpu") throw err;
                console.warn("DPDFNet webgpu backend failed:", err);
                gpuFailed("stalled");
                lastErr = err;
                continue;
            }
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
                const msg = `DPDFNet too slow here (${kind}: a frame per ${r.frameMs.toFixed(1)} ms, round trip p90 ${r.p90Ms.toFixed(1)} ms)`;
                if (kind !== "webgpu") throw new TooSlowError(msg);
                console.info(msg);
                lastErr = new TooSlowError(msg);
                continue;
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
