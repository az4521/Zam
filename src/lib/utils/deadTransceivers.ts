// LiveKit publishes every track on a new transceiver and only calls
// removeTrack when it unpublishes, so each share, camera toggle and codec
// republish leaves a transceiver behind for the rest of the call, holding its
// encoder's memory (measured: ~17 MB per 960x540 share, growing without
// bound; flat once the dead transceivers are stopped). Encrypted calls
// republish video whenever someone joins or leaves and the codec changes.

/** The parts of an RTCRtpTransceiver the choice reads. */
export interface TransceiverLike {
    readonly mid: string | null;
    readonly direction: RTCRtpTransceiverDirection;
    readonly currentDirection: RTCRtpTransceiverDirection | null;
    readonly sender: { readonly track: MediaStreamTrack | null };
}

const IDLE: ReadonlySet<RTCRtpTransceiverDirection | null> = new Set([
    "inactive",
    "recvonly",
]);

/**
 * Transceivers that are safe to stop: nothing to send (no track), no longer
 * asked to send, and already negotiated as not sending, so the unpublish
 * that emptied them has finished. A transceiver mid-negotiation, or one a
 * publish is about to use, is never picked.
 */
export function deadTransceivers<T extends TransceiverLike>(
    transceivers: readonly T[],
): T[] {
    return transceivers.filter(
        (t) =>
            t.mid !== null &&
            t.sender.track === null &&
            IDLE.has(t.direction) &&
            IDLE.has(t.currentDirection),
    );
}
