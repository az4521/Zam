/// <reference lib="webworker" />
/**
 * Rewrites a baseline JPEG as progressive (see $lib/utils/jpegProgressive).
 * Runs in a worker because a big photo is a couple of seconds of CPU that
 * would otherwise freeze the UI while sending. Driven by
 * $lib/utils/progressiveJpegUpload.ts.
 */
import { jpegToProgressive } from "$lib/utils/jpegProgressive";

export interface JpegProgressiveRequest {
    id: number;
    jpeg: ArrayBuffer;
}

/** `jpeg` is null when the file should be sent as it is. */
export type JpegProgressiveResponse =
    { id: number; jpeg: ArrayBuffer | null } | { id: number; error: string };

self.onmessage = (e: MessageEvent<JpegProgressiveRequest>) => {
    const { id } = e.data;
    const scope = self as DedicatedWorkerGlobalScope;
    try {
        const out = jpegToProgressive(new Uint8Array(e.data.jpeg));
        if (!out) {
            scope.postMessage({
                id,
                jpeg: null,
            } satisfies JpegProgressiveResponse);
            return;
        }
        // A copy that owns exactly its bytes, so it can be transferred.
        const buf = out.slice().buffer as ArrayBuffer;
        scope.postMessage({ id, jpeg: buf } satisfies JpegProgressiveResponse, [
            buf,
        ]);
    } catch (err) {
        scope.postMessage({
            id,
            error: err instanceof Error ? err.message : String(err),
        } satisfies JpegProgressiveResponse);
    }
};
