// Telegram sticker pack import. Requests go through one transport, which is
// either the Zam sticker proxy (default) or api.telegram.org with the user's
// own bot token. A bot token exists only in the caller's memory and in the
// request URLs. It is never persisted, logged, or copied into an error.
//
// Animated (.tgs) stickers are Lottie JSON. They are rendered frame by frame
// with @lottiefiles/dotlottie-web (ThorVG compiled to wasm, no eval) and
// packed into an animated WebP. Where the browser cannot encode WebP (Safari),
// they are packed into an APNG instead. The renderer is dynamically imported
// so it stays out of the main bundle.

import { captureClient, ownedClientOrThrow } from "$lib/matrix/runtime";
import { addUserSticker, type PackImageMeta } from "$lib/matrix/client";
import { uploadContent } from "$lib/matrix/media";
import { encodeApng, type ApngFrame } from "$lib/utils/apng";
import { muxAnimatedWebp, type AwebpFrame } from "$lib/utils/awebp";
import { stickerShortcode } from "$lib/utils/telegramSticker";
import {
    buildBotApiUrl,
    buildProxyUrl,
    proxyFailureFromStatus,
    TelegramProxyError,
    type TelegramSource,
} from "$lib/utils/telegramProxy";
import type { DotLottie } from "@lottiefiles/dotlottie-web";

/** Output caps: keeps each animated sticker to a sane size in Matrix. */
const MAX_SIDE = 256;
const MAX_FRAMES = 60;
/** Ceiling on decompressed .tgs JSON, guards against a gzip bomb. */
const MAX_TGS_JSON_BYTES = 32 * 1024 * 1024;
const LOAD_TIMEOUT_MS = 15_000;
const DEFAULT_CONCURRENCY = 3;

/** An error Telegram reported. `description` is Telegram's own text. */
export class TelegramApiError extends Error {
    readonly description: string;
    constructor(description: string) {
        super(description);
        this.name = "TelegramApiError";
        this.description = description;
    }
}

export interface TelegramSticker {
    file_id: string;
    emoji?: string;
    width?: number;
    height?: number;
    is_animated?: boolean;
    is_video?: boolean;
}

export interface TelegramStickerSet {
    name: string;
    title: string;
    stickers: TelegramSticker[];
}

/** The two request paths the importer needs, whichever transport is used. */
export interface TelegramTransport {
    readonly mode: "direct" | "proxy";
    /** Calls a Bot API method and returns its `result`. */
    metadata<T>(
        method: string,
        params: Record<string, string>,
        signal?: AbortSignal,
    ): Promise<T>;
    /** Downloads a file by the file_path that getFile returned. */
    download(filePath: string, signal?: AbortSignal): Promise<Uint8Array>;
}

function requestUrl(
    source: TelegramSource,
    kind: "api" | "file",
    pathOrMethod: string,
    params: Record<string, string>,
): string {
    if (source.mode === "proxy") {
        return buildProxyUrl(kind, pathOrMethod, params, source.config);
    }
    return buildBotApiUrl(source.token, kind, pathOrMethod, params);
}

/**
 * fetch that turns a proxy-side network failure into TelegramProxyError.
 * Aborts and direct-mode errors pass through unchanged.
 */
async function send(
    source: TelegramSource,
    url: string,
    signal: AbortSignal | undefined,
): Promise<Response> {
    try {
        return await fetch(url, { signal });
    } catch (err) {
        if (signal?.aborted) throw err;
        if (source.mode === "proxy") {
            throw new TelegramProxyError("unavailable");
        }
        throw err;
    }
}

/** In proxy mode, a 403 or 502/503/504 becomes TelegramProxyError. */
function checkProxyStatus(source: TelegramSource, status: number): void {
    if (source.mode !== "proxy") return;
    const reason = proxyFailureFromStatus(status);
    if (reason) throw new TelegramProxyError(reason);
}

