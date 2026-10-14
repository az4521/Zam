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

/** What the Worker needs once, before any connection: ONNX Runtime Web (a
 *  blob: URL of its module and of its wasm glue, plus the wasm bytes) and
 *  the model. */
export interface WorkerLoad {
    type: "load";
    ortModuleUrl: string;
    ortGlueUrl: string;
    ortWasm: ArrayBuffer;
    model: ArrayBuffer;
}

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
