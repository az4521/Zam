// Telegram sticker pack import. Requests go through one transport, which is
// either the Zam sticker proxy (default) or api.telegram.org with the user's
// own bot token. A bot token exists only in the caller's memory and in the
// request URLs. It is never persisted, logged, or copied into an error.
//
// Animated (.tgs) stickers are Lottie JSON. They are rendered frame by frame
// with @lottiefiles/dotlottie-web (ThorVG compiled to wasm, no eval) and
// packed into an animated WebP. Video (.webm) stickers are decoded by a
// detached <video> element and sampled at fixed times. Both kinds share one
// encoder: animated WebP, or APNG where the browser cannot encode WebP
// (Safari). The renderer is dynamically imported so it stays out of the main
// bundle.

import { captureClient, ownedClientOrThrow } from "$lib/matrix/runtime";
import { addUserSticker, type PackImageMeta } from "$lib/matrix/client";
import { uploadContent } from "$lib/matrix/media";
import { encodeApng, type ApngFrame } from "$lib/utils/apng";
import { muxAnimatedWebp, type AwebpFrame } from "$lib/utils/awebp";
import { stickerShortcode } from "$lib/utils/telegramSticker";
import { shortcodeNameFor } from "$lib/data/emojiShortcodes";
import { planVideoFrames } from "$lib/utils/videoFrames";
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
/** Video sticker decoding: metadata once, then one seek per sampled frame. */
const VIDEO_METADATA_TIMEOUT_MS = 10_000;
const VIDEO_SEEK_TIMEOUT_MS = 5_000;
const DEFAULT_CONCURRENCY = 3;
/** One Bot API call or file download, body included. */
const REQUEST_TIMEOUT_MS = 30_000;

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
 * Fetches `url` and reads the response with `read`, under one timeout that
 * covers the body too: a stalled proxy or Telegram connection fails that
 * sticker instead of holding an import worker forever. A proxy-side network
 * failure or timeout becomes TelegramProxyError. A user abort passes through.
 */
async function send<T>(
    source: TelegramSource,
    url: string,
    signal: AbortSignal | undefined,
    read: (res: Response) => Promise<T>,
): Promise<T> {
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, REQUEST_TIMEOUT_MS);
    try {
        const res = await fetch(url, { signal: controller.signal });
        return await read(res);
    } catch (err) {
        if (signal?.aborted) throw err;
        if (err instanceof TelegramProxyError) throw err;
        if (err instanceof TelegramApiError) throw err;
        if (source.mode === "proxy") {
            throw new TelegramProxyError("unavailable");
        }
        if (timedOut) throw new Error("telegram request timed out");
        throw err;
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
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
            return send(
                source,
                requestUrl(source, "api", method, params),
                signal,
                async (res) => {
                    checkProxyStatus(source, res.status);
                    let body: {
                        ok?: boolean;
                        result?: T;
                        description?: string;
                    };
                    try {
                        body = await res.json();
                    } catch (err) {
                        if (signal?.aborted) throw err;
                        throw new TelegramApiError(`HTTP ${res.status}`);
                    }
                    if (!body.ok || body.result === undefined) {
                        throw new TelegramApiError(
                            body.description ?? `HTTP ${res.status}`,
                        );
                    }
                    return body.result;
                },
            );
        },
        async download(
            filePath: string,
            signal?: AbortSignal,
        ): Promise<Uint8Array> {
            return send(
                source,
                requestUrl(source, "file", filePath, {}),
                signal,
                async (res) => {
                    checkProxyStatus(source, res.status);
                    if (!res.ok) {
                        throw new TelegramApiError(
                            `sticker download failed (${res.status})`,
                        );
                    }
                    return new Uint8Array(await res.arrayBuffer());
                },
            );
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

/** One frame to encode: how long it shows, and how to paint it on the canvas. */
interface CanvasFrame {
    delayMs: number;
    /** Paints the frame. The canvas is already cleared to transparent. */
    draw(): void | Promise<void>;
}

/**
 * Shared encoder for every animated source. Each frame is cleared, painted
 * with `draw`, and read back from the canvas. The result is an animated WebP
 * when the browser can encode WebP. Otherwise it is an APNG. Because a frame
 * may need to be painted twice (once per encoder), `draw` must be repeatable.
 */
async function encodeCanvasFrames(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    frames: CanvasFrame[],
    signal?: AbortSignal,
): Promise<ConvertedAnimation> {
    const { width, height } = canvas;
    const webpFrames = await renderWebpFrames(canvas, ctx, frames, signal);
    if (webpFrames) {
        try {
            return {
                bytes: muxAnimatedWebp(webpFrames, width, height),
                mimetype: "image/webp",
                width,
                height,
            };
        } catch {
            // A WebP the muxer cannot read is treated like no WebP support.
        }
    }

    const apngFrames: ApngFrame[] = [];
    for (const frame of frames) {
        if (signal?.aborted) throw new DOMException("aborted", "AbortError");
        ctx.clearRect(0, 0, width, height);
        await frame.draw();
        apngFrames.push({
            width,
            height,
            delayMs: frame.delayMs,
            rgba: ctx.getImageData(0, 0, width, height).data,
        });
    }
    return {
        bytes: await encodeApng(apngFrames),
        mimetype: "image/png",
        width,
        height,
    };
}

/**
 * Renders the frames as still WebP files. Returns null as soon as the browser
 * hands back anything other than WebP (Safari falls back to PNG), so the
 * caller can take the APNG path instead.
 */
async function renderWebpFrames(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    frames: CanvasFrame[],
    signal?: AbortSignal,
): Promise<AwebpFrame[] | null> {
    const out: AwebpFrame[] = [];
    for (const frame of frames) {
        if (signal?.aborted) throw new DOMException("aborted", "AbortError");
        // Clear first so transparent pixels stay transparent in every frame.
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        await frame.draw();
        const blob = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
        if (!blob || blob.type !== "image/webp") return null;
        out.push({
            webp: new Uint8Array(await blob.arrayBuffer()),
            delayMs: frame.delayMs,
        });
    }
    return out;
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
        const frames: CanvasFrame[] = [];
        for (let index = 0; index < total; index += step) {
            frames.push({
                delayMs: Math.min(step, total - index) * frameMs,
                draw: () => player.setFrame(index),
            });
        }
        return await encodeCanvasFrames(canvas, ctx, frames, signal);
    } finally {
        player.destroy();
    }
}

