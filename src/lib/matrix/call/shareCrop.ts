/**
 * A LiveKit track processor that sends a screen share trimmed to sizes a GPU
 * encoder takes (utils/shareCrop), so HEVC can carry tabs, windows and
 * oddly sized monitors. The trimming runs in workers/shareCrop.worker.ts.
 * Only where the browser can hand video frames to script (Chromium's
 * MediaStreamTrackProcessor and MediaStreamTrackGenerator); elsewhere there
 * is no processor and the share's codec is picked to avoid HEVC instead.
 */
import type * as LivekitClient from "livekit-client";

export const SHARE_CROP_PROCESSOR = "zam-share-crop";

interface FrameStreams {
    MediaStreamTrackProcessor: new (init: { track: MediaStreamTrack }) => {
        readable: ReadableStream<VideoFrame>;
    };
    MediaStreamTrackGenerator: new (init: {
        kind: "video";
    }) => MediaStreamTrack & {
        writable: WritableStream<VideoFrame>;
    };
}

function frameStreams(): FrameStreams | null {
    const g = globalThis as unknown as Partial<FrameStreams>;
    return g.MediaStreamTrackProcessor && g.MediaStreamTrackGenerator
        ? (g as FrameStreams)
        : null;
}

export function shareCropSupported(): boolean {
    return frameStreams() !== null && typeof Worker !== "undefined";
}

export type ShareCropProcessor =
    LivekitClient.TrackProcessor<LivekitClient.Track.Kind.Video> & {
        /** Trim frames to whole blocks of `align` pixels from now on. */
        setAlign(align: number): void;
    };

export function createShareCropProcessor(): ShareCropProcessor | null {
    const streams = frameStreams();
    if (!streams || typeof Worker === "undefined") return null;
    let worker: Worker | null = null;
    let align: number | null = null;
    const processor: ShareCropProcessor = {
        name: SHARE_CROP_PROCESSOR,
        async init({ track }) {
            const source = new streams.MediaStreamTrackProcessor({ track });
            const generator = new streams.MediaStreamTrackGenerator({
                kind: "video",
            });
            // The encoder reads this to keep text sharp, as on the capture.
            generator.contentHint = track.contentHint;
            worker = new Worker(
                new URL("../../workers/shareCrop.worker.ts", import.meta.url),
                { type: "module" },
            );
            worker.postMessage(
                { readable: source.readable, writable: generator.writable },
                [
                    source.readable as unknown as Transferable,
                    generator.writable as unknown as Transferable,
                ],
            );
            if (align !== null) worker.postMessage({ align });
            processor.processedTrack = generator;
        },
        async restart(opts) {
            await processor.destroy();
            await processor.init(opts);
        },
        setAlign(next) {
            align = next;
            worker?.postMessage({ align });
        },
        async destroy() {
            processor.processedTrack?.stop();
            processor.processedTrack = undefined;
            worker?.terminate();
            worker = null;
        },
    };
    return processor;
}
