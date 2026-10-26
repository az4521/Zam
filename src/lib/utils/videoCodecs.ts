/** Video codecs a call can send, and which of them everyone can watch.
 *
 *  In a LiveKit call the sender picks one codec and the server forwards it
 *  as is, so whoever can't decode it would see nothing. Neither LiveKit nor
 *  MatrixRTC passes on what other participants decode, so Zam clients put it
 *  in a LiveKit participant attribute (DECODE_ATTRIBUTE); the call view only
 *  offers codecs every one of them decodes.
 *  Clients that say nothing (Element Call, older Zam) are covered by
 *  LiveKit's backup codec: with anything but VP8 or H.264, the server asks
 *  for an extra H.264 (or VP8) stream as soon as one of them can't decode
 *  the main one. */

export type VideoCodec = "av1" | "h265" | "vp9" | "h264" | "vp8";

/** Best first, which is also the order the picker lists them in. */
export const VIDEO_CODECS: readonly VideoCodec[] = [
    "av1",
    "h265",
    "vp9",
    "h264",
    "vp8",
];

/** WebRTC's mandatory codecs: every WebRTC client decodes both. */
export const MANDATORY_CODECS: readonly VideoCodec[] = ["h264", "vp8"];

export const DEFAULT_VIDEO_CODEC: VideoCodec = "h264";

export const VIDEO_CODEC_LABELS: Record<VideoCodec, string> = {
    av1: "AV1",
    h265: "HEVC",
    vp9: "VP9",
    h264: "H.264",
    vp8: "VP8",
};

export function isVideoCodec(value: unknown): value is VideoCodec {
    return (
        typeof value === "string" &&
        (VIDEO_CODECS as readonly string[]).includes(value)
    );
}

export function isMandatoryCodec(codec: VideoCodec): boolean {
    return MANDATORY_CODECS.includes(codec);
}

/** "video/H265" and friends to our names; everything else (RTX, RED,
 *  ULPFEC, unknown codecs) is dropped. Deduplicated, in VIDEO_CODECS order. */
export function codecsFromMimeTypes(
    mimeTypes: readonly string[],
): VideoCodec[] {
    const seen = new Set<VideoCodec>();
    for (const mime of mimeTypes) {
        const name = mime.toLowerCase().replace(/^video\//, "");
        const codec = name === "hevc" ? "h265" : name;
        if (isVideoCodec(codec)) seen.add(codec);
    }
    return VIDEO_CODECS.filter((c) => seen.has(c));
}

/** The codecs worth offering: ones this device can send that every
 *  participant who told us what they decode can decode. The mandatory
 *  codecs are always in, since every WebRTC client decodes them. */
export function codecsEveryoneDecodes(
    sendable: readonly VideoCodec[],
    peerDecode: Iterable<readonly VideoCodec[]>,
): VideoCodec[] {
    const peers = [...peerDecode];
    return sendable.filter(
        (codec) =>
            isMandatoryCodec(codec) ||
            peers.every((decodes) => decodes.includes(codec)),
    );
}

/** The stream LiveKit falls back to for viewers who can't decode `codec`:
 *  none for a mandatory codec, else H.264, or VP8 if this device can't send
 *  H.264. */
export function backupCodecFor(
    codec: VideoCodec,
    sendable: readonly VideoCodec[],
): "h264" | "vp8" | null {
    if (isMandatoryCodec(codec)) return null;
    return sendable.includes("h264") || !sendable.includes("vp8")
        ? "h264"
        : "vp8";
}

/** What to actually send: the pick if this device can send it, else
 *  H.264, else VP8. */
export function effectiveCodec(
    picked: VideoCodec,
    sendable: readonly VideoCodec[],
): VideoCodec {
    if (sendable.includes(picked)) return picked;
    if (sendable.includes("h264")) return "h264";
    if (sendable.includes("vp8")) return "vp8";
    return sendable[0] ?? DEFAULT_VIDEO_CODEC;
}

/** The participant attribute holding what a Zam client decodes, as codec
 *  names separated by commas ("h265,h264,vp8"). */
export const DECODE_ATTRIBUTE = "zam.decode";

export function encodeDecodeAttribute(decode: readonly VideoCodec[]): string {
    return decode.join(",");
}

/** A participant's decode list, or null when they didn't set one (not Zam,
 *  or an older Zam). Unknown names are dropped. */
export function parseDecodeAttribute(
    value: string | undefined,
): VideoCodec[] | null {
    if (value === undefined) return null;
    return value
        .split(",")
        .map((name) => name.trim())
        .filter(isVideoCodec);
}
