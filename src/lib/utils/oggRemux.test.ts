import { describe, expect, it } from "vitest";
import { OggWebmRemuxer, opusPacketSamples } from "./oggRemux";
import { isOgg } from "./audioProbe";
import { probeWebm, readId, readSize } from "./webmProbe";

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

/** An Ogg page with these packets (the last may continue on the next page). */
function page(opts: {
    type?: number;
    granule: number | null;
    serial?: number;
    packets: Uint8Array[];
    continues?: boolean;
}): Uint8Array {
    const segs: number[] = [];
    opts.packets.forEach((p, i) => {
        let n = p.length;
        const open = opts.continues && i === opts.packets.length - 1;
        while (n >= 255) {
            segs.push(255);
            n -= 255;
        }
        if (!open) segs.push(n);
        else if (n > 0) segs.push(n);
    });
    const body = opts.packets.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(27 + segs.length + body);
    out.set(ascii("OggS"));
    out[5] = opts.type ?? 0;
    const v = new DataView(out.buffer);
    if (opts.granule === null) {
        v.setUint32(6, 0xffffffff, true);
        v.setUint32(10, 0xffffffff, true);
    } else {
        v.setUint32(6, opts.granule % 2 ** 32, true);
        v.setUint32(10, Math.floor(opts.granule / 2 ** 32), true);
    }
    v.setUint32(14, opts.serial ?? 1, true);
    out[26] = segs.length;
    out.set(segs, 27);
    let at = 27 + segs.length;
    for (const p of opts.packets) {
        out.set(p, at);
        at += p.length;
    }
    return out;
}

const join = (parts: Uint8Array[]) => {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
        out.set(p, at);
        at += p.length;
    }
    return out;
};

const opusHead = (preSkip = 312) =>
    Uint8Array.from([
        ...ascii("OpusHead"),
        1,
        2,
        preSkip & 255,
        preSkip >> 8,
        0x80,
        0xbb,
        0,
        0,
        0,
        0,
        0,
    ]);
const opusTags = () =>
    Uint8Array.from([...ascii("OpusTags"), 0, 0, 0, 0, 0, 0, 0, 0]);
/** A 20 ms CELT fullband packet (toc 0xf8) of `n` bytes. */
const opusAudio = (n: number, fill = 7) =>
    Uint8Array.from([0xf8, ...new Array(n - 1).fill(fill)]);

function vorbisHeaders() {
    const id = new Uint8Array(30);
    id.set([1, ...ascii("vorbis")]);
    new DataView(id.buffer).setUint32(12, 44100, true);
    id[11] = 2;
    const comment = Uint8Array.from([
        3,
        ...ascii("vorbis"),
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
    ]);
    const setup = Uint8Array.from([
        5,
        ...ascii("vorbis"),
        ...new Array(300).fill(9),
    ]);
    return { id, comment, setup };
}

interface Walked {
    clusters: { timestamp: number; blocks: { rel: number; size: number }[] }[];
    codecPrivate: Uint8Array | null;
}

/** A minimal WebM walk: Clusters, their timestamps and SimpleBlocks. */
function walk(b: Uint8Array): Walked {
    const out: Walked = { clusters: [], codecPrivate: null };
    let p = 0;
    const enter = new Set([0x18538067, 0x1654ae6b, 0xae, 0x1f43b675]);
    while (p < b.length) {
        const id = readId(b, p);
        if (!id) break;
        const size = readSize(b, p + id.length);
        if (!size) break;
        const body = p + id.length + size.length;
        if (id.id === 0x1f43b675)
            out.clusters.push({ timestamp: 0, blocks: [] });
        if (enter.has(id.id)) {
            p = body;
            continue;
        }
        const len = size.size ?? 0;
        const cur = out.clusters[out.clusters.length - 1];
        if (id.id === 0xe7) {
            let v = 0;
            for (let i = 0; i < len; i++) v = v * 256 + b[body + i];
            cur.timestamp = v;
        } else if (id.id === 0xa3) {
            cur.blocks.push({
                rel: (b[body + 1] << 8) | b[body + 2],
                size: len - 4,
            });
        } else if (id.id === 0x63a2) {
            out.codecPrivate = b.slice(body, body + len);
        }
        p = body + len;
    }
    return out;
}

function remux(file: Uint8Array, chunk = file.length) {
    const r = new OggWebmRemuxer();
    const out: Uint8Array[] = [];
    for (let i = 0; i < file.length; i += chunk) {
        r.push(file.subarray(i, i + chunk));
        out.push(...r.take());
    }
    r.end();
    out.push(...r.take());
    return { r, bytes: join(out) };
}

describe("opusPacketSamples", () => {
    it("reads frame length and count from the TOC", () => {
        expect(opusPacketSamples(Uint8Array.from([0xf8]))).toBe(960); // CELT FB 20 ms
        expect(opusPacketSamples(Uint8Array.from([0xe0]))).toBe(120); // CELT FB 2.5 ms
        expect(opusPacketSamples(Uint8Array.from([0x00]))).toBe(480); // SILK NB 10 ms
        expect(opusPacketSamples(Uint8Array.from([0xf9, 1]))).toBe(1920); // two frames
        expect(opusPacketSamples(Uint8Array.from([0xfb, 3]))).toBe(2880); // code 3: 3 frames
        expect(opusPacketSamples(new Uint8Array(0))).toBe(0);
    });
});

