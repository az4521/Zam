/**
 * A shared "the timeline is covered" signal for the video actions.
 *
 * While the Lightbox is open it covers the whole timeline, but the timeline's
 * own looping videos (and GIF tiles) keep their decoders, with generous
 * margins, behind it. The Lightbox holds this signal, and the actions that own
 * those `<video>` `src`s drop them while it is held, so the decoder pool is
 * left to the one video in front. Holds are counted, so overlapping owners
 * don't release early.
 */

let holds = 0;
const listeners = new Set<() => void>();

function notify(): void {
    for (const fn of [...listeners]) fn();
}

/** Hold the timeline's video decoders. Returns the release, which is idempotent. */
export function holdVideoDecoders(): () => void {
    holds++;
    notify();
    let released = false;
    return () => {
        if (released) return;
        released = true;
        holds = Math.max(0, holds - 1);
        notify();
    };
}

/** Whether any owner currently holds the timeline's video decoders. */
export function videoDecodersHeld(): boolean {
    return holds > 0;
}

/** Called whenever the hold state changes. Returns the unsubscribe. */
export function onVideoDecodersHeldChange(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
    };
}
