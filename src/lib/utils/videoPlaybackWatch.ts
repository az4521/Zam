// Whether any <video> on the page is playing, for the main process: on the
// Flatpak's NVIDIA Vulkan path a GPU crash only says something about that path
// when it happens while video is being decoded (electron/main.cjs).
//
// Media events don't bubble, but a capturing listener on the document sees
// them all. A playing <video> taken out of the page fires nothing, so while
// one plays the state is also rechecked every few seconds.

const MEDIA_EVENTS = [
    "playing",
    "pause",
    "ended",
    "emptied",
    "abort",
    "error",
] as const;

const RECHECK_MS = 5000;

export function anyVideoPlaying(root: ParentNode): boolean {
    for (const video of root.querySelectorAll("video"))
        if (!video.paused && !video.ended) return true;
    return false;
}

/** Calls `onChange` whenever "some video is playing" flips. Returns a stop
 *  function. */
export function watchVideoPlayback(
    onChange: (playing: boolean) => void,
    doc: Document = document,
): () => void {
    let playing = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const check = () => {
        const now = anyVideoPlaying(doc);
        if (now === playing) return;
        playing = now;
        if (playing && !timer) timer = setInterval(check, RECHECK_MS);
        if (!playing && timer) {
            clearInterval(timer);
            timer = null;
        }
        onChange(playing);
    };
    for (const name of MEDIA_EVENTS) doc.addEventListener(name, check, true);
    return () => {
        for (const name of MEDIA_EVENTS)
            doc.removeEventListener(name, check, true);
        if (timer) clearInterval(timer);
    };
}
