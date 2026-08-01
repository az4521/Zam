/**
 * Lifecycle guards for media capture that is requested across an await.
 *
 * `navigator.mediaDevices.getUserMedia()` resolves whenever the user answers
 * the permission prompt — which can be long after the component that asked is
 * gone, or after a newer request superseded it. The requester's cleanup has
 * already run by then and found nothing to stop, so assigning the late stream
 * leaves a live microphone or camera with no UI able to release it (audit
 * MEDIA-01).
 *
 * The fix is to take a ticket before the await and re-check it after: a
 * capture is only adopted while its ticket is still the newest one on an
 * undisposed channel. Anything else is stopped on arrival.
 *
 * One lifecycle per capture CHANNEL, not per component: `beginCapture`
 * supersedes the channel it is called on, so a mic-meter restart must not
 * share a channel with a camera preview or it would cancel it.
 *
 * Deliberately free of DOM and SDK imports — capture handles are carried
 * opaquely through the structural `Stoppable` / `TrackSource` shapes, so a
 * MediaStream, a MediaStreamTrack and a mic-meter handle all fit.
 */

/** Anything releasable by calling `stop()` — a track, a meter handle. */
export interface Stoppable {
    stop(): void;
}

/** Anything that hands out stoppables — structurally a `MediaStream`. */
export interface TrackSource {
    getTracks(): Stoppable[];
}

/** A capture request's claim on its channel, taken before the await. */
export interface CaptureTicket {
    readonly generation: number;
}

/** Mutable per-channel state. Owned by the component; never global. */
export interface CaptureLifecycle {
    generation: number;
    disposed: boolean;
}

export function newCaptureLifecycle(): CaptureLifecycle {
    return { generation: 0, disposed: false };
}

/**
 * Invalidate every ticket in flight on this channel without closing it — an
 * explicit stop, where a later request is still legitimate.
 */
export function cancelCapture(state: CaptureLifecycle): void {
    state.generation += 1;
}

/**
 * Claim the channel for a new request. Strictly increasing and never reused,
 * so a superseded ticket can never match again.
 */
export function beginCapture(state: CaptureLifecycle): CaptureTicket {
    cancelCapture(state);
    return { generation: state.generation };
}

/**
 * Close the channel for good: the owner is being destroyed. Poisons tickets
 * issued afterwards too, so a cleanup that races an in-flight request wins
 * however the two interleave.
 */
export function disposeCaptures(state: CaptureLifecycle): void {
    state.disposed = true;
    cancelCapture(state);
}

/** Whether a capture that has just arrived is still wanted. */
export function isCaptureCurrent(
    state: CaptureLifecycle,
    ticket: CaptureTicket,
): boolean {
    return !state.disposed && ticket.generation === state.generation;
}

/**
 * Stop every track of a stream, returning how many stopped. A track that
 * throws (already ended, or a stub) must not strand its siblings.
 */
export function stopTracks(stream: TrackSource | null | undefined): number {
    if (!stream) return 0;
    let tracks: Stoppable[];
    try {
        tracks = stream.getTracks();
    } catch {
        return 0;
    }
    let stopped = 0;
    for (const track of tracks) {
        try {
            track.stop();
            stopped += 1;
        } catch {
            /* already ended — keep releasing the rest */
        }
    }
    return stopped;
}

/** Stop a single handle, reporting whether it actually stopped. */
export function stopHandle(handle: Stoppable | null | undefined): boolean {
    if (!handle) return false;
    try {
        handle.stop();
        return true;
    } catch {
        return false;
    }
}

/**
 * The call every post-await capture site makes: hand the capture back while
 * its ticket still holds the channel, otherwise release it and return null.
 *
 * A failing release must not be mistaken for a successful adoption, so a
 * throwing `release` still yields null.
 */
export function adoptCapture<T>(
    state: CaptureLifecycle,
    ticket: CaptureTicket,
    capture: T | null | undefined,
    release: (capture: T) => void,
): T | null {
    if (capture === null || capture === undefined) return null;
    if (isCaptureCurrent(state, ticket)) return capture;
    try {
        release(capture);
    } catch {
        /* nothing left to do but refuse the capture */
    }
    return null;
}
