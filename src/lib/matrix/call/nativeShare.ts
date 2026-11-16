/**
 * The native Windows screen share's track processor (see
 * native/share-capture and electron/ native-share). The helper process captures
 * and encodes the picked window or screen; the track LiveKit publishes is a
 * 64x64 placeholder, whose encoded frames the substitution stage replaces with
 * the helper's access units (utils/nativeShareSubstitute).
 *
 * The placeholder track comes from workers/nativeShare.worker.ts. The
 * substitution stage is the E2EE worker's (audio/redundancy/hook.ts) in an
 * encrypted room, and workers/nativeShareSubstitute.worker.ts's
 * RTCRtpScriptTransform in a plain one. Each stage gets the substitution port
 * from this processor, once.
 */
import type * as LivekitClient from "livekit-client";
import { ZAM_NATIVE_SHARE } from "$lib/audio/redundancy/protocol";
import { NATIVE_PLACEHOLDER_SIZE } from "$lib/utils/nativeShareSubstitute";

export const NATIVE_SHARE_PROCESSOR = "zam-native-share";

/** What the helper reports about itself (electron/ native-share protocol). */
export interface NativeShareInfo {
    event?: string;
    encoder?: string;
    hardware?: boolean;
    width?: number;
    height?: number;
    fps?: number;
    message?: string;
    /** Helper's periodic stats (event "stats"). */
    captureFps?: number;
    encodeMsAvg?: number;
    /** Helper's total encoded AUs so far (event "stats"). */
    encoded?: number;
    /** Capture worker's per-2 s counts (event "writer"). */
    aus?: number;
    writes?: number;
}

/** A command the renderer sends the helper through the worker. */
export type NativeShareCommand =
    { cmd: "fps"; fps: number } | { cmd: "bitrate"; bps: number };

interface FrameStreams {
    MediaStreamTrackGenerator: new (init: {
        kind: "video";
    }) => MediaStreamTrack & { writable: WritableStream<VideoFrame> };
}

export type NativeShareProcessor =
    LivekitClient.TrackProcessor<LivekitClient.Track.Kind.Video> & {
        /** What the sender's own tile shows: the decoded helper stream (the
         *  published track is the placeholder, which nobody watches locally). */
        previewTrack: MediaStreamTrack | null;
        /** The substitution end of the port, for one stage (E2EE worker or
         *  RTCRtpScriptTransform worker). Null after the first call. */
        takeSubstitutionPort(): MessagePort | null;
        /** Change the helper's frame rate or bitrate while it runs. */
        send(command: NativeShareCommand): void;
    };

export interface NativeShareOptions {
    /** The share's frame rate (the placeholders run at twice it). */
    fps: number;
    /** The helper ended on its own (window closed, capture failed). */
    onEnded: (reason: string) => void;
    /** The helper reported what it started with. */
    onInfo?: (info: NativeShareInfo) => void;
    /** The processor was destroyed (the share stopped). */
    onDestroy?: () => void;
}

export function nativeShareSupported(): boolean {
    const g = globalThis as unknown as Partial<FrameStreams>;
    return (
        typeof g.MediaStreamTrackGenerator === "function" &&
        typeof Worker !== "undefined"
    );
}

/** Build the processor for a helper port (the one the page received from
 *  main). Null where the browser can't hand frames to script. */
export function createNativeShareProcessor(
    helper: MessagePort,
    opts: NativeShareOptions,
): NativeShareProcessor | null {
    const g = globalThis as unknown as Partial<FrameStreams>;
    if (!g.MediaStreamTrackGenerator || typeof Worker === "undefined")
        return null;
    const Generator = g.MediaStreamTrackGenerator;
    const channel = new MessageChannel();
    let substitution: MessagePort | null = channel.port2;
    let worker: Worker | null = null;
    let destroyed = false;

    const processor: NativeShareProcessor = {
        name: NATIVE_SHARE_PROCESSOR,
        previewTrack: null,
        async init({ track }) {
            // The Chromium capture only keeps the share alive. Its frames are
            // never sent, so it runs at its smallest, slowest setting.
            await track
                .applyConstraints({
                    width: { ideal: NATIVE_PLACEHOLDER_SIZE },
                    height: { ideal: NATIVE_PLACEHOLDER_SIZE },
                    frameRate: { ideal: 1 },
                })
                .catch(() => {});
            const generator = new Generator({ kind: "video" });
            const preview = new Generator({ kind: "video" });
            preview.contentHint = "detail";
            processor.previewTrack = preview;
            generator.contentHint = "detail";
            worker = new Worker(
                new URL("../../workers/nativeShare.worker.ts", import.meta.url),
                { type: "module" },
            );
            worker.onmessage = (
                e: MessageEvent<{
                    type: string;
                    reason?: string;
                    info?: NativeShareInfo;
                }>,
            ) => {
                if (destroyed) return;
                if (e.data.type === "info" && e.data.info)
                    opts.onInfo?.(e.data.info);
                else if (e.data.type === "ended")
                    opts.onEnded(e.data.reason ?? "");
            };
            worker.postMessage(
                {
                    writable: generator.writable,
                    preview: preview.writable,
                    helper,
                    sub: channel.port1,
                    fps: opts.fps,
                },
                [
                    generator.writable as unknown as Transferable,
                    preview.writable as unknown as Transferable,
                    helper as unknown as Transferable,
                    channel.port1 as unknown as Transferable,
                ],
            );
            processor.processedTrack = generator;
        },
        async restart(opts) {
            await processor.destroy();
            await processor.init(opts);
        },
        takeSubstitutionPort() {
            const port = substitution;
            substitution = null;
            return port;
        },
        send(command) {
            worker?.postMessage(command);
        },
        async destroy() {
            if (destroyed) return;
            destroyed = true;
            processor.processedTrack?.stop();
            processor.processedTrack = undefined;
            // The worker tells the helper to stop; terminating it closes the
            // port too, which stops the helper all the same.
            worker?.postMessage({ cmd: "stop" });
            worker?.terminate();
            worker = null;
            substitution?.close();
            substitution = null;
            opts.onDestroy?.();
        },
    };
    return processor;
}

