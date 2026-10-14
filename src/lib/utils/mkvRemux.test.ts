import { describe, it, expect } from "vitest";
import { MkvRemuxer, type RemuxSegment } from "./mkvRemux";

const enc = new TextEncoder();

/** EBML size: 1 byte when small, else 8 bytes; null = unknown size. */
function size(n: number | null): number[] {
    if (n === null) return [0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
    if (n < 0x7f) return [0x80 | n];
    const out = [0x01, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 7; i >= 1; i--) {
        out[i] = n & 0xff;
        n = Math.floor(n / 256);
    }
    return out;
}

function el(id: number[], payload: number[], unknown = false): number[] {
    return [...id, ...size(unknown ? null : payload.length), ...payload];
}

const f64 = (v: number) => {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setFloat64(0, v);
    return [...b];
};

const EBML = [0x1a, 0x45, 0xdf, 0xa3];
const SEGMENT = [0x18, 0x53, 0x80, 0x67];
const INFO = [0x15, 0x49, 0xa9, 0x66];
const TIMESTAMP_SCALE = [0x2a, 0xd7, 0xb1];
const DURATION = [0x44, 0x89];
const TRACKS = [0x16, 0x54, 0xae, 0x6b];
const TRACK_ENTRY = [0xae];
const TRACK_NUMBER = [0xd7];
const TRACK_TYPE = [0x83];
const CODEC_ID = [0x86];
const CODEC_PRIVATE = [0x63, 0xa2];
const VIDEO = [0xe0];
const AUDIO = [0xe1];
const CLUSTER = [0x1f, 0x43, 0xb6, 0x75];
const CLUSTER_TS = [0xe7];
const SIMPLE_BLOCK = [0xa3];
const BLOCK_GROUP = [0xa0];
const BLOCK = [0xa1];
const REFERENCE_BLOCK = [0xfb];
const CUES = [0x1c, 0x53, 0xbb, 0x6b];
const VOID = [0xec];

// avcC: version 1, High profile, level 3.1, 4-byte lengths, no SPS/PPS.
const AVCC = [1, 0x64, 0x00, 0x1f, 0xff, 0xe0, 0x00];
// AAC-LC, 48 kHz, stereo.
const ASC = [0x11, 0x90];

function videoTrack(codec = "V_MPEG4/ISO/AVC", priv = AVCC) {
    return el(TRACK_ENTRY, [
        ...el(TRACK_NUMBER, [1]),
        ...el(TRACK_TYPE, [1]),
        ...el(CODEC_ID, [...enc.encode(codec)]),
        ...el(CODEC_PRIVATE, priv),
        ...el(VIDEO, [0xb0, 0x82, 0x02, 0x80, 0xba, 0x82, 0x01, 0x68]),
    ]);
}

function audioTrack(codec = "A_AAC") {
    return el(TRACK_ENTRY, [
        ...el(TRACK_NUMBER, [2]),
        ...el(TRACK_TYPE, [2]),
        ...el(CODEC_ID, [...enc.encode(codec)]),
        ...el(CODEC_PRIVATE, ASC),
        ...el(AUDIO, [0xb5, 0x88, ...f64(48000), 0x9f, 0x81, 0x02]),
    ]);
}

/** A block body: track, signed 16-bit relative time, flags, payload. */
function block(track: number, rel: number, flags: number, data: number[]) {
    return [0x80 | track, (rel >> 8) & 0xff, rel & 0xff, flags, ...data];
}

function mkv(tracks: number[][], clusters: number[][]) {
    return new Uint8Array([
        ...el(EBML, [0x42, 0x82, 0x88, ...enc.encode("matroska")]),
        ...el(
            SEGMENT,
            [
                ...el(INFO, [
                    ...el(TIMESTAMP_SCALE, [0x0f, 0x42, 0x40]),
                    ...el(DURATION, f64(1000)),
                ]),
                ...el(TRACKS, tracks.flat()),
                ...el(VOID, new Array(200).fill(0)),
                ...clusters.flat(),
                ...el(CUES, [0, 0, 0]),
            ],
            true,
        ),
    ]);
}

interface Run {
    baseDts: number;
    samples: { duration: number; size: number; flags: number; cts: number }[];
    payload: number[];
}

/** Pull tfdt and trun rows back out of a moof+mdat. */
function readFragment(buf: ArrayBuffer): Run {
    const b = new Uint8Array(buf);
    const dv = new DataView(buf);
    const find = (type: string, from = 0): number => {
        for (let i = from; i < b.length - 4; i++) {
            if (String.fromCharCode(...b.subarray(i, i + 4)) === type) {
                return i - 4;
            }
        }
        throw new Error(`no ${type}`);
    };
    const tfdt = find("tfdt");
    const baseDts = dv.getUint32(tfdt + 12) * 2 ** 32 + dv.getUint32(tfdt + 16);
    const trun = find("trun");
    const count = dv.getUint32(trun + 12);
    const dataOffset = dv.getUint32(trun + 16);
    const samples = [];
    let total = 0;
    for (let i = 0; i < count; i++) {
        const at = trun + 20 + i * 16;
        const row = {
            duration: dv.getUint32(at),
            size: dv.getUint32(at + 4),
            flags: dv.getUint32(at + 8),
            cts: dv.getInt32(at + 12),
        };
        total += row.size;
        samples.push(row);
    }
    return {
        baseDts,
        samples,
        payload: [...b.subarray(dataOffset, dataOffset + total)],
    };
}

function remuxAll(file: Uint8Array, chunk = file.length) {
    const r = new MkvRemuxer();
    const segments: RemuxSegment[] = [];
    for (let i = 0; i < file.length; i += chunk) {
        r.push(file.subarray(i, i + chunk));
        segments.push(...r.take());
    }
    r.end();
    segments.push(...r.take());
    return { r, segments };
}

/** Video with B-frames, 40 ms apart, in decode order: I P B B P B B. */
const VIDEO_PTS = [0, 120, 40, 80, 240, 160, 200];

function avFile() {
    const blocks = VIDEO_PTS.flatMap((pts, i) =>
        el(SIMPLE_BLOCK, block(1, pts, i === 0 ? 0x80 : 0, [i, i, i])),
    );
    // Three AAC frames Xiph-laced into one block, then one on its own.
    const laced = el(
        SIMPLE_BLOCK,
        block(2, 0, 0x80 | 0x02, [2, 2, 3, 0xa1, 0xa1, 0xb2, 0xb2, 0xb2, 0xc3]),
    );
    const single = el(SIMPLE_BLOCK, block(2, 64, 0x80, [0xd4]));
    // A BlockGroup with a ReferenceBlock is a non-keyframe.
    const grouped = el(BLOCK_GROUP, [
        ...el(BLOCK, block(1, 280, 0, [9])),
        ...el(REFERENCE_BLOCK, [0x81]),
    ]);
    return mkv(
        [videoTrack(), audioTrack()],
        [
            el(
                CLUSTER,
                [
                    ...el(CLUSTER_TS, [0]),
                    ...laced,
                    ...blocks,
                    ...single,
                    ...grouped,
                ],
                true,
            ),
        ],
    );
}

describe("MkvRemuxer", () => {
    it("describes H.264 + AAC as two MP4 tracks", () => {
        const { r } = remuxAll(avFile());
        expect(r.unsupported).toBeNull();
        expect(r.header?.tracks.map((t) => t.mime)).toEqual([
            'video/mp4; codecs="avc1.64001f"',
            'audio/mp4; codecs="mp4a.40.2"',
        ]);
        expect(r.header?.duration).toBe(1);
        const init = new Uint8Array(r.header!.tracks[0].init);
        const text = String.fromCharCode(...init);
        expect(text).toContain("ftyp");
        expect(text).toContain("avcC");
        expect(text).toContain("mvex");
    });

    it("rebuilds decode timestamps for B-frames", () => {
        const { segments } = remuxAll(avFile());
        const video = segments
            .filter((s) => s.track === 0)
            .map((s) => readFragment(s.buffer));
        const rows = video.flatMap((v) => v.samples);
        expect(rows).toHaveLength(8);
        // DTS are the sorted presentation times; presentation is pushed back
        // by the 40 ms reorder delay so no frame shows before it decodes.
        const ms = 90; // ticks per ms at 90 kHz
        expect(video[0].baseDts).toBe(0);
        let dts = video[0].baseDts;
        const pts: number[] = [];
        for (const row of rows) {
            pts.push((dts + row.cts) / ms - 40);
            expect(row.cts).toBeGreaterThanOrEqual(0);
            dts += row.duration;
        }
        expect(pts).toEqual([...VIDEO_PTS, 280]);
        expect(rows.map((r) => r.flags === 0x02000000)).toEqual([
            true,
            false,
            false,
            false,
            false,
            false,
            false,
            false,
        ]);
        expect(video.flatMap((v) => v.payload).slice(0, 6)).toEqual([
            0, 0, 0, 1, 1, 1,
        ]);
    });

    it("unlaces audio and shifts it with the video", () => {
        const { segments } = remuxAll(avFile());
        const audio = segments
            .filter((s) => s.track === 1)
            .map((s) => readFragment(s.buffer));
        const rows = audio.flatMap((a) => a.samples);
        expect(rows.map((r) => r.size)).toEqual([2, 3, 1, 1]);
        expect(audio.flatMap((a) => a.payload)).toEqual([
            0xa1, 0xa1, 0xb2, 0xb2, 0xb2, 0xc3, 0xd4,
        ]);
        // Starts at the same 40 ms the video was pushed back by (48 kHz).
        expect(audio[0].baseDts).toBe(40 * 48);
        // One AAC frame is 1024 samples; the lace fills the gap to 64 ms.
        expect(rows.slice(0, 3).map((r) => r.duration)).toEqual([
            1024, 1024, 1024,
        ]);
    });

    it("gives the same output fed one byte at a time", () => {
        const whole = remuxAll(avFile()).segments;
        const bytewise = remuxAll(avFile(), 1).segments;
        const flatten = (segs: RemuxSegment[], track: number) =>
            segs
                .filter((s) => s.track === track)
                .flatMap((s) => readFragment(s.buffer).samples);
        expect(flatten(bytewise, 0)).toEqual(flatten(whole, 0));
        expect(flatten(bytewise, 1)).toEqual(flatten(whole, 1));
    });

    it("skips frames before the first keyframe", () => {
        const file = mkv(
            [videoTrack()],
            [
                el(CLUSTER, [
                    ...el(CLUSTER_TS, [0]),
                    ...el(SIMPLE_BLOCK, block(1, 0, 0, [7])),
                    ...el(SIMPLE_BLOCK, block(1, 40, 0x80, [8])),
                    ...el(SIMPLE_BLOCK, block(1, 80, 0, [9])),
                ]),
            ],
        );
        const { segments } = remuxAll(file);
        expect(segments.flatMap((s) => readFragment(s.buffer).payload)).toEqual(
            [8, 9],
        );
    });

    it("refuses codecs it can't put in MP4", () => {
        const { r } = remuxAll(
            mkv(
                [videoTrack("V_MPEG4/ISO/AVC"), audioTrack("A_AC3")],
                [el(CLUSTER, el(CLUSTER_TS, [0]))],
            ),
        );
        expect(r.header).toBeNull();
        expect(r.unsupported).toMatch(/A_AC3/);
    });

    it("refuses a file that is not Matroska", () => {
        const r = new MkvRemuxer();
        r.push(new Uint8Array(64).fill(0));
        expect(r.header).toBeNull();
        expect(r.unsupported).not.toBeNull();
    });
});
