// Things that would be cut off if the page stopped and reloaded in the
// background (backgroundRelease.ts) hold this while they run.

let holds = 0;

/** Keep the page running until the returned release is called (once). */
export function holdPageAlive(): () => void {
    holds++;
    let released = false;
    return () => {
        if (released) return;
        released = true;
        holds--;
    };
}

export function pageKeepAliveHolds(): number {
    return holds;
}