export function createTelegramTransport(
    source: TelegramSource,
): TelegramTransport {
    return {
        mode: source.mode,
        async metadata<T>(
            method: string,
            params: Record<string, string>,
            signal?: AbortSignal,
        ): Promise<T> {
            const res = await send(
                source,
                requestUrl(source, "api", method, params),
                signal,
            );
            checkProxyStatus(source, res.status);
            let body: { ok?: boolean; result?: T; description?: string };
            try {
                body = await res.json();
            } catch {
                throw new TelegramApiError(`HTTP ${res.status}`);
            }
            if (!body.ok || body.result === undefined) {
                throw new TelegramApiError(
                    body.description ?? `HTTP ${res.status}`,
                );
            }
            return body.result;
        },
        async download(
            filePath: string,
            signal?: AbortSignal,
        ): Promise<Uint8Array> {
            const res = await send(
                source,
                requestUrl(source, "file", filePath, {}),
                signal,
            );
            checkProxyStatus(source, res.status);
            if (!res.ok) {
                throw new Error(`sticker download failed (${res.status})`);
            }
            return new Uint8Array(await res.arrayBuffer());
        },
    };
}

export async function fetchStickerSet(
    transport: TelegramTransport,
    name: string,
    signal?: AbortSignal,
): Promise<TelegramStickerSet> {
    const result = await transport.metadata<TelegramStickerSet>(
        "getStickerSet",
        { name },
        signal,
    );
    return { ...result, stickers: result.stickers ?? [] };
}

/** Downloads one sticker file. The file path is resolved with getFile first. */
export async function downloadSticker(
    transport: TelegramTransport,
    fileId: string,
    signal?: AbortSignal,
): Promise<Uint8Array> {
    const file = await transport.metadata<{ file_path?: string }>(
        "getFile",
        { file_id: fileId },
        signal,
    );
    if (!file.file_path) throw new TelegramApiError("no file_path");
    return transport.download(file.file_path, signal);
}

/** Runs bytes through a (de)compression stream and collects the output. */
async function transformBytes(
    input: Uint8Array,
    stream: { writable: WritableStream; readable: ReadableStream },
    maxBytes: number,
): Promise<Uint8Array> {
    const writer = stream.writable.getWriter();
    const writing = writer
        .write(input as BufferSource)
        .then(() => writer.close());
    const reader = stream.readable.getReader();
    const parts: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel();
            throw new Error("decompressed sticker is too large");
        }
        parts.push(value as Uint8Array);
    }
    await writing;
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.byteLength;
    }
    return out;
}

function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
    return transformBytes(
        bytes,
        new DecompressionStream("gzip"),
        MAX_TGS_JSON_BYTES,
    );
}

let rendererPromise: Promise<
    typeof import("@lottiefiles/dotlottie-web")
> | null = null;

/**
 * Loads the renderer once, pointing it at the wasm that Vite emits as a
 * same-origin asset. Nothing is fetched from a CDN.
 */
function loadRenderer(): Promise<typeof import("@lottiefiles/dotlottie-web")> {
    if (!rendererPromise) {
        rendererPromise = (async () => {
            const [lib, wasm] = await Promise.all([
                import("@lottiefiles/dotlottie-web"),
                import("@lottiefiles/dotlottie-web/dotlottie-player.wasm?url"),
            ]);
            lib.DotLottie.setWasmUrl(wasm.default);
            return lib;
        })();
        // A failed load (e.g. a dropped network request) must not stick.
        rendererPromise.catch(() => {
            rendererPromise = null;
        });
    }
    return rendererPromise;
}

function waitForLoad(player: DotLottie, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error("animation load timed out")),
            LOAD_TIMEOUT_MS,
        );
        const onAbort = () => {
            clearTimeout(timer);
            reject(new DOMException("aborted", "AbortError"));
        };
        signal?.addEventListener("abort", onAbort, { once: true });
        player.addEventListener("load", () => {
            clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);
            resolve();
        });
        player.addEventListener("loadError", () => {
            clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);
            reject(new Error("animation could not be loaded"));
        });
    });
}

export interface ConvertedAnimation {
    bytes: Uint8Array;
    /** "image/webp" normally; "image/png" (APNG) when WebP encoding is missing. */
    mimetype: "image/webp" | "image/png";
    width: number;
    height: number;
}

const WEBP_QUALITY = 0.7;

