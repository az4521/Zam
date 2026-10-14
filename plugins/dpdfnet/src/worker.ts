/**
 * DPDFNet's web backends, in a dedicated Worker so a model call never runs
 * on the audio thread or the page's main thread. One Worker serves the
 * page: the plugin sends it the model, starts the engines it will use, then
 * connects a MessagePort per mic chain, each with its own model state,
 * speaking the protocol in protocol.ts. Two engines:
 *  - webgpu: the model as hand-written WGSL kernels (webgpu/engine.ts). The
 *    GPU does the work and frames pipeline, so the CPU cost is a few
 *    hundredths of a millisecond per frame. Checked against ONNX Runtime's
 *    answers (webgpu/selftest.js) before first use.
 *  - wasm: ONNX Runtime Web, one thread (this Worker's own).
 */
import type * as Ort from "onnxruntime-web/wasm";
import { DPDF_BINS, decodeFrame, encodeFrame } from "./worklet.js";
import {
    MODEL_INIT,
    control,
    freshState,
    parseControl,
    type DpdfnetReply,
    type EngineKind,
    type WorkerEvent,
    type WorkerMessage,
} from "./protocol";
import { GpuModel, plan } from "./webgpu/engine";
import { readInitializers } from "./webgpu/onnx";
import {
    SELFTEST_CHECK,
    SELFTEST_FRAMES,
    SELFTEST_MIN_SNR_DB,
    selftestFrame,
    snrDb,
} from "./webgpu/selftest.js";

const SPEC_SHAPE = [1, 1, DPDF_BINS, 2];
const errorText = (err: unknown) =>
    err instanceof Error ? err.message : String(err);
const SPEC = DPDF_BINS * 2;

/** One mic chain's model state on an engine. */
interface Session {
    /** The enhanced frame; answers come back in call order. */
    process(spec: Float32Array): Promise<Float32Array>;
    reset(): void;
    close(): void;
}

interface Engine {
    session(): Session;
    /** Shown in the "ready" reply. */
    name: string;
    /** Which GPU (WebGPU). */
    detail?: string;
    /** Its GPU went away: start it again before the next use. */
    dead?: boolean;
}

let model: ArrayBuffer | null = null;
const engines = new Map<EngineKind, Promise<Engine>>();

async function wasmEngine(
    m: Extract<WorkerMessage, { engine: "wasm" }>,
): Promise<Engine> {
    if (!model) throw new Error("no model");
    const ort = (await import(/* @vite-ignore */ m.ortModuleUrl)) as typeof Ort;
    // No SharedArrayBuffer without cross-origin isolation: one thread, which
    // is this Worker's own.
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmBinary = m.ortWasm;
    ort.env.wasm.wasmPaths = { mjs: m.ortGlueUrl };
    const sess = await ort.InferenceSession.create(new Uint8Array(model), {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
    });
    return {
        name: "worker",
        session() {
            let state = freshState(MODEL_INIT);
            // One model call at a time, in order; a reset waits its turn.
            let queue: Promise<unknown> = Promise.resolve();
            return {
                process(spec) {
                    const run = queue.then(async () => {
                        const out = await sess.run({
                            spec: new ort.Tensor("float32", spec, SPEC_SHAPE),
                            state_in: new ort.Tensor("float32", state, [
                                state.length,
                            ]),
                        });
                        state = out.state_out.data as Float32Array;
                        return out.spec_e.data as Float32Array;
                    });
                    queue = run.catch(() => undefined);
                    return run;
                },
                reset() {
                    queue = queue.then(() => {
                        state = freshState(MODEL_INIT);
                    });
                },
                close() {},
            };
        },
    };
}

