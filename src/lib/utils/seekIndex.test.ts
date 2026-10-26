import { describe, it, expect } from "vitest";
import { fragment } from "./mkvRemux";
import {
    FragmentLog,
    fragmentTimes,
    initTimescale,
    Mp3Index,
    mp3Frame,
    WebmIndex,
    type Refill,
} from "./seekIndex";

function concat(parts: ArrayBuffer[]): Uint8Array {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
    let at = 0;
    for (const p of parts) {
        out.set(new Uint8Array(p), at);
        at += p.byteLength;
    }
    return out;
}

function bytesOf(refill: Refill | null): Uint8Array {
    return concat(
        (refill ?? []).flatMap((r) => ("buffer" in r ? [r.buffer] : [])),
    );
}

function pushChunked(
    index: { push(b: ArrayBuffer): void },
    bytes: Uint8Array,
    chunk: number,
) {
    for (let i = 0; i < bytes.length; i += chunk)
        index.push(bytes.slice(i, i + chunk).buffer);
}

function box(type: string, ...parts: number[][]): number[] {
    const body = parts.flat();
    const size = 8 + body.length;
    return [
        size >>> 24,
        (size >> 16) & 0xff,
        (size >> 8) & 0xff,
        size & 0xff,
        ...[...type].map((c) => c.charCodeAt(0)),
        ...body,
    ];
}

const KEY = 0x02000000;
const NON_KEY = 0x01010000;

/** A one-track fragment at `base` (timescale ticks) of 100-tick samples. */
function frag(base: number, flags: number[], cts = 0): ArrayBuffer {
    const samples = flags.map(() => ({ data: new Uint8Array(4) }));
    const rows = flags.map((f) => ({ duration: 100, size: 4, flags: f, cts }));
    return fragment(1, base, rows, samples, samples.length * 4);
}

describe("fMP4", () => {
    it("reads the timescale from mdhd", () => {
        const mdhd = [0, 0, 0, 0, ...Array(8).fill(0), 0, 0, 0x3a, 0x98];
        const init = box(
            "moov",
            box("trak", box("mdia", box("mdhd", mdhd, Array(8).fill(0)))),
        );
        expect(initTimescale(Uint8Array.from(init))).toBe(15000);
    });

    it("places a fragment's first keyframe", () => {
        const times = fragmentTimes(
            new Uint8Array(frag(5000, [NON_KEY, KEY, NON_KEY], 50)),
            1000,
        );
        expect(times).toEqual({ start: 5, sync: 5.15 });
        expect(
            fragmentTimes(new Uint8Array(frag(0, [NON_KEY])), 1000)?.sync,
        ).toBeNull();
    });

    it("refills from the fragment before the last keyframe at or before t", () => {
        const log = new FragmentLog(1000);
        const frags = [
            frag(0, [KEY, NON_KEY]),
            frag(200, [NON_KEY, NON_KEY]),
            frag(400, [NON_KEY, KEY]),
            frag(600, [KEY, NON_KEY]),
        ];
        for (const f of frags) log.add(f);
        // Keyframes at 0, 0.5, 0.6: t = 0.55 resumes from 0.5's fragment,
        // one early.
        expect(log.from(0.55)?.map((r) => "buffer" in r && r.buffer)).toEqual(
            frags.slice(1),
        );
        expect(log.from(0.1)?.length).toBe(4);
        expect(new FragmentLog(1000).from(3)).toBeNull();
    });
});

describe("Mp3Index", () => {
    // MPEG-1 Layer III, 128 kbit/s, 44.1 kHz: 417-byte frames of 1152 samples.
    const FRAME = 417;
    const frames = new Uint8Array(FRAME * 200);
    for (let i = 0; i < 200; i++)
        frames.set([0xff, 0xfb, 0x90, 0x00], i * FRAME);
    const tag = new Uint8Array(10 + 50);
    tag.set([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 50]);
    const file = concat([tag.buffer, frames.buffer]);

    it("measures a frame", () => {
        const f = mp3Frame(frames, 0);
        expect(f?.length).toBe(FRAME);
        expect(f?.seconds).toBeCloseTo(1152 / 44100, 9);
    });

    it("refills from a frame, telling the SourceBuffer its time", () => {
        for (const chunk of [7, 400, 5000, file.length]) {
            const index = new Mp3Index();
            pushChunked(index, file, chunk);
            const refill = index.from(2)!;
            const reset = refill[0] as { timestampOffset: number };
            // Entries every ~0.5 s; one step back from the last at <= 2 s.
            expect(reset.timestampOffset).toBeLessThanOrEqual(1.6);
            expect(reset.timestampOffset).toBeGreaterThan(1);
            const bytes = bytesOf(refill);
            const frame = (file.length - bytes.length - tag.length) / FRAME;
            expect(Number.isInteger(frame)).toBe(true);
            expect(frame * (1152 / 44100)).toBeCloseTo(
                reset.timestampOffset,
                6,
            );
        }
    });
});

describe("WebmIndex", () => {
    // EBML header, Segment of unknown size, Info, Tracks, then clusters
    // stamped 0, 1000, 2000 ms holding one 4-byte SimpleBlock each.
    const header = [
        ...[0x1a, 0x45, 0xdf, 0xa3, 0x80],
        ...[
            0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
            0xff,
        ],
        ...[
            0x15, 0x49, 0xa9, 0x66, 0x87, 0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42,
            0x40,
        ],
        ...[0x16, 0x54, 0xae, 0x6b, 0x80],
    ];
    const cluster = (ms: number) => [
        ...[0x1f, 0x43, 0xb6, 0x75, 0x8a],
        ...[0xe7, 0x82, ms >> 8, ms & 0xff],
        ...[0xa3, 0x84, 1, 2, 3, 4],
    ];
    const clusters = [0, 1000, 2000].map(cluster);
    const file = Uint8Array.from([header, ...clusters].flat());

    it("refills with the header, then from a cluster", () => {
        for (const chunk of [1, 5, 13, file.length]) {
            const index = new WebmIndex();
            pushChunked(index, file, chunk);
            const refill = index.from(2.5)!;
            expect(refill[0]).toEqual({ reset: true });
            expect(Array.from(bytesOf(refill))).toEqual(
                [header, ...clusters.slice(1)].flat(),
            );
            expect(Array.from(bytesOf(index.from(0.5)))).toEqual(
                Array.from(file),
            );
        }
    });
});
