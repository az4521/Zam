/**
 * The bitrate the native share's helper encodes at. The helper encodes on its
 * own, so the renderer tells it the sending rate: the user's picked bitrate,
 * held under most of what the uplink reports it can carry (the encoder would
 * otherwise queue frames and the share would lag).
 */

/** Share of the reported uplink the helper may use. */
const UPLINK_SHARE = 0.85;
/** What the helper starts at while the uplink is unknown. The helper encodes
 *  outside WebRTC's rate control, so starting at the pick (often several
 *  Mbps) while WebRTC's estimate was still ramping up from a few hundred kbps
 *  backed up its pacer: WebRTC then throttled the placeholder encoder, the
 *  helper's AUs piled up behind the placeholders and were skipped (measured:
 *  ~230 AUs and 4 s of stutter at the start of a share on a jittery link). */
export const NATIVE_START_BITRATE = 1_500_000;
/** A change smaller than this (as a share of the last value) is not sent. */
const RESEND_RATIO = 0.1;

/** The bitrate to hand the helper: the picked one, or less when the uplink
 *  reports less. An unknown uplink (null, or not a positive number) gives
 *  NATIVE_START_BITRATE (or the pick, if lower), and the share then follows
 *  WebRTC's estimate up as it ramps. */
export function nativeBitrateTarget(
    picked: number,
    availableBps: number | null | undefined,
): number {
    if (typeof availableBps !== "number" || !(availableBps > 0))
        return Math.min(picked, NATIVE_START_BITRATE);
    return Math.round(Math.min(picked, availableBps * UPLINK_SHARE));
}

/** Whether a new target differs enough from the last one sent to be worth a
 *  message to the helper. */
export function nativeBitrateChanged(
    last: number | null,
    next: number,
): boolean {
    if (last === null) return true;
    return Math.abs(next - last) > last * RESEND_RATIO;
}

/** The floor of the native share sender's maxBitrate. The sender's cap sets
 *  the encoder's budget per placeholder frame, and the placeholders carry no
 *  picture: at 1 Mbps the encoder delivered 16-66 placeholders a second against
 *  58 AUs a second (the substitution then skipped AUs), at 8 Mbps it delivered
 *  the full 120 a second from the first second (loopback, live helper). The RTP
 *  stream is the helper's AUs, so a higher cap sends no more data. */
export const NATIVE_SENDER_BITRATE_FLOOR = 8_000_000;

/** The sender's maxBitrate for a native share: the picked bitrate, or the
 *  floor when that is lower. */
export function nativeSenderBitrate(picked: number): number {
    return Math.max(picked, NATIVE_SENDER_BITRATE_FLOOR);
}

/** WebRTC's estimate falling under this share of its recent high is a
 *  collapse (its ordinary backoffs are ~15% steps). */
export const UPLINK_COLLAPSE_RATIO = 0.6;
/** How far back the recent high looks. */
export const UPLINK_PEAK_WINDOW_MS = 5_000;
/** After a collapse the helper stays under this share of the high it fell
 *  from. */
export const UPLINK_CEILING_RATIO = 0.8;
/** Each this long without a collapse, the ceiling rises by
 *  UPLINK_CEILING_STEP (and goes once it passes the pick). */
export const UPLINK_CEILING_CALM_MS = 60_000;
export const UPLINK_CEILING_STEP = 1.1;

/**
 * Where the uplink broke, so the helper doesn't break it again.
 *
 * The helper encodes at a constant bitrate outside WebRTC's rate control and
 * follows WebRTC's estimate (nativeBitrateTarget) half a second behind. So it
 * fills every bit the estimate offers; the estimate climbs until the real
 * link overflows, falls, and the helper keeps sending the old rate long
 * enough to swell the send queue, which drives the estimate down to the
 * floor. Then the climb starts over: a share sawtoothing between ~1 Mbps and
 * the link's capacity. After the first collapse this holds the helper under
 * 80% of where it happened, rising slowly while the link stays calm.
 */
export class UplinkCeiling {
    private recent: { bps: number; at: number }[] = [];
    private ceiling: number | null = null;
    private calmSince = 0;

    /** Feed WebRTC's estimate; returns what the helper may treat as the
     *  uplink (the estimate, held under the ceiling). */
    limit(available: number | null, now: number): number | null {
        if (typeof available !== "number" || !(available > 0)) return available;
        this.recent = this.recent.filter(
            (s) => now - s.at <= UPLINK_PEAK_WINDOW_MS,
        );
        const peak = this.recent.reduce((m, s) => Math.max(m, s.bps), 0);
        if (peak > 0 && available < peak * UPLINK_COLLAPSE_RATIO) {
            const at = peak * UPLINK_CEILING_RATIO;
            this.ceiling =
                this.ceiling === null ? at : Math.min(this.ceiling, at);
            this.calmSince = now;
            this.recent = [];
        } else if (
            this.ceiling !== null &&
            now - this.calmSince >= UPLINK_CEILING_CALM_MS
        ) {
            this.ceiling *= UPLINK_CEILING_STEP;
            this.calmSince = now;
        }
        this.recent.push({ bps: available, at: now });
        return this.ceiling === null
            ? available
            : Math.min(available, this.ceiling);
    }

    /** The current ceiling, or null before any collapse. */
    current(): number | null {
        return this.ceiling;
    }
}
