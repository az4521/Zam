// Redundancy for encrypted calls. LiveKit refuses RED under E2EE (the SFU
// would have to read the RED headers), so the previous Opus frames travel
// inside the current packet's padding instead. That is done before
// encryption: the SFU and any client that doesn't know about it just see an
// Opus packet with padding, which every decoder skips, so it only costs
// bandwidth. A Zam receiver reads the copies back after decryption and
// refills the frames that never arrived.
//
// RFC 6716 section 3.2.5 tells encoders to zero the padding bytes so they
// cannot carry a covert channel, but tells decoders to accept any value.
// These bytes are non-zero on purpose, and they are encrypted with the rest
// of the packet before they leave the machine, so an observer cannot read
// them and a conformant decoder skips them.
//
// Opus packet layout (RFC 6716 section 3): TOC byte (config 5 bits, stereo
// 1 bit, frame count code 2 bits). Code 0 is one frame filling the rest of
// the packet. Code 3 has a count byte (v, p, M:6), then the padding length
// when p is set (bytes of 255 each add 254 and continue), then M frames,
// then the padding. We turn a code-0 packet into a code-3 one with M = 1.

const MAGIC_A = 0x5a;
const MAGIC_B = 0x52;
/** Copies of earlier frames a packet may carry. */
export const MAX_DEPTH = 3;
/** DTX and comfort-noise packets are this small or smaller: not worth it. */
const MIN_PACKET = 3;

/** Samples at 48 kHz in one frame of a packet, from its TOC byte: configs
 *  0-11 are SILK (10, 20, 40, 60 ms), 12-15 hybrid (10, 20 ms), 16-31 CELT
 *  (2.5, 5, 10, 20 ms), each in groups. */
function frameSamples(config: number): number {
    if (config < 12) return [480, 960, 1920, 2880][config & 3];
    if (config < 16) return [480, 960][config & 1];
    return [120, 240, 480, 960][config & 3];
}

/** Samples at 48 kHz covered by the whole packet, from its TOC and framing.
 *  Code 0 is one frame; codes 1 and 2 are two; code 3 carries the count in
 *  the low six bits of its second byte (RFC 6716 section 3.2). A packet is
 *  never longer than 120 ms, so a count that would exceed that is malformed
 *  and reports 0 rather than throwing the receiver's timestamp tracking off. */
export function packetSamples(packet: Uint8Array): number {
    if (packet.length === 0) return 0;
    const frame = frameSamples(packet[0] >> 3);
    const code = packet[0] & 3;
    let count = 1;
    if (code === 1 || code === 2) {
        count = 2;
    } else if (code === 3) {
        if (packet.length < 2) return 0;
        count = packet[1] & 0x3f;
    }
    if (count === 0 || frame * count > 5760) return 0;
    return frame * count;
}

/** Whether this is a packet we can add copies to: one frame, no padding. */
function isPlainSingleFrame(packet: Uint8Array): boolean {
    return packet.length >= MIN_PACKET && (packet[0] & 3) === 0;
}

/** The padding length bytes for `n` padding bytes. */
function paddingLengthBytes(n: number): number[] {
    const out: number[] = [];
    let left = n;
    while (left >= 255) {
        out.push(255);
        left -= 254;
    }
    out.push(left);
    return out;
}

/**
 * `packet` (a code-0 Opus packet) with `copies` of earlier packets, newest
 * first, in its padding. Returns the packet unchanged when it can't carry
 * any, and skips copies that don't fit the one-byte length field.
 */
export function withRedundancy(
    packet: Uint8Array,
    copies: readonly Uint8Array[],
): Uint8Array {
    if (!isPlainSingleFrame(packet)) return packet;
    const usable: Uint8Array[] = [];
    for (const c of copies.slice(0, MAX_DEPTH)) {
        if (!isPlainSingleFrame(c) || c.length > 255) break;
        usable.push(c);
    }
    if (usable.length === 0) return packet;
    let padLen = 3;
    for (const c of usable) padLen += 1 + c.length;
    const lenBytes = paddingLengthBytes(padLen);
    const frame = packet.subarray(1);
    const out = new Uint8Array(2 + lenBytes.length + frame.length + padLen);
    let i = 0;
    out[i++] = (packet[0] & 0xfc) | 3;
    out[i++] = 0x41; // CBR, padding present, one frame
    for (const b of lenBytes) out[i++] = b;
    out.set(frame, i);
    i += frame.length;
    out[i++] = MAGIC_A;
    out[i++] = MAGIC_B;
    out[i++] = usable.length;
    for (const c of usable) {
        out[i++] = c.length;
        out.set(c, i);
        i += c.length;
    }
    return out;
}

export interface Extracted {
    /** The packet as the encoder made it (code 0, no padding). */
    primary: Uint8Array;
    /** Copies of earlier packets, newest first. */
    copies: Uint8Array[];
}

/** Take the copies out of a packet made by `withRedundancy`; null for any
 *  other packet (which then goes to the decoder as it is). */
export function extractRedundancy(packet: Uint8Array): Extracted | null {
    if (packet.length < 6 || (packet[0] & 3) !== 3) return null;
    // One frame, constant bit rate, padding present.
    if (packet[1] !== 0x41) return null;
    let i = 2;
    let padLen = 0;
    for (;;) {
        if (i >= packet.length) return null;
        const b = packet[i++];
        if (b === 255) {
            padLen += 254;
            continue;
        }
        padLen += b;
        break;
    }
    const frameEnd = packet.length - padLen;
    if (frameEnd < i || padLen < 3) return null;
    let p = frameEnd;
    if (packet[p] !== MAGIC_A || packet[p + 1] !== MAGIC_B) return null;
    const count = packet[p + 2];
    if (count > MAX_DEPTH) return null;
    p += 3;
    const copies: Uint8Array[] = [];
    for (let n = 0; n < count; n++) {
        if (p >= packet.length) return null;
        const len = packet[p++];
        if (p + len > packet.length) return null;
        copies.push(packet.slice(p, p + len));
        p += len;
    }
    const primary = new Uint8Array(1 + frameEnd - i);
    primary[0] = packet[0] & 0xfc;
    primary.set(packet.subarray(i, frameEnd), 1);
    return { primary, copies };
}
