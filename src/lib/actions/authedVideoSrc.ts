import {
    attachAuthedVideo,
    type AuthedVideoStream,
} from "$lib/matrix/videoStream";
import type { EncryptedFileInfo } from "$lib/utils/decryptAttachment";
import type { DownloadProgress } from "$lib/utils/downloadProgress";

/** Parameters for the {@link authedVideoSrc} action. */
export interface AuthedVideoSrcParams {
    /** Homeserver media URL to stream, or null to leave the element alone. */
    url: string | null;
    mimetype?: string | null;
    onError?: (err: unknown) => void;
    /** Set for an encrypted attachment: it is decrypted while streaming. */
    decrypt?: EncryptedFileInfo;
    expectedSize?: number | null;
    onProgress?: (p: DownloadProgress) => void;
}

/**
 * Svelte action: feed a `<video>` from an authenticated homeserver URL without
 * relying on the service worker (see videoStream.ts). The element's own `src`
 * attribute must be left unset while `url` is non-null.
 */
export function authedVideoSrc(
    node: HTMLVideoElement,
    params: AuthedVideoSrcParams,
) {
    let current = params;
    let stream: AuthedVideoStream | null = null;

    function start() {
        if (!current.url) return;
        stream = attachAuthedVideo(node, current.url, {
            mimetype: current.mimetype,
            decrypt: current.decrypt,
            expectedSize: current.expectedSize,
            // Read through `current` so a re-bound callback is honoured.
            onProgress: (p) => current.onProgress?.(p),
            onError: (err) => current.onError?.(err),
        });
    }

    start();
    return {
        update(next: AuthedVideoSrcParams) {
            const changed = next.url !== current.url;
            current = next;
            if (!changed) return;
            stream?.dispose();
            stream = null;
            start();
        },
        destroy() {
            stream?.dispose();
            stream = null;
        },
    };
}
