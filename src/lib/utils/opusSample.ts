/**
 * Compact Opus sample blobs for the bundled SoundFont. SF3 only defines Ogg
 * Vorbis, whose ~3.6 KB of per-stream codebook headers made up most of the
 * bank (390 short samples). scripts/build-soundfont.mjs instead stores each
 * sample as raw Opus packets in the SF3's compressed-sample slot, in this
 * layout (little-endian):
 *
 *   "ZOP1" | u16 preSkip | u32 frames | (u16 length, packet bytes)*
 *
 * `frames` is the decoded length at 48 kHz after pre-skip. The worker decodes
 * these with WebCodecs (decodeOpusSample) before handing the bank to the
 * synth.
 */

const MAGIC = [0x5a, 0x4f, 0x50, 0x31]; // "ZOP1"
const OPUS_RATE = 48000;

export function isOpusSample(data: Uint8Array): boolean {
    return (
        data.length >= 10 &&
        data[0] === MAGIC[0] &&
        data[1] === MAGIC[1] &&
        data[2] === MAGIC[2] &&
        data[3] === MAGIC[3]
    );
}

/** Split an Ogg Opus stream into its header fields and audio packets. */
export function parseOggOpus(ogg: Uint8Array): {
    preSkip: number;
    frames: number;
    packets: Uint8Array[];
} {
    const view = new DataView(ogg.buffer, ogg.byteOffset, ogg.byteLength);
    const packets: Uint8Array[] = [];
    let partial: number[] = [];
    let lastGranule = 0;
    let pos = 0;
    while (pos + 27 <= ogg.length) {
        if (view.getUint32(pos) !== 0x4f676753) throw new Error("bad Ogg page");
        const granule = Number(view.getBigInt64(pos + 6, true));
        if (granule > 0) lastGranule = granule;
        const segments = ogg[pos + 26];
        let body = pos + 27 + segments;
        for (let i = 0; i < segments; i++) {
            const len = ogg[pos + 27 + i];
            for (let j = 0; j < len; j++) partial.push(ogg[body + j]);
            body += len;
            if (len < 255) {
                packets.push(Uint8Array.from(partial));
                partial = [];
            }
        }
        pos = body;
    }
    const [head, tags, ...audio] = packets;
    const isHead =
        head && String.fromCharCode(...head.subarray(0, 8)) === "OpusHead";
    if (!isHead || !tags) throw new Error("not an Ogg Opus stream");
    const preSkip = new DataView(head.buffer, head.byteOffset).getUint16(
        10,
        true,
    );
    return {
        preSkip,
        frames: Math.max(0, lastGranule - preSkip),
        packets: audio,
    };
}

export function packOpusSample(ogg: Uint8Array): Uint8Array {
    const { preSkip, frames, packets } = parseOggOpus(ogg);
    const size = 10 + packets.reduce((n, p) => n + 2 + p.length, 0);
    const out = new Uint8Array(size);
    const view = new DataView(out.buffer);
    out.set(MAGIC, 0);
    view.setUint16(4, preSkip, true);
    view.setUint32(6, frames, true);
    let pos = 10;
    for (const p of packets) {
        if (p.length > 0xffff) throw new Error("Opus packet too large");
        view.setUint16(pos, p.length, true);
        out.set(p, pos + 2);
        pos += 2 + p.length;
    }
    return out;
}

export function unpackOpusSample(data: Uint8Array): {
    preSkip: number;
    frames: number;
    packets: Uint8Array[];
} {
    if (!isOpusSample(data)) throw new Error("not a ZOP1 sample");
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const preSkip = view.getUint16(4, true);
    const frames = view.getUint32(6, true);
    const packets: Uint8Array[] = [];
    let pos = 10;
    while (pos + 2 <= data.length) {
        const len = view.getUint16(pos, true);
        packets.push(data.subarray(pos + 2, pos + 2 + len));
        pos += 2 + len;
    }
    return { preSkip, frames, packets };
}

/** Decode a ZOP1 blob to mono float PCM at 48 kHz with WebCodecs. */
export async function decodeOpusSample(
    data: Uint8Array,
): Promise<Float32Array> {
    const { preSkip, frames, packets } = unpackOpusSample(data);
    const chunks: Float32Array[] = [];
    let error: unknown = null;
    const decoder = new AudioDecoder({
        output: (audio) => {
            const pcm = new Float32Array(audio.numberOfFrames);
            audio.copyTo(pcm, { planeIndex: 0, format: "f32-planar" });
            audio.close();
            chunks.push(pcm);
        },
        error: (e) => (error = e),
    });
    decoder.configure({
        codec: "opus",
        sampleRate: OPUS_RATE,
        numberOfChannels: 1,
    });
    let timestamp = 0;
    for (const packet of packets) {
        decoder.decode(
            new EncodedAudioChunk({ type: "key", timestamp, data: packet }),
        );
        timestamp += 20_000; // µs; only needs to increase
    }
    await decoder.flush();
    decoder.close();
    if (error) throw error;

    const total = chunks.reduce((n, c) => n + c.length, 0);
    const all = new Float32Array(total);
    let at = 0;
    for (const c of chunks) {
        all.set(c, at);
        at += c.length;
    }
    // Whether WebCodecs drops the encoder's pre-skip isn't specified; tell
    // from the length (preSkip + frames only fits if it didn't).
    const start = total >= preSkip + frames ? preSkip : 0;
    return all.slice(start, start + frames);
}
