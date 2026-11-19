/**
 * The native screen share's placeholder track (see native/share-capture and
 * electron/ native-share for Windows, lib/androidScreenShare.ts for Android).
 * The helper process captures and encodes the picked screen; the track LiveKit
 * publishes is a 64x64 placeholder, whose encoded frames the substitution
 * stage replaces with the helper's access units (utils/nativeShareSubstitute).
 *
 * The placeholder track comes from workers/nativeShare.worker.ts. The
 * substitution stage is the E2EE worker's (audio/redundancy/hook.ts) in an
 * encrypted room, and workers/nativeShareSubstitute.worker.ts's
 * RTCRtpScriptTransform in a plain one. Each stage gets the substitution port
 * from the source, once.
 *
 * Windows wraps the source in a processor for its capture track
 * (createNativeShareProcessor). Android publishes the source's track directly
 * (createNativeShareSource), since its share has no capture track.
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
    | { cmd: "fps"; fps: number }
    | { cmd: "bitrate"; bps: number; lowBps?: number };

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

/** The placeholder side of a native share, without a capture track to
 *  process. The Android share publishes `track` directly; the Windows share
 *  wraps it in a processor (createNativeShareProcessor). */
export interface NativeShareSource {
    /** The placeholder track LiveKit publishes. */
    readonly track: MediaStreamTrack;
    /** The decoded helper stream, for the sender's own tile. */
    readonly previewTrack: MediaStreamTrack;
    /** The substitution end of the port, once. Null after the first call. */
    takeSubstitutionPort(): MessagePort | null;
    /** Change the helper's frame rate or bitrate while it runs. */
    send(command: NativeShareCommand): void;
    /** Stop the placeholders and the helper. Idempotent. */
    destroy(): void;
}

export interface NativeShareOptions {
    /** The share's frame rate (the placeholders run at twice it). */
    fps: number;
    /** The helper ended on its own (window closed, capture failed). */
    onEnded: (reason: string) => void;
    /** The helper reported what it started with. */
    onInfo?: (info: NativeShareInfo) => void;
    /** The source was destroyed (the share stopped). */
    onDestroy?: () => void;
    /** The helper sends two simulcast layers (Windows): a placeholder large
     *  enough for WebRTC to encode both. */
    layered?: boolean;
}

export function nativeShareSupported(): boolean {
    const g = globalThis as unknown as Partial<FrameStreams>;
    return (
        typeof g.MediaStreamTrackGenerator === "function" &&
        typeof Worker !== "undefined"
    );
}

/** Start the placeholder side for a helper port: the placeholder and preview
 *  generators, and the worker that feeds them. Null where the browser can't
 *  hand frames to script. */
export function createNativeShareSource(
    helper: MessagePort,
    opts: NativeShareOptions,
): NativeShareSource | null {
    const g = globalThis as unknown as Partial<FrameStreams>;
    if (!g.MediaStreamTrackGenerator || typeof Worker === "undefined")
        return null;
    const Generator = g.MediaStreamTrackGenerator;
    const channel = new MessageChannel();
    let substitution: MessagePort | null = channel.port2;
    let destroyed = false;
    const generator = new Generator({ kind: "video" });
    const preview = new Generator({ kind: "video" });
    preview.contentHint = "detail";
    generator.contentHint = "detail";
    const worker = new Worker(
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
        if (e.data.type === "info" && e.data.info) opts.onInfo?.(e.data.info);
        else if (e.data.type === "ended") opts.onEnded(e.data.reason ?? "");
    };
    worker.postMessage(
        {
            writable: generator.writable,
            preview: preview.writable,
            helper,
            sub: channel.port1,
            fps: opts.fps,
            layered: opts.layered === true,
        },
        [
            generator.writable as unknown as Transferable,
            preview.writable as unknown as Transferable,
            helper as unknown as Transferable,
            channel.port1 as unknown as Transferable,
        ],
    );
    return {
        track: generator,
        previewTrack: preview,
        takeSubstitutionPort() {
            const port = substitution;
            substitution = null;
            return port;
        },
        send(command) {
            if (!destroyed) worker.postMessage(command);
        },
        destroy() {
            if (destroyed) return;
            destroyed = true;
            generator.stop();
            // The worker tells the helper to stop and then reports "ended";
            // terminating it before that dropped the stop, leaving the
            // helper to notice the closed port on its own.
            const kill = setTimeout(() => worker.terminate(), 1000);
            worker.addEventListener("message", (e: MessageEvent) => {
                if ((e.data as { type?: string } | null)?.type !== "ended")
                    return;
                clearTimeout(kill);
                worker.terminate();
            });
            worker.postMessage({ cmd: "stop" });
            substitution?.close();
            substitution = null;
            opts.onDestroy?.();
        },
    };
}

