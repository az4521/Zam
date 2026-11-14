/** Hidden for less than this, the player is never suspended: a quick
 *  alt-tab doesn't need checking. */
export const MIN_HIDDEN_MS = 5000;

/** How long a looping video gets, once the page is back, to put up a frame
 *  before it is taken for dead. */
export const FRAME_GRACE_MS = 1000;

type FrameCallbackVideo = HTMLVideoElement & {
    requestVideoFrameCallback?: (cb: () => void) => number;
    cancelVideoFrameCallback?: (handle: number) => void;
};

/**
 * Bring a looping GIF-style `<video>` back to life after the page has sat in
 * the background, calling `reload` if it doesn't draw again on its own.
 *
 * While the window is hidden, Chromium suspends its media players and frees
 * their hardware decoders and frame buffers (and Windows may trim the GPU's
 * memory on top). A player with controls gets rebuilt on the next play(), but
 * these have none and nothing calls play(): coming back, the element is left
 * showing an empty black or white box until it is scrolled far enough away
 * for unloadOffscreen/gifTileVideo to drop and reload it.
 *
 * So on the way back, each loaded video gets {@link FRAME_GRACE_MS} to
 * present a new frame (requestVideoFrameCallback). One that does was fine and
 * is left alone, so a healthy GIF doesn't flash its poster; one that doesn't
 * is reloaded. Without requestVideoFrameCallback there is no way to tell, so
 * every loaded one is reloaded.
 *
 * `isLoaded` says whether the owner currently has a source on the element;
 * an unloaded one has nothing to lose. Returns the teardown.
 */
export function reviveOnReturn(
    node: HTMLVideoElement,
    isLoaded: () => boolean,
    reload: () => void,
): () => void {
    const video = node as FrameCallbackVideo;
    let hiddenAt: number | null =
        document.visibilityState === "hidden" ? Date.now() : null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let frameHandle: number | null = null;

    function cancelCheck() {
        if (timer !== null) clearTimeout(timer);
        timer = null;
        if (frameHandle !== null) video.cancelVideoFrameCallback?.(frameHandle);
        frameHandle = null;
    }

    function check() {
        if (!isLoaded()) return;
        if (typeof video.requestVideoFrameCallback !== "function") {
            reload();
            return;
        }
        frameHandle = video.requestVideoFrameCallback(() => {
            frameHandle = null;
            cancelCheck();
        });
        timer = setTimeout(() => {
            timer = null;
            if (frameHandle !== null)
                video.cancelVideoFrameCallback?.(frameHandle);
            frameHandle = null;
            if (document.visibilityState === "hidden" || !isLoaded()) return;
            reload();
        }, FRAME_GRACE_MS);
    }

    function onVisibility() {
        if (document.visibilityState === "hidden") {
            cancelCheck();
            hiddenAt ??= Date.now();
            return;
        }
        const since = hiddenAt;
        hiddenAt = null;
        if (since === null || Date.now() - since < MIN_HIDDEN_MS) return;
        cancelCheck();
        check();
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
        document.removeEventListener("visibilitychange", onVisibility);
        cancelCheck();
    };
}
