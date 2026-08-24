/** Parameters for the {@link pauseOffscreen} action. */
export interface PauseOffscreenParams {
    /** When false the observer is torn down and videos are never auto-paused. */
    enabled: boolean;
}

/**
 * Decide whether an off-screen event should pause this `<video>`.
 *
 * Returns true ONLY for a video that is actively playing (not paused, not
 * ended) and has left the viewport. It never returns true for a video that is
 * already paused or finished — so this feature only ever calls `.pause()`, and
 * NEVER resumes a video (resume stays user-driven).
 */
export function shouldPauseVideo(state: {
    isIntersecting: boolean;
    paused: boolean;
    ended: boolean;
}): boolean {
    if (state.paused || state.ended) return false;
    return !state.isIntersecting;
}

/**
 * Svelte action: pause a playing `<video>` when it scrolls out of the viewport.
 *
 * Mirrors `FlashEmbed.svelte`'s suspend-on-`!isIntersecting` pattern with an
 * `IntersectionObserver({ threshold: 0 })`. Resume is deliberately NOT handled
 * here — the user restarts playback themselves. Disabling the setting tears the
 * observer down; re-enabling reconnects it.
 */
export function pauseOffscreen(
    node: HTMLVideoElement,
    params: PauseOffscreenParams,
) {
    let enabled = params.enabled;
    let observer: IntersectionObserver | null = null;

    function connect() {
        if (observer) return;
        if (typeof IntersectionObserver !== "function") return;
        observer = new IntersectionObserver(
            ([entry]) => {
                if (
                    shouldPauseVideo({
                        isIntersecting: entry.isIntersecting,
                        paused: node.paused,
                        ended: node.ended,
                    })
                ) {
                    node.pause();
                }
            },
            { threshold: 0 },
        );
        observer.observe(node);
    }

    function disconnect() {
        observer?.disconnect();
        observer = null;
    }

    if (enabled) connect();

    return {
        update(next: PauseOffscreenParams) {
            if (next.enabled === enabled) return;
            enabled = next.enabled;
            if (enabled) connect();
            else disconnect();
        },
        destroy() {
            disconnect();
        },
    };
}
