/**
 * DPDFNet's web backend: ONNX Runtime Web (WASM, one thread) in a dedicated
 * Worker, so a model call never runs on the audio thread or the page's main
 * thread. One Worker serves the page: the plugin first sends it a "load"
 * (ONNX Runtime and the model, which the plugin fetched through zam.assets),
 * then a "connect" with a MessagePort per mic chain, each with its own model
 * state, speaking the protocol in protocol.ts.
 */
import type * as Ort from "onnxruntime-web/wasm";
import { DPDF_BINS, decodeFrame, encodeFrame } from "./worklet.js";
import {
    control,
    freshState,
    parseControl,
    type DpdfnetInit,
    type DpdfnetReply,
    type WorkerLoad,
} from "./protocol";

const SPEC_SHAPE = [1, 1, DPDF_BINS, 2];
let ort: typeof Ort | null = null;
let session: Promise<Ort.InferenceSession> | null = null;

async function load(m: WorkerLoad): Promise<Ort.InferenceSession> {
    ort = (await import(/* @vite-ignore */ m.ortModuleUrl)) as typeof Ort;
    // No SharedArrayBuffer without cross-origin isolation: one thread, which
    // is this Worker's own.
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmBinary = m.ortWasm;
    ort.env.wasm.wasmPaths = { mjs: m.ortGlueUrl };
    return ort.InferenceSession.create(new Uint8Array(m.model), {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
    });
}

function serve(port: MessagePort): void {
    let init: DpdfnetInit | null = null;
    let state: Float32Array | null = null;
    let queue: Promise<void> = Promise.resolve();
    const reply = (m: DpdfnetReply) => port.postMessage(control(m));

    port.onmessage = (e) => {
        const data = e.data;
        if (typeof data === "string") {
            const msg = parseControl(data);
            if (msg?.type === "init") {
                init = msg;
                state = freshState(msg);
                if (!session) {
                    reply({
                        type: "error",
                        message: "the Worker isn't loaded",
                    });
                    return;
                }
                session.then(
                    () => reply({ type: "ready", backend: "worker" }),
                    (err) => reply({ type: "error", message: String(err) }),
                );
            } else if (msg?.type === "reset" && init) {
                // In line with queued frames, so none runs on the old state.
                const i = init;
                queue = queue.then(() => {
                    state = freshState(i);
                });
            } else if (msg?.type === "close") {
                port.close();
            }
            return;
        }
        const frame = decodeFrame(data);
        if (!frame || !session || !ort) return;
        const s = session;
        const o = ort;
        queue = queue
            .then(async () => {
                const sess = await s;
                const out = await sess.run({
                    spec: new o.Tensor("float32", frame.spec, SPEC_SHAPE),
                    state_in: new o.Tensor("float32", state!, [state!.length]),
                });
                state = out.state_out.data as Float32Array;
                port.postMessage(
                    encodeFrame(frame.seq, out.spec_e.data as Float32Array),
                );
            })
            .catch((err) => reply({ type: "error", message: String(err) }));
    };
}

self.onmessage = (e: MessageEvent) => {
    const m = e.data;
    if (m?.type === "load") {
        session = load(m as WorkerLoad);
        session.then(
            () => self.postMessage({ type: "loaded" }),
            (err) => {
                session = null;
                self.postMessage({ type: "load-error", message: String(err) });
            },
        );
    } else if (m?.type === "connect" && e.ports[0]) {
        serve(e.ports[0]);
    }
};
