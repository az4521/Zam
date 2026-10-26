const PRESET_FPS = [15, 30, 60] as const;

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
): boolean {
    if (!params.encodings || params.encodings.length === 0) return false;
    for (const enc of params.encodings) {
        const scale = enc.scaleResolutionDownBy ?? 1;
        enc.maxBitrate = Math.max(
            150_000,
            Math.floor(encoding.maxBitrate / scale ** 2),
        );
        enc.maxFramerate = encoding.maxFramerate;
    }
    return true;
}
