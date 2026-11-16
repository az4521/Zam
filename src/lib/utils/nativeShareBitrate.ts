/**
 * The bitrate the native share's helper encodes at. The helper encodes on its
 * own, so the renderer tells it the sending rate: the user's picked bitrate,
 * held under most of what the uplink reports it can carry (the encoder would
 * otherwise queue frames and the share would lag).
 */

/** Share of the reported uplink the helper may use. */
const UPLINK_SHARE = 0.85;
/** A change smaller than this (as a share of the last value) is not sent. */
const RESEND_RATIO = 0.1;

/** The bitrate to hand the helper: the picked one, or less when the uplink
 *  reports less. An unknown uplink (null, or not a positive number) keeps the
 *  picked bitrate. */
export function nativeBitrateTarget(
    picked: number,
    availableBps: number | null | undefined,
): number {
    if (typeof availableBps !== "number" || !(availableBps > 0)) return picked;
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
