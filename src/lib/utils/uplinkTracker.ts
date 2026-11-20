/**
 * What the uplink carries right now, followed second by second while video
 * is sent (stores/uploadEstimate, and the helpers that encode a share outside
 * WebRTC: the Windows and Android native shares).
 *
 * It replaces a measurement that kept the highest estimate ever seen on the
 * device and capped shares at 90% of it. That number was stale the moment
 * the network changed, and it could not rise past what the share itself
 * pushed: WebRTC's estimate (availableOutgoingBitrate) only climbs to about
 * 1.5x what the sender actually sends, so a share capped under it kept it
 * there.
 *
 * Here the estimate is followed live: the median of the last few seconds of
 * availableOutgoingBitrate (one odd reading doesn't swing it), held under
 * what actually got through while the server reports loss on our video or
 * the round trip swells over its recent floor (a filling queue), which shows
 * the link is full before WebRTC's estimate has caught up.
 */

/** The highest upload the tracker reports (bits/sec). WebRTC has reported
 *  multi-Gbps estimates on a fast or local path; no share needs more. */
export const MAX_UPLINK_BPS = 100_000_000;
/** How far back the median looks. */
export const UPLINK_WINDOW_MS = 5_000;
/** Loss on our outgoing video (from the server's receiver reports) that
 *  means the link is full. */
export const UPLINK_LOSS_CONGESTED = 0.05;
/** Round trip above its recent floor that means a queue is building. */
export const UPLINK_QUEUE_MS = 150;
/** How far back the round-trip floor looks. */
export const UPLINK_RTT_FLOOR_MS = 30_000;
/** After congestion, how long the estimate stays under what got through. */
export const UPLINK_CONGESTION_HOLD_MS = 4_000;
/** Share of what got through that the estimate is held under. */
export const UPLINK_CONGESTED_SHARE = 0.9;

export interface UplinkSample {
    /** WebRTC's estimate (availableOutgoingBitrate), bits/sec, or null. */
    available: number | null;
    /** What the connection sent over the sample, bits/sec, or null. */
    sent: number | null;
    /** Worst fractionLost the server reports on our video (0..1), or null. */
    loss: number | null;
    /** Media round trip (ms), or null. */
    rttMs: number | null;
}

const positive = (n: number | null | undefined): n is number =>
    typeof n === "number" && Number.isFinite(n) && n > 0;

export class UplinkTracker {
    private available: { bps: number; at: number }[] = [];
    private rtts: { ms: number; at: number }[] = [];
    private congested: { bps: number; at: number } | null = null;
    private last: number | null = null;

    /** Feed one sample; returns the estimate after it (or null before any
     *  usable sample). */
    sample(s: UplinkSample, now: number): number | null {
        if (positive(s.available))
            this.available.push({
                bps: Math.min(s.available, MAX_UPLINK_BPS),
                at: now,
            });
        this.available = this.available.filter(
            (a) => now - a.at <= UPLINK_WINDOW_MS,
        );
        let queued = false;
        if (positive(s.rttMs)) {
            this.rtts = this.rtts.filter(
                (r) => now - r.at <= UPLINK_RTT_FLOOR_MS,
            );
            const floor = this.rtts.reduce(
                (m, r) => Math.min(m, r.ms),
                Infinity,
            );
            queued = floor !== Infinity && s.rttMs - floor >= UPLINK_QUEUE_MS;
            this.rtts.push({ ms: s.rttMs, at: now });
        }
        const lossy = (s.loss ?? 0) >= UPLINK_LOSS_CONGESTED;
        if ((lossy || queued) && positive(s.sent)) {
            const bps = Math.round(s.sent * UPLINK_CONGESTED_SHARE);
            // Within one episode the lowest reading stands.
            this.congested =
                this.congested &&
                now - this.congested.at <= UPLINK_CONGESTION_HOLD_MS
                    ? { bps: Math.min(this.congested.bps, bps), at: now }
                    : { bps, at: now };
        }
        this.last = this.estimate(now);
        return this.last;
    }

    /** The latest estimate, or null. */
    current(): number | null {
        return this.last;
    }

    /** What got through while the link was last full, while that still
     *  holds (UPLINK_CONGESTION_HOLD_MS), else null. */
    congestionHold(now: number): number | null {
        return this.congested &&
            now - this.congested.at <= UPLINK_CONGESTION_HOLD_MS
            ? this.congested.bps
            : null;
    }

    /** Forget everything (the call ended, or the connection changed). */
    reset(): void {
        this.available = [];
        this.rtts = [];
        this.congested = null;
        this.last = null;
    }

    private estimate(now: number): number | null {
        const sorted = this.available.map((a) => a.bps).sort((a, b) => a - b);
        const median =
            sorted.length === 0
                ? null
                : sorted.length % 2
                  ? sorted[(sorted.length - 1) / 2]
                  : Math.round(
                        (sorted[sorted.length / 2 - 1] +
                            sorted[sorted.length / 2]) /
                            2,
                    );
        const held = this.congestionHold(now);
        if (median === null) return held;
        return held === null ? median : Math.min(median, held);
    }
}
