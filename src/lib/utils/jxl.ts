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

let decoder: Promise<(data: Uint8Array) => Promise<Uint8Array>> | null = null;

function loadDecoder(): Promise<(data: Uint8Array) => Promise<Uint8Array>> {
    if (decoder) return decoder;
    decoder = (async () => {
        const [lib, wasm] = await Promise.all([
            import("jxl-rs-polyfill"),
            // Bundle the wasm ourselves; without an explicit URL the package
            // falls back to fetching it from jsDelivr.
            import("jxl-rs-polyfill/jxl_wasm_bg.wasm?url"),
        ]);
        await lib.initWasm(wasm.default);
        return lib.decodeJxlToPng;
    })();
    // A failed load (offline, etc.) shouldn't poison every later attempt.
    decoder.catch(() => {
        decoder = null;
    });
    return decoder;
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
        const decode = await loadDecoder();
        const png = await decode(new Uint8Array(await blob.arrayBuffer()));
        return new Blob([png as BlobPart], { type: "image/png" });
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