/**
 * Resolves on the first `event` from the element. Rejects on a media error,
 * on timeout, or on abort. Every listener and the timer are removed on each
 * exit path.
 */
function waitForVideoEvent(
    video: HTMLVideoElement,
    event: "loadedmetadata" | "seeked",
    timeoutMs: number,
    what: string,
    signal?: AbortSignal,
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException("aborted", "AbortError"));
            return;
        }
        const cleanup = () => {
            clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);
            video.removeEventListener(event, onOk);
            video.removeEventListener("error", onError);
        };
        const onOk = () => {
            cleanup();
            resolve();
        };
        const onError = () => {
            cleanup();
            reject(new Error("video sticker could not be decoded"));
        };
        const onAbort = () => {
            cleanup();
            reject(new DOMException("aborted", "AbortError"));
        };
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error(`${what} timed out`));
        }, timeoutMs);
        signal?.addEventListener("abort", onAbort, { once: true });
        video.addEventListener(event, onOk);
        video.addEventListener("error", onError);
    });
}

/** Seeks the video to `time` and waits until that frame can be drawn. */
function seekVideo(
    video: HTMLVideoElement,
    time: number,
    signal?: AbortSignal,
): Promise<void> {
    // Already at this instant with a frame ready: no seeked event will come.
    if (
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        Math.abs(video.currentTime - time) < 1e-3
    ) {
        return Promise.resolve();
    }
    const seeked = waitForVideoEvent(
        video,
        "seeked",
        VIDEO_SEEK_TIMEOUT_MS,
        "video seek",
        signal,
    );
    video.currentTime = time;
    return seeked;
}

/**
 * Converts a .webm video sticker (VP9 with alpha) into an animated WebP, or
 * into an APNG when the browser cannot encode WebP. The clip is decoded by a
 * detached <video> element (never attached to the DOM) and sampled at fixed
 * times, so the output has at most MAX_FRAMES frames and fits MAX_SIDE. A clip
 * the browser cannot decode throws, and the caller counts it as a failure.
 */
export async function convertWebm(
    bytes: Uint8Array,
    signal?: AbortSignal,
): Promise<ConvertedAnimation> {
    const url = URL.createObjectURL(
        new Blob([bytes as BlobPart], { type: "video/webm" }),
    );
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    try {
        const loaded = waitForVideoEvent(
            video,
            "loadedmetadata",
            VIDEO_METADATA_TIMEOUT_MS,
            "video metadata",
            signal,
        );
        video.src = url;
        await loaded;
        if (video.error || video.videoWidth === 0 || video.videoHeight === 0) {
            throw new Error("video sticker could not be decoded");
        }
        const plan = planVideoFrames({
            srcWidth: video.videoWidth,
            srcHeight: video.videoHeight,
            duration: video.duration,
            maxSide: MAX_SIDE,
            maxFrames: MAX_FRAMES,
        });
        const canvas = document.createElement("canvas");
        canvas.width = plan.width;
        canvas.height = plan.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("2D canvas is unavailable");

        const frames: CanvasFrame[] = plan.times.map((time) => ({
            delayMs: plan.delayMs,
            async draw() {
                await seekVideo(video, time, signal);
                ctx.drawImage(video, 0, 0, plan.width, plan.height);
            },
        }));
        return await encodeCanvasFrames(canvas, ctx, frames, signal);
    } finally {
        video.pause();
        video.removeAttribute("src");
        video.load();
        URL.revokeObjectURL(url);
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
    const emojiName = sticker.emoji
        ? shortcodeNameFor(sticker.emoji)
        : undefined;
    const shortcode = stickerShortcode(setName, index, emojiName);
    const bytes = await downloadSticker(transport, sticker.file_id, signal);
    let file: File;
    let info: Record<string, unknown>;
    if (sticker.is_video || sticker.is_animated) {
        // Video (.webm) and Lottie (.tgs) stickers both become an image that
        // Matrix clients can show as a sticker. A WebM is never uploaded as-is.
        const converted = sticker.is_video
            ? await convertWebm(bytes, signal)
            : await convertTgs(bytes, signal);
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