/** Build the processor for a helper port (the one the page received from
 *  main), for the Windows share's capture track. Null where the browser can't
 *  hand frames to script. */
export function createNativeShareProcessor(
    helper: MessagePort,
    opts: NativeShareOptions,
): NativeShareProcessor | null {
    if (!nativeShareSupported()) return null;
    let source: NativeShareSource | null = null;
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
            source = createNativeShareSource(helper, opts);
            if (!source)
                throw new Error("native share needs a track generator");
            processor.previewTrack = source.previewTrack;
            processor.processedTrack = source.track;
        },
        async restart({ track }) {
            // The helper port was transferred on the first init and cannot
            // be sent again, and destroying the source ends the share: keep
            // it and only quiet the new capture track.
            if (!source) throw new Error("native share already ended");
            await track
                .applyConstraints({
                    width: { ideal: NATIVE_PLACEHOLDER_SIZE },
                    height: { ideal: NATIVE_PLACEHOLDER_SIZE },
                    frameRate: { ideal: 1 },
                })
                .catch(() => {});
        },
        takeSubstitutionPort() {
            return source?.takeSubstitutionPort() ?? null;
        },
        send(command) {
            source?.send(command);
        },
        async destroy() {
            const s = source;
            source = null;
            processor.processedTrack = undefined;
            s?.destroy();
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

/** Make a native share's track report the helper's picture size instead of
 *  its 64x64 placeholder's. LiveKit reads `dimensions` when it publishes (the
 *  size the server and every other client are told, and the size its layers
 *  are built for); `size` returns null until the helper has said. */
export function reportSizeFrom(
    track: LivekitClient.LocalTrack,
    size: () => { width: number; height: number } | null,
): void {
    const proto = Object.getPrototypeOf(track) as object;
    let desc: PropertyDescriptor | undefined;
    for (let o: object | null = proto; o && !desc; o = Object.getPrototypeOf(o))
        desc = Object.getOwnPropertyDescriptor(o, "dimensions");
    const original = desc?.get;
    Object.defineProperty(track, "dimensions", {
        configurable: true,
        get() {
            return size() ?? original?.call(track);
        },
    });
}

/** Tell the call server a published video track's size (LiveKit's
 *  UpdateLocalVideoTrack signal, which the server passes on to subscribers
 *  in the track's info). LiveKit only sends this from its own resize
 *  handling, which never sees a native share's real size. */
export async function sendTrackSize(
    room: LivekitClient.Room,
    trackSid: string,
    width: number,
    height: number,
): Promise<void> {
    const engine = room.engine as unknown as {
        client?: {
            sendRequest?: (message: {
                case: "updateVideoTrack";
                value: { trackSid: string; width: number; height: number };
            }) => Promise<void>;
        };
    };
    await engine.client?.sendRequest?.({
        case: "updateVideoTrack",
        value: { trackSid, width, height },
    });
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

/** Preview tracks of native shares that publish their placeholder directly
 *  (the Android share), keyed by the placeholder track. */
const directPreviews = new WeakMap<MediaStreamTrack, MediaStreamTrack>();

/** Register the preview of a placeholder that is published directly. */
export function registerNativePreview(
    placeholder: MediaStreamTrack,
    preview: MediaStreamTrack,
): void {
    directPreviews.set(placeholder, preview);
}

/** The local preview of a native share (the decoded helper stream), when the
 *  track is one: the tile shows this instead of the placeholder. Null for any
 *  other track. */
export function nativeSharePreview(track: unknown): MediaStreamTrack | null {
    const t = track as {
        getProcessor?: () =>
            | { name?: string; previewTrack?: MediaStreamTrack | null }
            | undefined;
        mediaStreamTrack?: MediaStreamTrack;
    };
    const p = t.getProcessor?.();
    if (p?.name === NATIVE_SHARE_PROCESSOR) return p.previewTrack ?? null;
    const placeholder = t.mediaStreamTrack;
    return placeholder ? (directPreviews.get(placeholder) ?? null) : null;
}
