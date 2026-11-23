import { describe, it, expect } from "vitest";
import { fragment } from "./mkvRemux";
import {
    ByteLog,
    FragmentLog,
    fragmentTimes,
    HOT_BYTES,
    initTimescale,
    Mp3Index,
    mp3Frame,
    WebmIndex,
    type Refill,
} from "./seekIndex";

// Browsers have Blob.arrayBuffer(); jsdom may not, so read through FileReader.
if (typeof Blob.prototype.arrayBuffer !== "function") {
    Object.defineProperty(Blob.prototype, "arrayBuffer", {
        configurable: true,
        writable: true,
        value(this: Blob): Promise<ArrayBuffer> {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as ArrayBuffer);
                reader.onerror = () => reject(reader.error);
                reader.readAsArrayBuffer(this);
            });
        },
    });
}

function concat(parts: ArrayBuffer[]): Uint8Array {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
    let at = 0;
    for (const p of parts) {
        out.set(new Uint8Array(p), at);
        at += p.byteLength;
    }
    return out;
}

/** The bytes a refill appends, reading any cold parts. */
async function bytesOf(refill: Refill | null): Promise<Uint8Array> {
    const parts: ArrayBuffer[] = [];
    for (const r of refill ?? []) {
        if ("buffer" in r) parts.push(r.buffer);
        else if ("read" in r) parts.push(await r.read());
    }
    return concat(parts);
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

    it("refills from a frame, telling the SourceBuffer its time", async () => {
        for (const chunk of [7, 400, 5000, file.length]) {
            const index = new Mp3Index();
            pushChunked(index, file, chunk);
            const refill = index.from(2)!;
            const reset = refill[0] as { timestampOffset: number };
            // Entries every ~0.5 s; one step back from the last at <= 2 s.
            expect(reset.timestampOffset).toBeLessThanOrEqual(1.6);
            expect(reset.timestampOffset).toBeGreaterThan(1);
            const bytes = await bytesOf(refill);
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

    it("refills with the header, then from a cluster", async () => {
        for (const chunk of [1, 5, 13, file.length]) {
            const index = new WebmIndex();
            pushChunked(index, file, chunk);
            const refill = index.from(2.5)!;
            expect(refill[0]).toEqual({ reset: true });
            expect(Array.from(await bytesOf(refill))).toEqual(
                [header, ...clusters.slice(1)].flat(),
            );
            expect(Array.from(await bytesOf(index.from(0.5)))).toEqual(
                Array.from(file),
            );
        }
    });
});

describe("ByteLog", () => {
    const data = Uint8Array.from(
        { length: 1000 },
        (_, i) => (i * 7 + 3) & 0xff,
    );

    /** `data` pushed in chunks of varying sizes. */
    function filled(hotCap: number, keepCap: number): ByteLog {
        const log = new ByteLog(hotCap, keepCap);
        const sizes = [3, 10, 1, 25, 7, 64];
        let at = 0;
        for (let n = 0; at < data.length; n++) {
            const size = Math.min(sizes[n % sizes.length], data.length - at);
            log.push(data.slice(at, at + size).buffer);
            at += size;
        }
        return log;
    }

    it("serves the same bytes across the hot/cold boundary", async () => {
        const log = filled(100, 50);
        expect(log.length).toBe(data.length);
        expect(log.hotBytes).toBeLessThanOrEqual(100);
        expect(log.plan().some((p) => "read" in p)).toBe(true);
        expect(Array.from(concat(await log.range()))).toEqual(Array.from(data));
    });

    it("cuts chunks, cold or hot, at any offset", async () => {
        const log = filled(100, 50);
        for (const [a, b] of [
            [0, 1],
            [2, 4],
            [5, 130],
            [333, 777],
            [900, 1000],
            [990, 1000],
            [500, 500],
        ]) {
            expect(Array.from(concat(await log.range(a, b)))).toEqual(
                Array.from(data.subarray(a, b)),
            );
        }
    });

    it("reads a range entirely in cold storage", async () => {
        const log = filled(100, 50);
        const parts = log.plan(0, 20);
        expect(parts.length).toBeGreaterThan(0);
        expect(parts.every((p) => "read" in p)).toBe(true);
        expect(Array.from(concat(await log.range(0, 20)))).toEqual(
            Array.from(data.subarray(0, 20)),
        );
    });

    it("keeps the hot window under its cap after many pushes", () => {
        const log = new ByteLog(4096, 2048);
        let total = 0;
        for (let i = 0; i < 5000; i++) {
            const size = 1 + ((i * 97) % 700);
            log.push(new ArrayBuffer(size));
            total += size;
            expect(log.hotBytes).toBeLessThanOrEqual(4096);
        }
        expect(log.length).toBe(total);
    });

    it("holds the default cap under HOT_BYTES", () => {
        const log = new ByteLog();
        const chunk = 1024 * 1024;
        for (let i = 0; i < 60; i++) log.push(new ArrayBuffer(chunk));
        expect(log.length).toBe(60 * chunk);
        expect(log.hotBytes).toBeLessThanOrEqual(HOT_BYTES);
        expect(log.hotBytes).toBeGreaterThan(0);
    });

    it("drops every reference on release", async () => {
        const log = filled(100, 50);
        log.release();
        expect(log.hotBytes).toBe(0);
        expect(log.plan()).toEqual([]);
        expect(await log.range()).toEqual([]);
        log.push(new ArrayBuffer(10));
        expect(log.plan()).toEqual([]);
    });
});

describe("FragmentLog cold storage", () => {
    it("refills the same fragments whether they are hot or cold", async () => {
        const frags = [
            frag(0, [KEY, NON_KEY]),
            frag(200, [NON_KEY, NON_KEY]),
            frag(400, [NON_KEY, KEY]),
            frag(600, [KEY, NON_KEY]),
            frag(800, [NON_KEY]),
            frag(1000, [KEY]),
        ];
        const hot = new FragmentLog(1000);
        // Room for about two fragments: the rest go to Blob storage.
        const cold = new FragmentLog(1000, frags[0].byteLength * 2);
        for (const f of frags) {
            hot.add(f);
            cold.add(f);
        }
        expect(cold.from(0.1)?.some((r) => "read" in r)).toBe(true);
        for (const t of [0, 0.1, 0.55, 0.65, 1.2]) {
            expect(Array.from(await bytesOf(cold.from(t)))).toEqual(
                Array.from(await bytesOf(hot.from(t))),
            );
        }
        // Keyframes at 0, 0.5, 0.6: t = 0.55 resumes from 0.5's fragment,
        // one early.
        expect(Array.from(await bytesOf(cold.from(0.55)))).toEqual(
            Array.from(concat(frags.slice(1))),
        );
    });

    it("releases its fragments", () => {
        const log = new FragmentLog(1000, 10);
        log.add(frag(0, [KEY]));
        log.release();
        expect(log.from(0)).toBeNull();
    });
});
