import {
    attachAuthedVideo,
    type AuthedVideoStream,
} from "$lib/matrix/videoStream";

/** Parameters for the {@link authedVideoSrc} action. */
export interface AuthedVideoSrcParams {
    /** Homeserver media URL to stream, or null to leave the element alone. */
    url: string | null;
    mimetype?: string | null;
    onError?: () => void;
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
            // Read through `current` so a re-bound callback is honoured.
            onError: () => current.onError?.(),
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
