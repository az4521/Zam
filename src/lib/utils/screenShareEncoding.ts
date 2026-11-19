const PRESET_FPS = [15, 30, 60] as const;

/** The most a share's lower simulcast layer sends. It is the layer a viewer
 *  whose link can't carry the share falls back to, so it has to fit a slow
 *  link: LiveKit's quarter-of-the-top rule gave an 8 Mbps share a 2 Mbps low
 *  layer, which froze a viewer capped at 2 Mbps just like the top one did. */
export const SHARE_LOW_LAYER_MAX_BPS = 1_200_000;
/** ...and its most frames a second: at 60 fps that bitrate leaves half the
 *  bits per frame, and on the congested link the layer exists for, it fell
 *  to 7-13 fps (measured), where Element Call's 30 fps low layer held 30. */
export const SHARE_LOW_LAYER_MAX_FPS = 30;

/** Screen-share PUBLISH encoding: the bitrate the user picked
 *  (utils/screenShareBitrate, already clamped to the measured upload) and the
 *  picked frame rate. Handed to LiveKit as `screenShareEncoding`, which would
 *  otherwise down-encode screen shares to a conservative ~3 Mbps preset. A
 *  non-preset fps is normalized to 30, matching
 *  `screenShareCaptureResolution`, so bitrate and framerate stay consistent. */
export function screenShareEncodingFor(
    bitrate: number,
    fps: number,
): { maxBitrate: number; maxFramerate: number } {
    const frameRate = (PRESET_FPS as readonly number[]).includes(fps)
        ? fps
        : 30;
    return { maxBitrate: Math.round(bitrate), maxFramerate: frameRate };
}

/** Cap a running screen-share sender's encodings to the picked quality.
 *  Mutates `params.encodings` in place (RTCRtpSender.setParameters requires
 *  the object returned by getParameters, minimally mutated). Scales maxBitrate
 *  per layer by 1/scaleResolutionDownBy^2 (matching LiveKit's design), with a
 *  150k floor, so a simulcast top layer can't exceed the pick and lower layers
 *  stay proportional. maxFramerate is applied to all layers. Returns whether
 *  any encoding was touched — an empty/absent array means the track isn't
 *  publishing yet, so the caller skips setParameters. */
export function applyScreenShareEncoding(
    params: RTCRtpSendParameters,
    encoding: { maxBitrate: number; maxFramerate: number },
    /** A cap for the lower layers only (a viewer on the low layer can't take
     *  more), leaving the top layer at `encoding.maxBitrate`. */
    lowLayerCap: number | null = null,
): boolean {
    if (!params.encodings || params.encodings.length === 0) return false;
    for (const enc of params.encodings) {
        const scale = enc.scaleResolutionDownBy ?? 1;
        const proportional = Math.floor(encoding.maxBitrate / scale ** 2);
        enc.maxBitrate = Math.max(
            150_000,
            scale > 1
                ? Math.min(
                      proportional,
                      SHARE_LOW_LAYER_MAX_BPS,
                      lowLayerCap ?? Infinity,
                  )
                : proportional,
        );
        enc.maxFramerate =
            scale > 1
                ? Math.min(encoding.maxFramerate, SHARE_LOW_LAYER_MAX_FPS)
                : encoding.maxFramerate;
    }
    return true;
}
