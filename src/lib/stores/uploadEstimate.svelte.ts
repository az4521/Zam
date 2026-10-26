// Measured upload bandwidth, for the screen-share bitrate slider.
//
// The number is WebRTC's own estimate on the call's publishing connection
// (availableOutgoingBitrate), sampled by matrix/livekitCall while video goes
// out. With only a microphone sending it barely probes and reads far too low,
// so audio-only samples aren't taken. The highest sample is kept per device:
// the slider can then offer a sensible range before the next share starts,
// and since the picked bitrate is only a cap, a stale high value never makes
// WebRTC send more than it currently estimates.

import { bitrateCeiling } from "$lib/utils/screenShareBitrate";

const PEAK_KEY = "uploadEstimate:peak";

function readPeak(): number | null {
    try {
        const n = Number(localStorage.getItem(PEAK_KEY));
        return Number.isFinite(n) && n > 0 ? n : null;
    } catch {
        return null;
    }
}

export const uploadEstimate = $state<{
    /** The latest sample of this call, bits/sec. */
    live: number | null;
    /** The highest sample on this device, bits/sec. */
    peak: number | null;
}>({ live: null, peak: readPeak() });

export function noteUploadEstimate(bps: number): void {
    if (!Number.isFinite(bps) || bps <= 0) return;
    uploadEstimate.live = bps;
    if (uploadEstimate.peak !== null && bps <= uploadEstimate.peak) return;
    uploadEstimate.peak = bps;
    try {
        localStorage.setItem(PEAK_KEY, String(Math.round(bps)));
    } catch {
        // ignore (private mode / storage full)
    }
}

/** The call ended: its live sample no longer says anything. */
export function clearLiveUploadEstimate(): void {
    uploadEstimate.live = null;
}

/** The upload the slider is measured against, or null before any sample. */
export function measuredUpload(): number | null {
    const { live, peak } = uploadEstimate;
    if (live === null) return peak;
    return peak === null ? live : Math.max(live, peak);
}

/** The most the bitrate slider offers right now. */
export function screenShareBitrateCeiling(): number {
    return bitrateCeiling(measuredUpload());
}