describe("OggWebmRemuxer, Opus", () => {
    const file = join([
        page({ type: 2, granule: 0, packets: [opusHead()] }),
        page({ granule: 0, packets: [opusTags()] }),
        page({
            granule: 312 + 960 * 3,
            packets: [opusAudio(40), opusAudio(41), opusAudio(42)],
        }),
        page({
            type: 4,
            granule: 312 + 960 * 5,
            packets: [opusAudio(43), opusAudio(44)],
        }),
    ]);

    it("writes a WebM the probe accepts, with every packet timed from its TOC", () => {
        expect(isOgg(file)).toBe(true);
        const { r, bytes } = remux(file);
        expect(r.unsupported).toBeNull();
        expect(r.mime).toBe('audio/webm; codecs="opus"');
        expect(probeWebm(bytes)).toEqual({
            status: "ok",
            mime: 'audio/webm; codecs="opus"',
        });
        const w = walk(bytes);
        expect(w.codecPrivate).toEqual(opusHead());
        const times = w.clusters.flatMap((c) =>
            c.blocks.map((b) => c.timestamp + b.rel),
        );
        expect(times).toEqual([0, 20, 40, 60, 80]);
        expect(w.clusters.flatMap((c) => c.blocks.map((b) => b.size))).toEqual([
            40, 41, 42, 43, 44,
        ]);
    });

    it("gives the same output however the bytes are chunked", () => {
        const whole = remux(file).bytes;
        for (const chunk of [1, 7, 100]) {
            expect(remux(file, chunk).bytes).toEqual(whole);
        }
    });
});

describe("OggWebmRemuxer, Vorbis", () => {
    const { id, comment, setup } = vorbisHeaders();
    const audio = [10, 11, 12, 13].map((n) =>
        Uint8Array.from(new Array(n).fill(n)),
    );

    it("laces the three headers into the codec private data and spreads times by granule", () => {
        const file = join([
            page({ type: 2, granule: 0, packets: [id] }),
            page({ granule: 0, packets: [comment, setup] }),
            page({ granule: 4410, packets: [audio[0], audio[1]] }),
            page({ type: 4, granule: 8820, packets: [audio[2], audio[3]] }),
        ]);
        const { r, bytes } = remux(file, 13);
        expect(r.unsupported).toBeNull();
        expect(probeWebm(bytes)).toEqual({
            status: "ok",
            mime: 'audio/webm; codecs="vorbis"',
        });
        const w = walk(bytes);
        const cp = w.codecPrivate!;
        expect(cp[0]).toBe(2);
        expect(cp[1]).toBe(30);
        expect(cp[2]).toBe(comment.length);
        expect(Array.from(cp.slice(3, 33))).toEqual(Array.from(id));
        expect(cp.length).toBe(3 + id.length + comment.length + setup.length);
        const times = w.clusters.flatMap((c) =>
            c.blocks.map((b) => c.timestamp + b.rel),
        );
        // 4410 samples at 44.1 kHz is 100 ms, shared by two packets per page.
        expect(times).toEqual([0, 50, 100, 150]);
    });

    it("joins a packet split over pages and over 255-byte segments", () => {
        const big = Uint8Array.from(new Array(600).fill(5));
        const file = join([
            page({ type: 2, granule: 0, packets: [id] }),
            page({ granule: 0, packets: [comment, setup] }),
            page({
                granule: null,
                packets: [big.subarray(0, 255)],
                continues: true,
            }),
            page({
                type: 1,
                granule: 4410,
                packets: [big.subarray(255), audio[0]],
            }),
        ]);
        const { r, bytes } = remux(file);
        expect(r.unsupported).toBeNull();
        const sizes = walk(bytes).clusters.flatMap((c) =>
            c.blocks.map((b) => b.size),
        );
        expect(sizes).toEqual([600, 10]);
    });
});

describe("OggWebmRemuxer, other files", () => {
    it("follows the audio stream and ignores another one", () => {
        const file = join([
            page({
                type: 2,
                serial: 9,
                granule: 0,
                packets: [Uint8Array.from([...ascii("\x80theora"), 1, 2, 3])],
            }),
            page({ type: 2, serial: 1, granule: 0, packets: [opusHead()] }),
            page({ serial: 9, granule: 0, packets: [new Uint8Array(20)] }),
            page({ serial: 1, granule: 0, packets: [opusTags()] }),
            page({ serial: 9, granule: 5, packets: [new Uint8Array(30)] }),
            page({
                type: 4,
                serial: 1,
                granule: 312 + 960,
                packets: [opusAudio(30)],
            }),
        ]);
        const { r, bytes } = remux(file);
        expect(r.unsupported).toBeNull();
        expect(walk(bytes).clusters.flatMap((c) => c.blocks)).toHaveLength(1);
    });

    it("gives up on a stream it does not know, and on non-Ogg bytes", () => {
        const flacInOgg = remux(
            page({
                type: 2,
                granule: 0,
                packets: [
                    Uint8Array.from([0x7f, ...ascii("FLAC"), 1, 0, 0, 1]),
                ],
            }),
        );
        expect(flacInOgg.r.unsupported).toMatch(/Ogg/);
        expect(flacInOgg.r.mime).toBeNull();
        const junk = new OggWebmRemuxer();
        junk.push(new Uint8Array(40));
        expect(junk.unsupported).toMatch(/sync/);
    });
});
