import { KEEP_MARGIN, inFullscreen, scrollParent } from "./unloadOffscreen";

/** Parameters for the {@link parkYoutubeOffscreen} action. */
export interface ParkYoutubeParams {
    /** Called once the player is not playing and well out of view, with
     *  the position to resume from (0 once it has ended). */
    onPark: (resumeAt: number) => void;
    /** Pause a playing video as it leaves the viewport (the
     *  pauseVideoOnScrollOff setting, as pauseOffscreen does for `<video>`). */
    pause: boolean;
}

const YT_ORIGINS = new Set([
    "https://www.youtube.com",
    "https://www.youtube-nocookie.com",
]);

// YT.PlayerState: playing and buffering count as playing; unstarted (-1),
// ended (0), paused (2) and cued (5) do not.
const PLAYING = new Set([1, 3]);

/**
 * Svelte action: report when a YouTube embed (`enablejsapi=1`) that is not
 * playing is well out of view, so its owner can swap it back for its
 * thumbnail.
 *
 * Each embed is a whole YouTube player page in its own frame, with its own
 * decoder once played, and the timeline never unmounts rows: every video
 * played in a session stayed resident. The player's state comes from the
 * iframe API's postMessage channel; one that never reports is never parked,
 * since it may be playing.
 */
export function parkYoutubeOffscreen(
    node: HTMLIFrameElement,
    params: ParkYoutubeParams,
) {
    let { onPark, pause } = params;
    let state: number | null = null;
    let time = 0;
    let away = false;
    let visible = true;
    let parked = false;

    function post(message: object) {
        node.contentWindow?.postMessage(JSON.stringify(message), "*");
    }

    function check() {
        if (parked || !away || state === null || PLAYING.has(state)) return;
        if (inFullscreen(node)) return;
        parked = true;
        onPark(state === 0 ? 0 : time);
    }

    function onMessage(e: MessageEvent) {
        if (e.source !== node.contentWindow || !YT_ORIGINS.has(e.origin))
            return;
        let data: any;
        try {
            data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        } catch {
            return;
        }
        if (data?.event === "onStateChange" && typeof data.info === "number") {
            state = data.info;
        } else if (data?.event === "infoDelivery" && data.info) {
            if (typeof data.info.playerState === "number")
                state = data.info.playerState;
            if (typeof data.info.currentTime === "number")
                time = data.info.currentTime;
        } else {
            return;
        }
        stopHandshake();
        check();
    }
    window.addEventListener("message", onMessage);

    // The player only starts reporting after a "listening" message, and
    // drops one sent before its script is up, so repeat it until it answers
    // (as the official iframe API does).
    let tries = 0;
    let handshake: ReturnType<typeof setInterval> | null = setInterval(() => {
        if (++tries > 40) stopHandshake();
        else post({ event: "listening", id: 1, channel: "widget" });
    }, 250);
    function stopHandshake() {
        if (handshake !== null) clearInterval(handshake);
        handshake = null;
    }

    const observers: IntersectionObserver[] = [];
    if (typeof IntersectionObserver === "function") {
        const far = new IntersectionObserver(
            ([entry]) => {
                away = !entry.isIntersecting;
                check();
            },
            { root: scrollParent(node), rootMargin: KEEP_MARGIN, threshold: 0 },
        );
        const near = new IntersectionObserver(
            ([entry]) => {
                const wasVisible = visible;
                visible = entry.isIntersecting;
                if (
                    wasVisible &&
                    !visible &&
                    pause &&
                    state === 1 &&
                    !inFullscreen(node)
                )
                    post({ event: "command", func: "pauseVideo", args: [] });
            },
            { threshold: 0 },
        );
        far.observe(node);
        near.observe(node);
        observers.push(far, near);
    }
    document.addEventListener("fullscreenchange", check);

    return {
        update(next: ParkYoutubeParams) {
            onPark = next.onPark;
            pause = next.pause;
        },
        destroy() {
            stopHandshake();
            window.removeEventListener("message", onMessage);
            document.removeEventListener("fullscreenchange", check);
            for (const o of observers) o.disconnect();
        },
    };
}
