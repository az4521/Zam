import { openAuthedReader } from "./mediaStream";
import type { EncryptedFileInfo } from "$lib/utils/decryptAttachment";
import type { DownloadProgress } from "$lib/utils/downloadProgress";
import { safeAttachmentMimeType } from "$lib/utils/attachmentMime";

/**
 * Show an encrypted image while it is still downloading.
 *
 * A finished blob URL only exists after the last byte has arrived and been
 * checked, so on a slow homeserver the image was a spinner until then. Plain
 * images do not have this problem (the browser paints a network <img> as it
 * loads) but an encrypted one only exists as bytes in JS.
 *
 * The WebCodecs `ImageDecoder` can decode partial data: it is fed the
 * decrypted bytes as they arrive and each pass is drawn onto a canvas.
 * Progressive JPEG sharpens in stages, interlaced GIF/PNG fill in, and a
 * baseline JPEG paints top to bottom. Any format the browser's ImageDecoder
 * supports works the same way, so e.g. JPEG XL (progressive by design)
 * appears as soon as an engine can decode it, with no code change. An
 * animated GIF/WebP/APNG starts playing once its first frame is whole, instead
 * of sitting on frame 0 until the last byte.
 *
 * ⚠ Like streamed video, those frames come from bytes that are NOT yet
 * integrity-checked: the SHA-256 covers the whole file. `load()` rejects if the
 * check fails, and the caller must then discard the preview. Only the finished,
 * verified blob is ever kept or saved. Callers gate on size
 * (PROGRESSIVE_IMAGE_MIN_BYTES) so small images keep verify-before-show.
 */

/** Encrypted images smaller than this are shown only once verified. */
export const PROGRESSIVE_IMAGE_MIN_BYTES = 256 * 1024;

/** Cap on how often a partial frame is decoded and drawn. */
const PREVIEW_INTERVAL_MS = 150;

/** True when this browser can decode `mimetype` incrementally. */
export async function canPreviewImage(
    mimetype: string | null | undefined,
): Promise<boolean> {
    if (typeof ImageDecoder === "undefined" || !mimetype) return false;
    try {
        return await ImageDecoder.isTypeSupported(mimetype);
    } catch {
        return false;
    }
}

export interface ProgressiveImageOptions {
    /** MIME type of the image, which must satisfy canPreviewImage. */
    mimetype: string;
    decrypt?: EncryptedFileInfo;
    expectedSize?: number | null;
    signal?: AbortSignal;
    onProgress?: (p: DownloadProgress) => void;
    /**
     * A partial first frame, the whole first frame, then (for an animated
     * image) each later frame when it is due. The frame is closed right after
     * this returns, so draw it or copy it, do not keep it.
     */
    onPreview: (frame: VideoFrame) => void;
}

/**
 * Download (and decrypt) the image at `httpUrl`, previewing it as it arrives.
 * Resolves with the whole, integrity-checked image as a Blob; rejects if the
 * download fails or the hash does not match.
 */
export async function loadImageProgressively(
    httpUrl: string,
    opts: ProgressiveImageOptions,
): Promise<Blob> {
    const reader = await openAuthedReader(httpUrl, {
        decrypt: opts.decrypt,
        expectedSize: opts.expectedSize,
        onProgress: opts.onProgress,
        signal: opts.signal,
    });

    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const feed = new ReadableStream<Uint8Array>({
        start(c) {
            controller = c;
        },
    });
    const decoder = new ImageDecoder({ type: opts.mimetype, data: feed });

    const parts: Uint8Array[] = [];
    let finished = false;

    // Settles (and is replaced) each time a chunk arrives or the load ends, so
    // the player below can wait for more data instead of polling.
    let wake!: () => void;
    let arrived = new Promise<void>((r) => (wake = r));
    const signal = () => {
        const w = wake;
        arrived = new Promise<void>((r) => (wake = r));
        w();
    };
    const draw = (image: VideoFrame) => {
        try {
            if (!finished) opts.onPreview(image);
        } finally {
            image.close();
        }
    };

    // Frame 0 is redrawn as it fills in, at most once per interval: GIF's
    // decode() answers at once with whatever it has, so an unthrottled loop
    // would spin. Once frame 0 is whole, an animated image (GIF, APNG,
    // animated WebP/AVIF) plays like a buffering video: each frame is shown as
    // soon as it has fully arrived and the previous one has had its delay, and
    // playback holds on the last complete frame while the download catches up.
    // A still image just stops there (its frame 1 never comes).
    //
    // A decode that fails is a preview we do not show (not enough data yet, or
    // a decoder error); the real result is the verified blob below.
    const play = async () => {
        let delay = 0;
        while (!finished) {
            await arrived;
            if (finished) return;
            const started = Date.now();
            try {
                const { image, complete } = await decoder.decode({
                    frameIndex: 0,
                    completeFramesOnly: false,
                });
                delay = frameDelayMs(image);
                draw(image);
                if (complete) break;
            } catch {
                /* see above */
            }
            await sleep(PREVIEW_INTERVAL_MS - (Date.now() - started));
        }
        let index = 0;
        let due = Date.now() + delay;
        while (!finished) {
            let image: VideoFrame;
            try {
                // Waits until the frame has fully arrived. Engines that reject
                // a frame they have not seen yet are retried on the next chunk.
                ({ image } = await decoder.decode({ frameIndex: index + 1 }));
            } catch {
                if (finished) return;
                await arrived;
                continue;
            }
            await sleep(due - Date.now());
            if (finished) {
                image.close();
                return;
            }
            delay = frameDelayMs(image);
            draw(image);
            index++;
            due = Date.now() + delay;
        }
    };
    void play();

    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            parts.push(value);
            // A copy: the decoder may take ownership of what it is handed, and
            // `parts` has to stay whole for the final blob.
            controller.enqueue(value.slice());
            signal();
        }
        // The last read has passed the integrity check (a mismatch threw).
        controller.close();
        return new Blob(parts as BlobPart[], {
            type: safeAttachmentMimeType(opts.mimetype),
        });
    } finally {
        finished = true;
        signal();
        try {
            controller.close();
        } catch {
            /* already closed */
        }
        decoder.close();
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, Math.max(0, ms)));
}

/**
 * How long `frame` stays up, in ms. Browsers show a GIF frame whose delay is
 * 10 ms or less (often written as 0) for 100 ms, so this does the same.
 */
export function frameDelayMs(frame: { duration: number | null }): number {
    const ms = (frame.duration ?? 0) / 1000;
    return ms > 10 ? ms : 100;
}
