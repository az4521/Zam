/** The publish bitrate of a shared file (see livekitCall startFileShare).
 *  A file share is sent at the file's own average bitrate, with a little
 *  headroom for the peaks, not at the screen-share cap: a 4 Mbps video
 *  played in a player must not go out at 100 Mbps. */

/** The lowest a file share is published at: enough for a readable 720p. */
export const FILE_SHARE_MIN_BPS = 1_000_000;
/** Headroom over the file's average bitrate, for its peaks. */
export const FILE_SHARE_HEADROOM = 1.2;

/** The file's average bitrate in bits per second, from its size and length,
 *  or null when either is unknown (a live or streamed source has no length). */
export function fileSourceBitrate(
    sizeBytes: number,
    durationSec: number,
): number | null {
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return null;
    if (!Number.isFinite(durationSec) || durationSec <= 0) return null;
    return (sizeBytes * 8) / durationSec;
}

/** The encoder's maxBitrate for a file share: the file's bitrate with
 *  headroom, kept between FILE_SHARE_MIN_BPS and the share's cap. With an
 *  unknown length there is nothing to match, so the cap stands. A cap below
 *  the minimum wins (the cap is the user's word). */
export function fileShareMaxBitrate(
    sizeBytes: number,
    durationSec: number,
    capBps: number,
): number {
    const source = fileSourceBitrate(sizeBytes, durationSec);
    if (source === null) return capBps;
    const wanted = Math.round(source * FILE_SHARE_HEADROOM);
    return Math.min(capBps, Math.max(FILE_SHARE_MIN_BPS, wanted));
}
