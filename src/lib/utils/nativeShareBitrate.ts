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
