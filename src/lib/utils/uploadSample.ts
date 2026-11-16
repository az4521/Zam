/**
 * One upload-speed sample for the screen-share slider (stores/uploadEstimate).
 *
 * WebRTC's availableOutgoingBitrate is the link's estimate. The bytes sent
 * also show capacity, but only when the link bounded them. A share sent at
 * its own cap (the picked bitrate) sends that cap whatever the line carries,
 * so its rate there is not evidence of speed. Counting it pushed the slider's
 * ceiling up to the cap, which the user then picks, which sends more: the
 * peak only ever rose. Those samples fall back to WebRTC's estimate.
 */

/** The highest upload a sample may record (bits/sec). The helper tops out
 *  at 100 Mbps and no screen share needs more; WebRTC has reported multi-Gbps
 *  estimates on a fast or local path, and a kept peak that high put the
 *  slider ceiling out of reach. */
export const MAX_UPLOAD_SAMPLE_BPS = 100_000_000;

/** Sent bytes at or above this share of the sender's cap count as cap-bound. */
export const CAP_BOUND_SHARE = 0.8;

/** The upload (bits/sec) one sample proves, or 0 when it proves nothing.
 *  `available`: WebRTC's estimate, or null. `sent`: bits/sec sent over the
 *  sample, or null. `capBps`: the picked share bitrate while a share is sent,
 *  or null. */
export function uploadSampleBps(
    available: number | null,
    sent: number | null,
    capBps: number | null,
): number {
    const est = available !== null && available > 0 ? available : 0;
    const out = sent !== null && sent > 0 ? sent : 0;
    const capBound =
        capBps !== null && capBps > 0 && out >= CAP_BOUND_SHARE * capBps;
    const bps = capBound ? est : Math.max(est, out);
    return Math.min(bps, MAX_UPLOAD_SAMPLE_BPS);
}
