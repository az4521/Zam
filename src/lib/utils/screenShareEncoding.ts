/** Screen-share PUBLISH encoding table (bits/sec), keyed by the stored
 *  resolution key and the picked frame rate. LiveKit otherwise down-encodes
 *  screen shares to a conservative ~3 Mbps preset regardless of capture
 *  resolution; these values (Discord-ballpark) are handed to
 *  `screenShareEncoding` so the quality pick actually reaches the wire.
 *
 *  Columns are the three preset frame rates (15/30/60). A non-preset fps is
 *  normalized to the 30 column, matching `screenShareCaptureResolution`, so
 *  bitrate and framerate stay consistent. An unknown resolution key falls
 *  back to the 1080p row (LiveKit's own default tier). */
const SCREEN_SHARE_BITRATE: Record<string, Record<number, number>> = {
    "720": { 15: 1_500_000, 30: 2_500_000, 60: 4_000_000 },
    "1080": { 15: 2_500_000, 30: 4_000_000, 60: 8_000_000 },
    "1440": { 15: 4_000_000, 30: 6_000_000, 60: 10_000_000 },
    "2160": { 15: 8_000_000, 30: 10_000_000, 60: 16_000_000 },
};

const PRESET_FPS = [15, 30, 60] as const;

export function screenShareEncodingFor(
    resKey: string,
    fps: number,
): { maxBitrate: number; maxFramerate: number } {
    const row = SCREEN_SHARE_BITRATE[resKey] ?? SCREEN_SHARE_BITRATE["1080"];
    const frameRate = (PRESET_FPS as readonly number[]).includes(fps)
        ? fps
        : 30;
    return { maxBitrate: row[frameRate], maxFramerate: frameRate };
}
