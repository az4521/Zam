/** Cheap FLAC sniffing, kept apart from flacRemux so callers that only
 *  detect the format don't load the remuxer. */

/** True when `head` starts with the "fLaC" marker. Some taggers put an ID3v2
 *  tag in front of it (see id3Size). */
export function isFlac(head: Uint8Array): boolean {
    return (
        head.length >= 4 &&
        head[0] === 0x66 &&
        head[1] === 0x4c &&
        head[2] === 0x61 &&
        head[3] === 0x43
    );
}

/** Size of a leading ID3v2 tag (header and footer included), or 0. */
export function id3Size(head: Uint8Array): number {
    if (
        head.length < 10 ||
        head[0] !== 0x49 ||
        head[1] !== 0x44 ||
        head[2] !== 0x33
    )
        return 0;
    const size =
        ((head[6] & 0x7f) << 21) |
        ((head[7] & 0x7f) << 14) |
        ((head[8] & 0x7f) << 7) |
        (head[9] & 0x7f);
    const footer = head[5] & 0x10 ? 10 : 0;
    return 10 + size + footer;
}
