/*
 * PPMd variant H (Ppmd7) with the 7z range coder, compiled from Igor Pavlov's
 * public-domain 7-Zip C sources (based on Dmitry Shkarin's PPMd var.H) to
 * WebAssembly. See native/ppmd-wasm/README.md. Output is bit-identical to the
 * 7z PPMd coder.
 *
 * Call initPpmd() once before encoding or decoding. The module is shared per
 * page or worker; every call uses fresh model state.
 */
import ppmdWasmUrl from "./ppmd.wasm?url";

export interface PpmdOptions {
    /** Model order, 2..64 (the 7z `o=` value). */
    order: number;
    /** Model memory in bytes (the 7z `mem=` value). */
    memSize: number;
}

interface PpmdExports {
    memory: WebAssembly.Memory;
    ppmd_in_reserve(n: number): number;
    ppmd_out_reserve(n: number): number;
    ppmd_encode(
        inLen: number,
        order: number,
        memSize: number,
        outCap: number,
    ): number;
    ppmd_decode(
        inLen: number,
        outSize: number,
        order: number,
        memSize: number,
    ): number;
}

const MIN_ORDER = 2;
const MAX_ORDER = 64;
const MIN_MEM_SIZE = 1 << 11;
const MAX_MEM_SIZE = 0xffffffff - 12 * 3;

const ERR_OUT_OVERFLOW = -2;
const DECODE_ERRORS: Record<number, string> = {
    [-1]: "invalid parameters",
    [-3]: "out of memory",
    [-4]: "bad range coder header",
    [-5]: "corrupt data",
    [-6]: "unexpected end marker",
    [-7]: "truncated data",
    [-8]: "range coder not finished (corrupt or truncated data)",
    [-9]: "trailing data after stream",
};

let compiled: WebAssembly.Module | null = null;
let exportsRef: PpmdExports | null = null;
let initPromise: Promise<void> | null = null;

function instantiate(module: WebAssembly.Module): PpmdExports {
    return new WebAssembly.Instance(module, {})
        .exports as unknown as PpmdExports;
}

/**
 * Loads and compiles the codec once; later calls return the same promise.
 * Pass `bytes` to supply the .wasm directly (tests, workers); otherwise the
 * bundled module is fetched from its URL.
 */
export function initPpmd(bytes?: BufferSource): Promise<void> {
    if (!initPromise) {
        initPromise = (async () => {
            let module: WebAssembly.Module;
            if (bytes) {
                module = await WebAssembly.compile(bytes);
            } else {
                module = await fetchModule(ppmdWasmUrl);
            }
            compiled = module;
            exportsRef = instantiate(module);
        })();
        initPromise.catch(() => {
            initPromise = null;
        });
    }
    return initPromise;
}

async function fetchModule(url: string): Promise<WebAssembly.Module> {
    if (typeof WebAssembly.compileStreaming === "function") {
        try {
            return await WebAssembly.compileStreaming(fetch(url));
        } catch {
            // Fall through: some servers send the wrong MIME type.
        }
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ppmd.wasm fetch failed: ${res.status}`);
    return WebAssembly.compile(await res.arrayBuffer());
}

export function ppmdReady(): boolean {
    return exportsRef !== null;
}

function requireExports(): PpmdExports {
    if (!exportsRef)
        throw new Error("PPMd codec not initialised: call initPpmd() first");
    return exportsRef;
}

function checkOpts(opts: PpmdOptions): void {
    if (
        !Number.isInteger(opts.order) ||
        opts.order < MIN_ORDER ||
        opts.order > MAX_ORDER
    ) {
        throw new RangeError(
            `PPMd order must be an integer in ${MIN_ORDER}..${MAX_ORDER}`,
        );
    }
    if (
        !Number.isInteger(opts.memSize) ||
        opts.memSize < MIN_MEM_SIZE ||
        opts.memSize > MAX_MEM_SIZE
    ) {
        throw new RangeError(
            `PPMd memSize must be an integer in ${MIN_MEM_SIZE}..${MAX_MEM_SIZE}`,
        );
    }
}

/**
 * Runs a wasm call. If the module traps, the instance is rebuilt from the
 * compiled module so later calls keep working, and an Error is thrown.
 */
function guard<T>(fn: (ex: PpmdExports) => T): T {
    const ex = requireExports();
    try {
        return fn(ex);
    } catch (err) {
        if (err instanceof WebAssembly.RuntimeError && compiled) {
            exportsRef = instantiate(compiled);
            throw new Error(`PPMd codec trapped: ${err.message}`);
        }
        throw err;
    }
}

function reserve(ex: PpmdExports, kind: "in" | "out", n: number): number {
    const ptr = kind === "in" ? ex.ppmd_in_reserve(n) : ex.ppmd_out_reserve(n);
    if (ptr === 0 && n > 0) throw new Error("PPMd codec out of memory");
    return ptr;
}

/** Copies `len` bytes out of wasm memory (never returns a view). */
function copyOut(ex: PpmdExports, ptr: number, len: number): Uint8Array {
    return new Uint8Array(ex.memory.buffer, ptr, len).slice();
}

/** Encodes `input` as a 7z PPMd stream (no end marker, 7z flush). */
export function ppmdEncode(input: Uint8Array, opts: PpmdOptions): Uint8Array {
    checkOpts(opts);
    return guard((ex) => {
        let cap = input.length + (input.length >>> 2) + 1024;
        for (;;) {
            // Reserve both buffers before writing the input: a reserve may grow memory.
            reserve(ex, "in", input.length);
            reserve(ex, "out", cap);
            new Uint8Array(
                ex.memory.buffer,
                ex.ppmd_in_reserve(input.length),
                input.length,
            ).set(input);
            const n = ex.ppmd_encode(
                input.length,
                opts.order,
                opts.memSize,
                cap,
            );
            if (n >= 0) return copyOut(ex, ex.ppmd_out_reserve(cap), n);
            if (n !== ERR_OUT_OVERFLOW)
                throw new Error(`PPMd encode failed (${n})`);
            cap *= 2;
        }
    });
}

/**
 * Decodes a 7z PPMd stream of `outSize` bytes. Throws on corrupt or truncated
 * input; never reads past `input` or writes past `outSize`.
 */
export function ppmdDecode(
    input: Uint8Array,
    outSize: number,
    opts: PpmdOptions,
): Uint8Array {
    checkOpts(opts);
    if (!Number.isSafeInteger(outSize) || outSize < 0) {
        throw new RangeError("PPMd outSize must be a non-negative integer");
    }
    return guard((ex) => {
        reserve(ex, "in", input.length);
        reserve(ex, "out", outSize);
        new Uint8Array(
            ex.memory.buffer,
            ex.ppmd_in_reserve(input.length),
            input.length,
        ).set(input);
        const r = ex.ppmd_decode(
            input.length,
            outSize,
            opts.order,
            opts.memSize,
        );
        if (r !== 0) {
            throw new Error(
                `PPMd decode failed: ${DECODE_ERRORS[r] ?? `code ${r}`}`,
            );
        }
        return copyOut(ex, ex.ppmd_out_reserve(outSize), outSize);
    });
}
