import { KEEP_MARGIN, scrollParent } from "./unloadOffscreen";

/**
 * Svelte action: report when a played `<video>` that is no longer playing
 * (paused or ended) is well out of view, so its owner can unmount it.
 *
 * A paused video keeps its decoder and frame buffers in video memory for as
 * long as the element exists, and the timeline never unmounts rows: every
 * clip played in a session stayed resident (~40 MB each for 720p). One that
 * is still playing is left alone; the user may be listening to it.
 * `onPark` gets the position to resume from (0 once it has ended).
 */
export function parkOffscreen(
    node: HTMLVideoElement,
    onPark: (resumeAt: number) => void,
) {
    let park = onPark;
    let away = false;
    let parked = false;

    function check() {
        if (parked || !away || !(node.paused || node.ended)) return;
        parked = true;
        park(node.ended ? 0 : node.currentTime);
    }

    if (typeof IntersectionObserver !== "function") return {};
    const observer = new IntersectionObserver(
        ([entry]) => {
            away = !entry.isIntersecting;
            check();
        },
        { root: scrollParent(node), rootMargin: KEEP_MARGIN, threshold: 0 },
    );
    observer.observe(node);
    node.addEventListener("pause", check);
    node.addEventListener("ended", check);

    return {
        update(next: (resumeAt: number) => void) {
            park = next;
        },
        destroy() {
            observer.disconnect();
            node.removeEventListener("pause", check);
            node.removeEventListener("ended", check);
        },
    };
}
