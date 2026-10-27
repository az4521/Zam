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

export interface CodecPlan {
    /** What we can send that everyone can watch. */
    available: VideoCodec[];
    /** What to send. */
    current: VideoCodec;
    /** The stream for viewers who can't decode `current`, if any. */
    backup: "h264" | "vp8" | null;
}

/** What to send in a call. `peers` holds each participant's decode list,
 *  null for those who didn't say (not Zam).
 *
 *  Unencrypted, a participant who didn't say doesn't narrow the choice:
 *  LiveKit's backup stream covers them. LiveKit can't send that backup on an
 *  end-to-end encrypted track, so in an encrypted call they count as
 *  decoding only the mandatory codecs, and a pick someone can't watch falls
 *  back to H.264 (or VP8) until they leave. */
export function planCodecs(
    picked: VideoCodec,
    sendable: readonly VideoCodec[],
    peers: readonly (readonly VideoCodec[] | null)[],
    encrypted: boolean,
): CodecPlan {
    const known = peers.flatMap((p) =>
        p ? [p] : encrypted ? [MANDATORY_CODECS] : [],
    );
    const available = codecsEveryoneDecodes(sendable, known);
    const current = effectiveCodec(picked, encrypted ? available : sendable);
    return {
        available,
        current,
        backup: encrypted ? null : backupCodecFor(current, sendable),
    };
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

/** Codecs the browser lists but this device can't actually show (a missing
 *  or broken decoder), taken out of what it announces and negotiates. The
 *  mandatory codecs always stay: they are the way back to a picture. */
export function withoutBlocked(
    decode: readonly VideoCodec[],
    blocked: readonly VideoCodec[],
): VideoCodec[] {
    return decode.filter((c) => isMandatoryCodec(c) || !blocked.includes(c));
}

/** The codec behind an RTP codec mime type ("video/H265"), or null. */
export function codecFromMime(mimeType: string): VideoCodec | null {
    return codecsFromMimeTypes([mimeType])[0] ?? null;
}

/** Whether `mimeType` is a codec we have taken out (RTX and the like are
 *  never blocked, so a kept codec's retransmissions keep working). */
export function isBlockedMime(
    mimeType: string,
    blocked: readonly VideoCodec[],
): boolean {
    const codec = codecFromMime(mimeType);
    return (
        codec !== null && !isMandatoryCodec(codec) && blocked.includes(codec)
    );
}

/** Enough bytes of a video stream to expect a first picture from. */
const STALL_MIN_BYTES = 60_000;

/** A received video stream that keeps delivering data but never produces a
 *  decoded frame: the decoder behind its codec doesn't work here. */
export function isDecodeStall(s: {
    bytes: number;
    framesDecoded: number;
    samples: number;
}): boolean {
    return (
        s.samples >= 2 && s.bytes >= STALL_MIN_BYTES && s.framesDecoded === 0
    );
}
