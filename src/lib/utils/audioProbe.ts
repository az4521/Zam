// Container sniffing for the audio formats that are remuxed on the fly
// (oggRemux.ts, wavRemux.ts). Kept apart from them so deciding which route a
// download takes does not load the remuxers.

/** True when `head` opens with the "OggS" capture pattern. */
export function isOgg(head: Uint8Array): boolean {
    return (
        head.length >= 4 &&
        head[0] === 0x4f &&
        head[1] === 0x67 &&
        head[2] === 0x67 &&
        head[3] === 0x53
    );
}

/** True for "RIFF" .... "WAVE". */
export function isWav(head: Uint8Array): boolean {
    return (
        head.length >= 12 &&
        String.fromCharCode(head[0], head[1], head[2], head[3]) === "RIFF" &&
        String.fromCharCode(head[8], head[9], head[10], head[11]) === "WAVE"
    );
}