/** The publisher's RTCPeerConnection, for a plain (unencrypted) call's
 *  share transform. LiveKit keeps it private; it is read here, in one place. */
export function publisherConnection(
    room: LivekitClient.Room,
): RTCPeerConnection | null {
    const engine = room.engine as unknown as {
        pcManager?: { publisher?: { pc?: RTCPeerConnection | null } };
    };
    return engine.pcManager?.publisher?.pc ?? null;
}

/** Sender transforms queued for a plain call. Chromium only applies an
 *  RTCRtpScriptTransform set before the sender's negotiation: one set after
 *  the connection is up is ignored (measured in a loopback harness, while one
 *  set in the negotiationneeded event, before the offer, works). So the share's
 *  sender gets its transform from the publisher's negotiationneeded event. */
const queuedTransforms = new Map<MediaStreamTrack, Worker>();
const watchedConnections = new WeakSet<RTCPeerConnection>();

function applyQueuedTransforms(pc: RTCPeerConnection): void {
    for (const sender of pc.getSenders()) {
        const track = sender.track;
        if (!track) continue;
        const worker = queuedTransforms.get(track);
        if (!worker || sender.transform) continue;
        sender.transform = new RTCRtpScriptTransform(worker, {});
        queuedTransforms.delete(track);
    }
}

/** Queue `worker` as the transform of the sender carrying `track`, and watch
 *  `pc` for the negotiation that adds it. */
export function queueSenderTransform(
    pc: RTCPeerConnection,
    track: MediaStreamTrack,
    worker: Worker,
): void {
    queuedTransforms.set(track, worker);
    if (!watchedConnections.has(pc)) {
        watchedConnections.add(pc);
        pc.addEventListener("negotiationneeded", () =>
            applyQueuedTransforms(pc),
        );
    }
}

/** Forget a queued transform (the share ended, or it was never applied).
 *  The worker itself is the caller's to end. */
export function dropQueuedTransform(track: MediaStreamTrack | undefined): void {
    if (track) queuedTransforms.delete(track);
}

/** Whether the share's sender got its transform (checked after publish). */
export function senderHasTransform(
    pc: RTCPeerConnection,
    track: MediaStreamTrack,
): boolean {
    return pc.getSenders().some((s) => s.track === track && !!s.transform);
}

/** Post the substitution port to an E2EE worker: the worker that encodes the
 *  room the share goes to. */
export function attachToE2EEWorker(worker: Worker, port: MessagePort): void {
    worker.postMessage({ kind: ZAM_NATIVE_SHARE, data: { port } }, [port]);
}

/** The worker that runs a plain call's share transform. */
export function createSubstitutionWorker(port: MessagePort): Worker {
    const worker = new Worker(
        new URL(
            "../../workers/nativeShareSubstitute.worker.ts",
            import.meta.url,
        ),
        { type: "module" },
    );
    // The worker's periodic substitution stats (diagnostic) come back here.
    worker.onmessage = (e: MessageEvent<{ stats?: string }>) => {
        if (e.data?.stats) console.info(e.data.stats);
    };
    worker.postMessage({ port }, [port]);
    return worker;
}

/** The local preview of a native share (the decoded helper stream), when the
 *  track is one: the tile shows this instead of the placeholder. Null for any
 *  other track. */
export function nativeSharePreview(track: unknown): MediaStreamTrack | null {
    const p = (
        track as {
            getProcessor?: () =>
                | { name?: string; previewTrack?: MediaStreamTrack | null }
                | undefined;
        }
    ).getProcessor?.();
    return p?.name === NATIVE_SHARE_PROCESSOR ? (p.previewTrack ?? null) : null;
}
