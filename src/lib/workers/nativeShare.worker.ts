/// <reference lib="webworker" />
/**
 * Feeds the native screen share (matrix/call/nativeShare). Off the main
 * thread so a busy page never stalls the helper's frames.
 *
 * Two jobs:
 * - Placeholders. A 64x64 placeholder is written on a fixed timer at twice
 *   the share's frame rate, stamped with real time. Each access unit (AU) the
 *   helper makes goes to the substitution stage (utils/nativeShareSubstitute),
 *   which gives it to the next placeholder the encoder outputs. A placeholder
 *   with no AU waiting is dropped there, so the AU queue can't back up behind
 *   the encoder: placeholders follow time, AUs follow the helper.
 * - Local preview. Every AU is also decoded (WebCodecs, H.264) into a second
 *   generator that only the sender's own tile shows, so the tile matches what
 *   is sent. Nothing published changes.
 */
import {
    NATIVE_PLACEHOLDER_FILL,
    NATIVE_PLACEHOLDER_SIZE,
} from "$lib/utils/nativeShareSubstitute";

interface StartMessage {
    writable: WritableStream<VideoFrame>;
    /** The preview generator's writable (the sender's own tile). */
    preview: WritableStream<VideoFrame>;
    /** The helper's end of the port (see electron/ native-share protocol). */
    helper: MessagePort;
    /** The substitution end: AUs go out here, key requests come back. */
    sub: MessagePort;
    /** The share's frame rate; placeholders run at twice it. */
    fps: number;
}

type ToMain =
    { type: "info"; info: unknown } | { type: "ended"; reason: string };

const canvas = new OffscreenCanvas(
    NATIVE_PLACEHOLDER_SIZE,
    NATIVE_PLACEHOLDER_SIZE,
);
const ctx = canvas.getContext("2d");
let writer: WritableStreamDefaultWriter<VideoFrame> | null = null;
let previewWriter: WritableStreamDefaultWriter<VideoFrame> | null = null;
let helper: MessagePort | null = null;
let sub: MessagePort | null = null;
let fps = 60;
let placeholderTimer: ReturnType<typeof setInterval> | null = null;

/** Diagnostic: AUs received, placeholders written, per 2 s window. */
let aus = 0;
let writes = 0;
let skippedNotReady = 0;
const statsTimer = setInterval(() => {
    if (aus === 0 && writes === 0) return;
    self.postMessage({
        type: "info",
        info: { event: "writer", aus, writes, skippedNotReady },
    } satisfies ToMain);
    aus = 0;
    writes = 0;
    skippedNotReady = 0;
}, 2000);

/** Fill the placeholder once. It stays one colour: a changing picture makes
 *  the encoder insert a keyframe every 256 frames (NATIVE_PLACEHOLDER_FILL). */
function draw(): void {
    if (!ctx) return;
    ctx.fillStyle = NATIVE_PLACEHOLDER_FILL;
    ctx.fillRect(0, 0, NATIVE_PLACEHOLDER_SIZE, NATIVE_PLACEHOLDER_SIZE);
}

/** Write one placeholder, stamped with real time (µs). Skipped (not queued)
 *  when the generator can't take it now: a placeholder is only a carrier. */
function tick(): void {
    if (!writer) return;
    if ((writer.desiredSize ?? 1) <= 0) {
        skippedNotReady++;
        return;
    }
    const frame = new VideoFrame(canvas, {
        timestamp: Math.round(performance.now() * 1000),
        duration: Math.round(1e6 / fps),
    });
    writes++;
    writer.write(frame).catch(() => {});
}

function startPlaceholders(): void {
    if (placeholderTimer) clearInterval(placeholderTimer);
    placeholderTimer = setInterval(tick, Math.max(1, 500 / fps));
}

// ---------------------------------------------------------------- preview

let decoder: VideoDecoder | null = null;
let needKey = true;

/** H.264 codec string (avc1.PPCCLL) from the first SPS in an AU. */
function codecFromSps(data: Uint8Array): string | null {
    for (let i = 0; i + 6 < data.length; i++) {
        // Start code 00 00 01 followed by an SPS NAL header (type 7).
        if (
            data[i] === 0 &&
            data[i + 1] === 0 &&
            data[i + 2] === 1 &&
            (data[i + 3] & 0x1f) === 7
        ) {
            const hex = (n: number) => n.toString(16).padStart(2, "0");
            return `avc1.${hex(data[i + 4])}${hex(data[i + 5])}${hex(data[i + 6])}`;
        }
    }
    return null;
}

