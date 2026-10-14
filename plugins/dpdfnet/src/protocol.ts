/**
 * What flows over a DPDFNet backend port, whichever backend is on the other
 * end (the Worker, or a native host on the desktop or Android app). Only
 * strings and ArrayBuffers, copied not transferred (zam.native's rule):
 *  - binary frames (ArrayBuffer, see encodeFrame in worklet.js): a noisy
 *    spectrum in, the enhanced spectrum for the same sequence number back.
 *    Frames are answered in order; state carries over between them.
 *  - control messages as JSON strings: init (fresh state) answered with
 *    ready or error, reset (fresh state), close. A native host's init has
 *    `modelBytes`: the ONNX model follows as the next binary message.
 */
import initData from "../model/dpdfnet2_48khz_hr.init.json";

export interface DpdfnetInit {
    type: "init";
    /** Intra-op threads (native host). */
    threads: number;
    stateSize: number;
    erbNormInit: number[];
    specNormInit: number[];
    /** Native host: the model's size; it is the next binary message. */
    modelBytes?: number;
}

export type DpdfnetControl =
    DpdfnetInit | { type: "reset" } | { type: "close" };

export type DpdfnetReply =
    { type: "ready"; backend: string } | { type: "error"; message: string };

export const control = (m: DpdfnetControl | DpdfnetReply): string =>
    JSON.stringify(m);

export function parseControl(data: unknown): DpdfnetControl | null {
    if (typeof data !== "string") return null;
    try {
        const m = JSON.parse(data);
        return m && typeof m.type === "string" ? m : null;
    } catch {
        return null;
    }
}

/** The Worker's two ways to run the model. */
export type EngineKind = "wasm" | "webgpu";

/** Main thread to Worker. First, once, the model; then each engine that
 *  will be used, started once (ONNX Runtime Web: blob: URLs of its module
 *  and wasm glue plus the wasm bytes; WebGPU: the self-test's expected
 *  output, see webgpu/selftest.js); then a "connect" with a MessagePort
 *  per mic chain, each with its own model state, speaking the protocol
 *  above. */
export type WorkerMessage =
    | { type: "model"; model: ArrayBuffer }
    | {
          type: "engine";
          engine: "wasm";
          ortModuleUrl: string;
          ortGlueUrl: string;
          ortWasm: ArrayBuffer;
      }
    | { type: "engine"; engine: "webgpu"; selftest: ArrayBuffer }
    | { type: "connect"; engine: EngineKind };

/** Worker to main thread, answering an "engine". */
export type WorkerEvent =
    | { type: "engine-ready"; engine: EngineKind; detail?: string }
    | { type: "engine-error"; engine: EngineKind; message: string };

/** The model's initial normalisation state. */
export const MODEL_INIT = initData;

export function initMessage(threads: number, modelBytes?: number): string {
    return control({
        type: "init",
        threads,
        stateSize: initData.stateSize,
        erbNormInit: initData.erbNormInit,
        specNormInit: initData.specNormInit,
        modelBytes,
    });
}

export function freshState(init: {
    stateSize: number;
    erbNormInit: number[];
    specNormInit: number[];
}): Float32Array {
    const s = new Float32Array(init.stateSize);
    s.set(init.erbNormInit, 0);
    s.set(init.specNormInit, init.erbNormInit.length);
    return s;
}

export function parseReply(data: unknown): DpdfnetReply | null {
    if (typeof data !== "string") return null;
    try {
        const m = JSON.parse(data);
        return m?.type === "ready" || m?.type === "error" ? m : null;
    } catch {
        return null;
    }
}
