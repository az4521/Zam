/**
 * JPEG XL fallback for engines without native `image/jxl` decoding.
 *
 * Electron turns Chromium's built-in decoder on (see electron/main.cjs), but
 * browsers, the Android WebView and Tor Browser may not have it. There an
 * `<img>` pointing at JXL bytes just fires `error`. The jxl-rs-polyfill package
 * can't help on its own: it only recognises images by a `.jxl` URL extension,
 * and Matrix media URLs (`/media/download/...`, decrypted `blob:` URLs) have
 * none. So instead the image error paths in mediaAuth.svelte hand the bytes
 * they fetched to `maybeDecodeJxl`, which sniffs the JXL signature and, only
 * then, lazy-loads the wasm decoder and transcodes to PNG.
 */

import type {
    JxlDecodeRequest,
    JxlDecodeResponse,
} from "$lib/workers/jxlDecode.worker";

// Bare codestream: FF 0A. ISO BMFF container: 00 00 00 0C 'JXL ' 0D 0A 87 0A.
const CODESTREAM_SIG = [0xff, 0x0a];
const CONTAINER_SIG = [
    0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a,
];

function startsWith(bytes: Uint8Array, sig: number[]): boolean {
    if (bytes.length < sig.length) return false;
    return sig.every((b, i) => bytes[i] === b);
}

/** True when `bytes` begin with a JPEG XL codestream or container signature. */
export function isJxlBytes(bytes: Uint8Array): boolean {
    return (
        startsWith(bytes, CONTAINER_SIG) || startsWith(bytes, CODESTREAM_SIG)
    );
}

// A 1x1 lossless JXL; decodes only where the engine supports the format.
const PROBE = "data:image/jxl;base64,/woIAAAMABKIAgC4AF3lEgA=";

let nativeSupport: Promise<boolean> | null = null;

/** Whether this engine decodes JXL in `<img>` itself (probed once). */
export function hasNativeJxl(): Promise<boolean> {
    if (nativeSupport) return nativeSupport;
    nativeSupport = new Promise((resolve) => {
        if (typeof Image === "undefined") return resolve(false);
        const img = new Image();
        img.onload = () => resolve(img.width === 1);
        img.onerror = () => resolve(false);
        img.src = PROBE;
    });
    return nativeSupport;
}

let worker: Worker | null = null;
let nextId = 0;
const waiting = new Map<
    number,
    { resolve: (png: ArrayBuffer) => void; reject: (err: Error) => void }
>();

// The decode is seconds of synchronous wasm for a multi-MB photo, so it runs
// in a worker (see $lib/workers/jxlDecode.worker.ts) to keep the UI live.
function getWorker(): Worker {
    if (worker) return worker;
    worker = new Worker(
        new URL("../workers/jxlDecode.worker.ts", import.meta.url),
        { type: "module" },
    );
    worker.onmessage = (e: MessageEvent<JxlDecodeResponse>) => {
        const job = waiting.get(e.data.id);
        if (!job) return;
        waiting.delete(e.data.id);
        if ("png" in e.data) job.resolve(e.data.png);
        else job.reject(new Error(e.data.error));
    };
    worker.onerror = () => {
        // A failed load (offline, etc.) shouldn't poison every later attempt.
        for (const job of waiting.values()) {
            job.reject(new Error("JXL decode worker failed"));
        }
        waiting.clear();
        worker?.terminate();
        worker = null;
    };
    return worker;
}

function decodeInWorker(jxl: ArrayBuffer): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const id = nextId++;
        waiting.set(id, { resolve, reject });
        getWorker().postMessage({ id, jxl } satisfies JxlDecodeRequest, [jxl]);
    });
}

/**
 * If `blob` holds a JXL image and the engine can't render it, return a PNG
 * transcode; otherwise null (caller keeps the original). Never throws.
 */
export async function maybeDecodeJxl(blob: Blob): Promise<Blob | null> {
    try {
        const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
        if (!isJxlBytes(head)) return null;
        if (await hasNativeJxl()) return null;
        const png = await decodeInWorker(await blob.arrayBuffer());
        return new Blob([png], { type: "image/png" });
    } catch (err) {
        console.warn("JXL decode failed", err);
        return null;
    }
}

/**
 * Re-fetch an image `<img>` failed to show (a `blob:`/`data:` URL, or any
 * plain URL) and, if it's JXL, return an object URL of its PNG transcode.
 * The caller owns the returned URL.
 */
export async function jxlFallbackUrl(
    src: string,
    init?: RequestInit,
): Promise<string | null> {
    try {
        const res = await fetch(src, init);
        if (!res.ok) return null;
        const png = await maybeDecodeJxl(await res.blob());
        return png ? URL.createObjectURL(png) : null;
    } catch {
        return null;
    }
}
