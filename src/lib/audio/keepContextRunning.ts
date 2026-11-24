/**
 * Keep a call's AudioContext running across the app going to the background.
 *
 * iOS Safari (and Home Screen web apps) stops every AudioContext when the app
 * is backgrounded or another app takes the audio session, reporting
 * "interrupted" (older WebKit: "suspended"), and does not always start it
 * again on return. A stopped context makes no sound: for the mic chain that
 * means the call sends silence, so the user is muted without knowing it.
 * So: whenever the context stops while the page is visible, and whenever the
 * page comes back, ask it to resume.
 */

/** Whether a context has stopped but can be resumed: held by autoplay policy
 *  ("suspended") or by the OS ("interrupted", WebKit). */
export function contextNeedsResume(state: string): boolean {
    return state === "suspended" || state === "interrupted";
}

interface ContextLike {
    readonly state: string;
    resume(): Promise<void>;
    addEventListener(type: "statechange", listener: () => void): void;
    removeEventListener(type: "statechange", listener: () => void): void;
}

interface PageLike {
    readonly visibilityState: string;
    addEventListener(type: string, listener: () => void): void;
    removeEventListener(type: string, listener: () => void): void;
}

/** Resume `ctx` whenever it has stopped and the page is visible. Returns the
 *  teardown. */
export function keepContextRunning(
    ctx: ContextLike,
    page: PageLike | undefined = typeof document === "undefined"
        ? undefined
        : document,
    win: PageLike | undefined = typeof window === "undefined"
        ? undefined
        : (window as unknown as PageLike),
): () => void {
    const kick = () => {
        if (!contextNeedsResume(ctx.state)) return;
        if (page && page.visibilityState !== "visible") return;
        void ctx.resume().catch(() => {});
    };
    ctx.addEventListener("statechange", kick);
    page?.addEventListener("visibilitychange", kick);
    // iOS can restore a page from the back/forward cache without a
    // visibilitychange.
    win?.addEventListener("pageshow", kick);
    win?.addEventListener("focus", kick);
    return () => {
        ctx.removeEventListener("statechange", kick);
        page?.removeEventListener("visibilitychange", kick);
        win?.removeEventListener("pageshow", kick);
        win?.removeEventListener("focus", kick);
    };
}