function hasKeyNal(data: Uint8Array): boolean {
    for (let i = 0; i + 3 < data.length; i++)
        if (
            data[i] === 0 &&
            data[i + 1] === 0 &&
            data[i + 2] === 1 &&
            (data[i + 3] & 0x1f) === 5
        )
            return true;
    return false;
}

/** Tell the page what the preview decoder is doing (diagnostic). */
function previewInfo(message: string): void {
    self.postMessage({
        type: "info",
        info: { event: "preview", message },
    } satisfies ToMain);
}

function resetDecoder(): void {
    try {
        decoder?.close();
    } catch {
        // Already closed by an error.
    }
    decoder = null;
    needKey = true;
}

/** Decode one AU into the preview. A decode error resets the decoder, and
 *  decoding restarts at the next keyframe AU (deltas need references). */
function decodeAu(au: { key: boolean; ts: number; data: ArrayBuffer }): void {
    if (!previewWriter || typeof VideoDecoder === "undefined") return;
    const bytes = new Uint8Array(au.data);
    if (!decoder) {
        if (!hasKeyNal(bytes)) return;
        const codec = codecFromSps(bytes);
        if (!codec) return;
        const dec = new VideoDecoder({
            output: (frame) => {
                // A full preview drops the frame rather than queue it.
                if (!previewWriter || (previewWriter.desiredSize ?? 1) <= 0) {
                    frame.close();
                    return;
                }
                previewWriter.write(frame).catch(() => frame.close());
            },
            error: (e) => {
                previewInfo(`decoder error: ${e.message}`);
                resetDecoder();
            },
        });
        try {
            dec.configure({
                codec,
                hardwareAcceleration: "prefer-hardware",
                optimizeForLatency: true,
            });
            previewInfo(`decoder configured ${codec}`);
        } catch (e) {
            previewInfo(`configure failed ${codec}: ${String(e)}`);
            dec.close();
            return;
        }
        decoder = dec;
        needKey = true;
    }
    if (needKey && !hasKeyNal(bytes)) return;
    needKey = false;
    try {
        decoder.decode(
            new EncodedVideoChunk({
                type: au.key ? "key" : "delta",
                timestamp: au.ts,
                data: bytes,
            }),
        );
    } catch {
        resetDecoder();
    }
}

// ---------------------------------------------------------------- AUs

function onAu(au: {
    type: "au";
    key: boolean;
    ts: number;
    data: ArrayBuffer;
}): void {
    if (!sub) return;
    // The preview decodes first: EncodedVideoChunk copies its bytes, and the
    // transfer below detaches au.data (decoding after it saw an empty buffer,
    // so the preview never configured a decoder).
    aus++;
    decodeAu(au);
    // The AU goes to the substitution stage (the next placeholder carries it).
    sub.postMessage({ key: au.key, ts: au.ts, data: au.data }, [au.data]);
}

function stop(reason: string): void {
    if (placeholderTimer) clearInterval(placeholderTimer);
    placeholderTimer = null;
    clearInterval(statsTimer);
    resetDecoder();
    helper?.postMessage({ cmd: "stop" });
    helper?.close();
    sub?.close();
    helper = null;
    sub = null;
    writer?.close().catch(() => {});
    writer = null;
    previewWriter?.close().catch(() => {});
    previewWriter = null;
    self.postMessage({ type: "ended", reason } satisfies ToMain);
}

self.onmessage = (
    e: MessageEvent<
        | StartMessage
        | { cmd: "stop" }
        | { cmd: "fps"; fps: number }
        | { cmd: "bitrate"; bps: number }
    >,
) => {
    const msg = e.data;
    if ("cmd" in msg) {
        // stop ends the helper; fps and bitrate are passed on to it.
        if (msg.cmd === "stop") stop("stop");
        else {
            if (msg.cmd === "fps") {
                fps = msg.fps;
                startPlaceholders();
            }
            helper?.postMessage(msg);
        }
        return;
    }
    writer = msg.writable.getWriter();
    previewWriter = msg.preview.getWriter();
    helper = msg.helper;
    sub = msg.sub;
    fps = msg.fps;
    draw();
    startPlaceholders();
    sub.onmessage = (ev: MessageEvent<{ req?: string } | null>) => {
        if (ev.data?.req === "key") helper?.postMessage({ cmd: "key" });
    };
    helper.onmessage = (ev: MessageEvent<unknown>) => {
        const m = ev.data as
            | { type: "au"; key: boolean; ts: number; data: ArrayBuffer }
            | { type: "info"; info: unknown }
            | { type: "ended"; reason: string }
            | null;
        if (!m) return;
        if (m.type === "au") onAu(m);
        else if (m.type === "info")
            self.postMessage({ type: "info", info: m.info } satisfies ToMain);
        else if (m.type === "ended") stop(m.reason);
    };
};
