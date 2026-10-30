/** LiveKit's server answers a video offer with H.264 profile-level-id
 *  42e01f (Constrained Baseline). The sender uses the answer's format, and
 *  Chromium's GPU encoders (Media Foundation, VA-API) are only offered 42001f
 *  (Baseline) and 4d001f (Main): asked for 42e01f the encoder factory finds
 *  no hardware match and uses OpenH264 in software. Same bitstream either way
 *  (the two differ in one constraint flag), so declare 42001f in the answer
 *  before it is applied and the stream is encoded on the GPU. */
const CONSTRAINED_BASELINE = "profile-level-id=42e01f";
const BASELINE = "profile-level-id=42001f";

/** `sdp` with the H.264 profile in its video sections changed from 42e01f
 *  to 42001f. Audio and the other video codecs are left as they are. */
export function baselineH264Answer(sdp: string): string {
    if (!sdp.includes(CONSTRAINED_BASELINE)) return sdp;
    let inVideo = false;
    return sdp
        .split("\r\n")
        .map((line) => {
            if (line.startsWith("m=")) inVideo = line.startsWith("m=video");
            if (!inVideo || !line.startsWith("a=fmtp:")) return line;
            return line.replace(CONSTRAINED_BASELINE, BASELINE);
        })
        .join("\r\n");
}