async function webgpuEngine(selftest: ArrayBuffer): Promise<Engine> {
    if (!model) throw new Error("no model");
    const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
    if (!gpu) throw new Error("no WebGPU here");
    // A laptop's integrated GPU, where there is one: the work is small and
    // this keeps a discrete GPU asleep.
    const adapter = await gpu.requestAdapter({ powerPreference: "low-power" });
    if (!adapter) throw new Error("no WebGPU adapter");
    const device = await adapter.requestDevice();
    const info = adapter.info;
    const detail =
        `${info.vendor} ${info.architecture} ${info.description}`.trim();
    const gm = await GpuModel.create(
        device,
        plan(readInitializers(model), MODEL_INIT),
    );
    // Known answer first: every frame in flight at once, then compare.
    const want = new Float32Array(selftest);
    if (want.length !== SELFTEST_CHECK * SPEC)
        throw new Error("bad self-test data");
    const s = gm.session();
    const outs = await Promise.all(
        Array.from({ length: SELFTEST_FRAMES }, (_, t) =>
            s.process(selftestFrame(t)),
        ),
    );
    s.destroy();
    const got = new Float32Array(SELFTEST_CHECK * SPEC);
    outs.slice(SELFTEST_FRAMES - SELFTEST_CHECK).forEach((o, i) =>
        got.set(o, i * SPEC),
    );
    const snr = snrDb(want, got);
    if (!(snr >= SELFTEST_MIN_SNR_DB)) {
        gm.destroy();
        device.destroy();
        throw new Error(
            `WebGPU self-test failed on ${detail}: ${snr.toFixed(1)} dB`,
        );
    }
    const engine: Engine = {
        name: "webgpu",
        detail,
        dead: false,
        session() {
            const sess = gm.session();
            return {
                process: (spec) => sess.process(spec),
                reset: () => sess.reset(),
                close: () => sess.destroy(),
            };
        },
    };
    device.lost.then((l) => {
        engine.dead = true;
        console.warn("DPDFNet: WebGPU device lost:", l.message);
    });
    return engine;
}

function serve(port: MessagePort, enginePromise: Promise<Engine>): void {
    let session: Session | null = null;
    // Answers go out in frame order.
    let last: Promise<unknown> = Promise.resolve();
    let failed = false;
    const reply = (m: DpdfnetReply) => port.postMessage(control(m));
    const fail = (err: unknown) => {
        if (failed) return;
        failed = true;
        reply({ type: "error", message: errorText(err) });
    };

    port.onmessage = (e) => {
        const data = e.data;
        if (typeof data === "string") {
            const msg = parseControl(data);
            if (msg?.type === "init") {
                enginePromise.then(
                    (engine) => {
                        session?.close();
                        session = engine.session();
                        failed = false;
                        reply({ type: "ready", backend: engine.name });
                    },
                    (err) => reply({ type: "error", message: errorText(err) }),
                );
            } else if (msg?.type === "reset") {
                session?.reset();
            } else if (msg?.type === "close") {
                session?.close();
                session = null;
                port.close();
            }
            return;
        }
        const frame = decodeFrame(data);
        if (!frame || !session || failed) return;
        const out = session.process(frame.spec);
        last = last
            .then(() => out)
            .then(
                (spec) => port.postMessage(encodeFrame(frame.seq, spec)),
                fail,
            );
    };
}

/** An engine, started once and reused; again if it died. */
function start(m: Extract<WorkerMessage, { type: "engine" }>): Promise<Engine> {
    const fresh = () => {
        const p =
            m.engine === "wasm" ? wasmEngine(m) : webgpuEngine(m.selftest);
        engines.set(m.engine, p);
        p.catch(() => {
            if (engines.get(m.engine) === p) engines.delete(m.engine);
        });
        return p;
    };
    const existing = engines.get(m.engine);
    return existing
        ? existing.then((en) => (en.dead ? fresh() : en), fresh)
        : fresh();
}

self.onmessage = (e: MessageEvent) => {
    const m = e.data as WorkerMessage;
    if (m?.type === "model") {
        model = m.model;
    } else if (m?.type === "engine") {
        start(m).then(
            (en) =>
                self.postMessage({
                    type: "engine-ready",
                    engine: m.engine,
                    detail: en.detail,
                } satisfies WorkerEvent),
            (err) =>
                self.postMessage({
                    type: "engine-error",
                    engine: m.engine,
                    message: errorText(err),
                } satisfies WorkerEvent),
        );
    } else if (m?.type === "connect" && e.ports[0]) {
        const p =
            engines.get(m.engine) ??
            Promise.reject(new Error(`${m.engine} isn't started`));
        serve(e.ports[0], p);
    }
};