function canvasToBlob(
    canvas: HTMLCanvasElement,
    type: string,
    quality?: number,
): Promise<Blob | null> {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Renders the given frames as still WebP files. Returns null as soon as the
 * browser hands back anything other than WebP (Safari falls back to PNG), so
 * the caller can take the APNG path instead.
 */
async function renderWebpFrames(
    player: DotLottie,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    indexes: number[],
    delayFor: (index: number) => number,
    signal?: AbortSignal,
): Promise<AwebpFrame[] | null> {
    const frames: AwebpFrame[] = [];
    for (const index of indexes) {
        if (signal?.aborted) throw new DOMException("aborted", "AbortError");
        // Clear first so transparent pixels stay transparent in every frame.
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        player.setFrame(index);
        const blob = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
        if (!blob || blob.type !== "image/webp") return null;
        frames.push({
            webp: new Uint8Array(await blob.arrayBuffer()),
            delayMs: delayFor(index),
        });
    }
    return frames;
}

/**
 * Converts a .tgs sticker (gzipped Lottie JSON) into an animated WebP, or
 * into an APNG when the browser cannot encode WebP. Frames are subsampled so
 * that no more than MAX_FRAMES are stored, and the total run time is kept by
 * stretching each stored frame's delay.
 */
export async function convertTgs(
    tgs: Uint8Array,
    signal?: AbortSignal,
): Promise<ConvertedAnimation> {
    const json = new TextDecoder().decode(await gunzip(tgs));
    const lottie = JSON.parse(json) as { w?: number; h?: number };
    const srcW = Math.max(1, Math.round(lottie.w ?? MAX_SIDE));
    const srcH = Math.max(1, Math.round(lottie.h ?? MAX_SIDE));
    const scale = Math.min(1, MAX_SIDE / Math.max(srcW, srcH));
    const width = Math.max(1, Math.round(srcW * scale));
    const height = Math.max(1, Math.round(srcH * scale));

    const lib = await loadRenderer();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("2D canvas is unavailable");

    const player = new lib.DotLottie({
        canvas,
        data: json,
        autoplay: false,
        loop: false,
    });
    try {
        await waitForLoad(player, signal);
        const total = player.totalFrames;
        const durationMs = player.duration * 1000;
        if (!(total > 0) || !(durationMs > 0)) {
            throw new Error("animation has no frames");
        }
        const frameMs = durationMs / total;
        const step = Math.max(1, Math.ceil(total / MAX_FRAMES));
        const indexes: number[] = [];
        for (let index = 0; index < total; index += step) indexes.push(index);
        const delayFor = (index: number) =>
            Math.min(step, total - index) * frameMs;

        const webp = await renderWebpFrames(
            player,
            canvas,
            ctx,
            indexes,
            delayFor,
            signal,
        );
        if (webp) {
            try {
                return {
                    bytes: muxAnimatedWebp(webp, width, height),
                    mimetype: "image/webp",
                    width,
                    height,
                };
            } catch {
                // A WebP the muxer cannot read is treated like no WebP support.
            }
        }

        const frames: ApngFrame[] = [];
        for (const index of indexes) {
            if (signal?.aborted)
                throw new DOMException("aborted", "AbortError");
            ctx.clearRect(0, 0, width, height);
            player.setFrame(index);
            const pixels = ctx.getImageData(0, 0, width, height).data;
            frames.push({
                width,
                height,
                delayMs: delayFor(index),
                rgba: pixels,
            });
        }
        return {
            bytes: await encodeApng(frames),
            mimetype: "image/png",
            width,
            height,
        };
    } finally {
        player.destroy();
    }
}

export interface TelegramImportProgress {
    done: number;
    total: number;
}

export interface TelegramImportOptions {
    transport: TelegramTransport;
    setName: string;
    signal?: AbortSignal;
    onProgress?: (progress: TelegramImportProgress) => void;
    concurrency?: number;
}

export interface TelegramImportResult {
    title: string;
    total: number;
    imported: number;
    failed: number;
    cancelled: boolean;
    /** True when any sticker failed with a proxy-side error. */
    proxyFailed: boolean;
}

interface PreparedSticker {
    shortcode: string;
    mxcUrl: string;
    meta: PackImageMeta;
}

async function prepareSticker(
    transport: TelegramTransport,
    setName: string,
    sticker: TelegramSticker,
    index: number,
    signal: AbortSignal | undefined,
): Promise<{ shortcode: string; file: File; meta: PackImageMeta }> {
    const shortcode = stickerShortcode(setName, index);
    const bytes = await downloadSticker(transport, sticker.file_id, signal);
    let file: File;
    let info: Record<string, unknown>;
    if (sticker.is_animated) {
        const converted = await convertTgs(bytes, signal);
        const ext = converted.mimetype === "image/webp" ? "webp" : "png";
        file = new File([converted.bytes as BlobPart], `${shortcode}.${ext}`, {
            type: converted.mimetype,
        });
        info = {
            w: converted.width,
            h: converted.height,
            mimetype: converted.mimetype,
            size: converted.bytes.byteLength,
        };
    } else if (sticker.is_video) {
        // Uploaded unchanged. A WebM cannot be shown in an <img>, so these
        // stay invisible in the pack list (see the report).
        file = new File([bytes as BlobPart], `${shortcode}.webm`, {
            type: "video/webm",
        });
        info = {
            w: sticker.width,
            h: sticker.height,
            mimetype: "video/webm",
            size: bytes.byteLength,
        };
    } else {
        file = new File([bytes as BlobPart], `${shortcode}.webp`, {
            type: "image/webp",
        });
        info = {
            w: sticker.width,
            h: sticker.height,
            mimetype: "image/webp",
            size: bytes.byteLength,
        };
    }
    return {
        shortcode,
        file,
        meta: {
            info,
            ...(sticker.emoji ? { body: sticker.emoji } : {}),
        },
    };
}

function isAbort(err: unknown): boolean {
    return err instanceof DOMException && err.name === "AbortError";
}

/**
 * Imports every sticker of a Telegram set into the user's own sticker pack.
 *
 * Stickers are prepared with limited concurrency. Pack writes go through one
 * serial queue, because each write is a read-modify-write of account data.
 * Per-sticker failures are counted, never thrown, so one bad sticker does not
 * stop the rest. Cancelling keeps the stickers already written.
 */
export async function importTelegramStickerSet(
    options: TelegramImportOptions,
): Promise<TelegramImportResult> {
    const { transport, setName, signal, onProgress } = options;
    const owner = captureClient();
    const set = await fetchStickerSet(transport, setName, signal);
    const stickers = set.stickers;
    const total = stickers.length;
    const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);

    let nextIndex = 0;
    let done = 0;
    let imported = 0;
    let failed = 0;
    let proxyFailed = false;
    let writeQueue: Promise<void> = Promise.resolve();

    const enqueueWrite = (sticker: PreparedSticker): Promise<void> => {
        const write = writeQueue.then(async () => {
            ownedClientOrThrow(owner);
            await addUserSticker(
                sticker.shortcode,
                sticker.mxcUrl,
                sticker.meta,
            );
        });
        writeQueue = write.catch(() => {});
        return write;
    };

    const worker = async (): Promise<void> => {
        while (!signal?.aborted) {
            const index = nextIndex++;
            if (index >= total) return;
            const sticker = stickers[index];
            const writes: Promise<void>[] = [];
            try {
                const prepared = await prepareSticker(
                    transport,
                    setName,
                    sticker,
                    index,
                    signal,
                );
                ownedClientOrThrow(owner);
                const mxcUrl = await uploadContent(prepared.file);
                writes.push(
                    enqueueWrite({
                        shortcode: prepared.shortcode,
                        mxcUrl,
                        meta: prepared.meta,
                    }).then(() => {
                        imported++;
                    }),
                );
            } catch (err) {
                if (isAbort(err) || signal?.aborted) return;
                if (err instanceof TelegramProxyError) proxyFailed = true;
                failed++;
            } finally {
                await Promise.all(
                    writes.map((write) =>
                        write.catch(() => {
                            failed++;
                        }),
                    ),
                );
                done++;
                onProgress?.({ done, total });
            }
        }
    };

    const workers = Array.from({ length: Math.min(concurrency, total) }, () =>
        worker(),
    );
    await Promise.all(workers);
    await writeQueue;

    return {
        title: set.title || set.name,
        total,
        imported,
        failed,
        cancelled: signal?.aborted ?? false,
        proxyFailed,
    };
}
