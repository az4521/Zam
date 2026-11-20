// The upload the call's publishing connection carries right now, for the
// screen-share settings and the share helpers that encode outside WebRTC.
//
// matrix/livekitCall feeds it once a second while video goes out, through
// utils/uplinkTracker: WebRTC's live estimate (availableOutgoingBitrate),
// held under what got through while the server reports loss or the round
// trip swells. It is never stored: an upload measured on another network,
// or by an earlier share, says nothing about this one. (Older builds kept
// the highest sample per device under "uploadEstimate:peak" and capped every
// share at 90% of it; that key is removed here.)

try {
    localStorage.removeItem("uploadEstimate:peak");
} catch {
    // ignore (private mode / no storage)
}

export const uploadEstimate = $state<{
    /** The latest estimate of this call, bits/sec. */
    live: number | null;
}>({ live: null });

export function noteUploadEstimate(bps: number | null): void {
    uploadEstimate.live =
        typeof bps === "number" && Number.isFinite(bps) && bps > 0
            ? Math.round(bps)
            : null;
}

/** The call ended: its estimate no longer says anything. */
export function clearLiveUploadEstimate(): void {
    uploadEstimate.live = null;
}
