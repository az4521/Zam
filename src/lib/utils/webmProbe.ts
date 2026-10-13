/**
 * Just enough of EBML/Matroska to stream a WebM through MediaSource.
 *
 * Unlike MP4, a WebM needs no remuxing: its bytes can be appended to a
 * SourceBuffer exactly as they arrive. The one thing MediaSource demands up
 * front is the MIME type with a `codecs` list, which lives in the Tracks
 * header near the start of the file. This reads that header out of the first
 * bytes and says when it needs more of them.
 *
 * The elements walked here (Segment, Tracks, TrackEntry) are containers, so
 * they are entered rather than skipped and the scan stays a flat run through
 * the bytes; anything else is stepped over by its declared size.
 */

const ID_EBML = 0x1a45dfa3;
const ID_SEGMENT = 0x18538067;
const ID_TRACKS = 0x1654ae6b;
const ID_TRACK_ENTRY = 0xae;
const ID_TRACK_TYPE = 0x83;
const ID_CODEC_ID = 0x86;

const TRACK_VIDEO = 1;
const TRACK_AUDIO = 2;

/** Matroska CodecID -> the codec string MediaSource.isTypeSupported takes. */
const CODEC_STRINGS: Record<string, string> = {
    V_VP8: "vp8",
    V_VP9: "vp9",
    V_AV1: "av01.0.05M.08",
    A_OPUS: "opus",
    A_VORBIS: "vorbis",
};

export type WebmProbe =
    | { status: "need-more" }
    | { status: "unsupported" }
    | { status: "ok"; mime: string };

/** True when `head` opens with the EBML magic every WebM/Matroska starts with. */
export function isWebm(head: Uint8Array): boolean {
    return (
        head.length >= 4 &&
        head[0] === 0x1a &&
        head[1] === 0x45 &&
        head[2] === 0xdf &&
        head[3] === 0xa3
    );
}

/** An element ID, marker bits kept (that is how IDs are written down). */
function readId(
    buf: Uint8Array,
    pos: number,
): { id: number; length: number } | null {
    if (pos >= buf.length) return null;
    const first = buf[pos];
    let length = 1;
    while (length <= 4 && !(first & (0x80 >> (length - 1)))) length++;
    if (length > 4) return null;
    if (pos + length > buf.length) return null;
    let id = 0;
    for (let i = 0; i < length; i++) id = id * 256 + buf[pos + i];
    return { id, length };
}

/** An element size: `null` size means "unknown" (all value bits set). */
function readSize(
    buf: Uint8Array,
    pos: number,
): { size: number | null; length: number } | null {
    if (pos >= buf.length) return null;
    const first = buf[pos];
    let length = 1;
    while (length <= 8 && !(first & (0x80 >> (length - 1)))) length++;
    if (length > 8) return null;
    if (pos + length > buf.length) return null;
    let value = first & (0xff >> length);
    let allOnes = value === 0xff >> length;
    for (let i = 1; i < length; i++) {
        const b = buf[pos + i];
        if (b !== 0xff) allOnes = false;
        // Sizes here never need more than 2^53; anything past that is junk.
        value = value * 256 + b;
    }
    if (allOnes) return { size: null, length };
    if (!Number.isSafeInteger(value)) return null;
    return { size: value, length };
}

/**
 * Work out the MediaSource MIME type for a WebM from its leading bytes.
 * `need-more` means the Tracks header is not fully in `buf` yet.
 */
export function probeWebm(buf: Uint8Array): WebmProbe {
    let pos = 0;
    let tracksEnd: number | null = null;
    const tracks: { type: number | null; codec: string | null }[] = [];

    for (;;) {
        if (tracksEnd !== null && pos >= tracksEnd) break;
        const id = readId(buf, pos);
        if (!id) return needMoreOrJunk(buf, pos);
        const size = readSize(buf, pos + id.length);
        if (!size) return needMoreOrJunk(buf, pos + id.length);
        const body = pos + id.length + size.length;

        if (id.id === ID_SEGMENT || id.id === ID_TRACK_ENTRY) {
            // Containers: step inside. (An unknown-size Segment is normal for
            // a live recording.)
            if (id.id === ID_TRACK_ENTRY)
                tracks.push({ type: null, codec: null });
            pos = body;
            continue;
        }
        if (id.id === ID_TRACKS) {
            if (size.size === null) return { status: "unsupported" };
            tracksEnd = body + size.size;
            pos = body;
            continue;
        }
        if (size.size === null) return { status: "unsupported" };
        const end = body + size.size;

        if (id.id === ID_CODEC_ID || id.id === ID_TRACK_TYPE) {
            const entry = tracks[tracks.length - 1];
            if (!entry) return { status: "unsupported" };
            if (end > buf.length) return { status: "need-more" };
            if (id.id === ID_TRACK_TYPE) {
                let v = 0;
                for (let i = body; i < end; i++) v = v * 256 + buf[i];
                entry.type = v;
            } else {
                entry.codec = new TextDecoder("latin1")
                    .decode(buf.subarray(body, end))
                    .replace(/\0+$/, "");
            }
        } else if (
            tracksEnd === null &&
            id.id !== ID_EBML &&
            end > buf.length
        ) {
            // A big element ahead of the Tracks (a SeekHead or Void is small;
            // a Cues or Cluster before Tracks means a layout we won't guess).
            return size.size > MAX_SKIPPED
                ? { status: "unsupported" }
                : { status: "need-more" };
        }
        pos = end;
        // Tracks that reaches past the buffer ends the loop above by need-more
        // the next time round, via readId.
    }

    const video: string[] = [];
    const audio: string[] = [];
    for (const t of tracks) {
        const codec = t.codec ? CODEC_STRINGS[t.codec] : undefined;
        if (!codec) return { status: "unsupported" };
        if (t.type === TRACK_VIDEO) video.push(codec);
        else if (t.type === TRACK_AUDIO) audio.push(codec);
        else return { status: "unsupported" };
    }
    const codecs = [...video, ...audio];
    if (codecs.length === 0) return { status: "unsupported" };
    // Audio-only files (voice recordings, music) get the audio/ prefix.
    const prefix = video.length > 0 ? "video" : "audio";
    return {
        status: "ok",
        mime: `${prefix}/webm; codecs="${codecs.join(",")}"`,
    };
}

// Elements before Tracks are tiny in any real file; refuse to wait on a huge one.
const MAX_SKIPPED = 1024 * 1024;

/** Ran out of bytes mid-header (need more) or hit bytes that aren't EBML. */
function needMoreOrJunk(buf: Uint8Array, pos: number): WebmProbe {
    // A header cut off by the end of the buffer reads as null the same way
    // junk does; telling them apart needs a few bytes of slack.
    return buf.length - pos < 16
        ? { status: "need-more" }
        : { status: "unsupported" };
}
