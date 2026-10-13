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
 * appears as soon as an engine can decode it, with no code change.
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
     * A partial (or the first complete) frame. The frame is closed right after
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
    let decoding = false;
    let lastPreview = 0;
    let finished = false;

    // One decode in flight at a time, and never faster than the interval:
    // GIF's decode() answers at once with whatever it has, so an unthrottled
    // loop would spin.
    const preview = async () => {
        decoding = true;
        try {
            const { image } = await decoder.decode({
                frameIndex: 0,
                completeFramesOnly: false,
            });
            try {
                if (!finished) opts.onPreview(image);
            } finally {
                image.close();
            }
        } catch {
            // Not enough data for a first frame yet, or a decoder error. The
            // real result is the verified blob below, so a preview that fails
            // is simply a preview we do not show.
        } finally {
            decoding = false;
            lastPreview = Date.now();
        }
    };

    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            parts.push(value);
            // A copy: the decoder may take ownership of what it is handed, and
            // `parts` has to stay whole for the final blob.
            controller.enqueue(value.slice());
            if (!decoding && Date.now() - lastPreview >= PREVIEW_INTERVAL_MS) {
                void preview();
            }
        }
        // The last read has passed the integrity check (a mismatch threw).
        controller.close();
        return new Blob(parts as BlobPart[], {
            type: safeAttachmentMimeType(opts.mimetype),
        });
    } finally {
        finished = true;
        try {
            controller.close();
        } catch {
            /* already closed */
        }
        decoder.close();
    }
}
