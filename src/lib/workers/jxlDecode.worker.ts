/// <reference lib="webworker" />
/**
 * Transcodes JPEG XL to PNG with the jxl-rs wasm decoder. Runs in a worker
 * because the decode + PNG encode is synchronous wasm: a few-MB photo is
 * seconds of CPU that would otherwise freeze the UI. Driven by
 * $lib/utils/jxl.ts.
 */
import init, { decode_jxl_to_png } from "jxl-rs-polyfill/wasm";
// Bundle the wasm ourselves; the package's wrapper would otherwise fall back
// to fetching it from jsDelivr.
import wasmUrl from "jxl-rs-polyfill/jxl_wasm_bg.wasm?url";

export interface JxlDecodeRequest {
    id: number;
    jxl: ArrayBuffer;
}

export type JxlDecodeResponse =
    { id: number; png: ArrayBuffer } | { id: number; error: string };

let ready: Promise<unknown> | null = null;

self.onmessage = async (e: MessageEvent<JxlDecodeRequest>) => {
    const { id } = e.data;
    try {
        ready ??= init({ module_or_path: wasmUrl }).catch((err) => {
            ready = null;
            throw err;
        });
        await ready;
        const png = decode_jxl_to_png(new Uint8Array(e.data.jxl));
        const buf = png.buffer as ArrayBuffer;
        (self as DedicatedWorkerGlobalScope).postMessage(
            { id, png: buf } satisfies JxlDecodeResponse,
            [buf],
        );
    } catch (err) {
        (self as DedicatedWorkerGlobalScope).postMessage({
            id,
            error: err instanceof Error ? err.message : String(err),
        } satisfies JxlDecodeResponse);
    }
};
