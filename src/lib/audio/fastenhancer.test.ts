import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    FastEnhancerCore,
    FE_HOP,
    FE_DELAY,
    FE_SLEEP_HOPS,
    FE_SPEC,
    FE_TINY,
    FeGpuFramer,
    FeStft,
    decodeFrame,
    encodeFrame,
} from "./fastenhancer.worklet.js";

const SR = 48000;
let seed = 1;
const rand = () =>
    ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
const wasm = readFileSync("src/lib/audio/fastenhancer.wasm");
const weights = readFileSync("src/lib/audio/fastenhancer_b.bin");
const weightsBuf = weights.buffer.slice(
    weights.byteOffset,
    weights.byteOffset + weights.byteLength,
);
const make = () => new FastEnhancerCore(wasm, weightsBuf);

// Feed `x` in blocks of `size` samples, as the audio thread does.
function run(
    core: FastEnhancerCore,
    x: Float32Array,
    size: (i: number) => number = () => 128,
) {
    const out = new Float32Array(x.length);
    for (let i = 0; i < x.length;) {
        const n = Math.min(size(i), x.length - i);
        const o = new Float32Array(n);
        core.process(x.subarray(i, i + n), o);
        out.set(o, i);
        i += n;
    }
    return out;
}
const rms = (x: Float32Array, a: number, b: number) => {
    let s = 0;
    for (let i = a; i < b; i++) s += x[i] * x[i];
    return Math.sqrt(s / (b - a));
};

describe("FastEnhancerCore", () => {
    it("starts with a hop of silence", () => {
        const core = make();
        const x = new Float32Array(SR).map(() => rand() * 0.1);
        const y = run(core, x);
        for (let i = 0; i < FE_HOP; i++) expect(y[i]).toBe(0);
        expect(FE_DELAY).toBe(FE_HOP + FE_HOP);
        core.destroy();
    });

    it("takes steady room noise down", () => {
        const core = make();
        const x = new Float32Array(3 * SR).map(() => rand() * 0.003);
        const y = run(core, x);
        expect(rms(y, 2 * SR, 3 * SR)).toBeLessThan(
            rms(x, 2 * SR, 3 * SR) * 0.8,
        );
        core.destroy();
    });

    it("answers any block size the same", () => {
        const x = new Float32Array(SR).map(() => rand() * 0.05);
        const a = run(make(), x);
        const b = run(make(), x, (i) => 1 + ((i * 7) % 300));
        expect(Array.from(b)).toEqual(Array.from(a));
    });

    it("stops running the network in silence and wakes on sound", () => {
        const core = make();
        // Count network runs.
        let runs = 0;
        const x = core.x;
        const feProcess = x.fe_process as (e: number) => void;
        core.x = {
            ...x,
            fe_process: (e: number) => (runs++, feProcess(e)),
        };
        const hops = (n: number) => n * FE_HOP;
        run(
            core,
            new Float32Array(hops(100)).map(() => rand() * 0.05),
        );
        expect(runs).toBe(100);
        // Muted: exact zeros. It runs until FE_SLEEP_HOPS, then sleeps.
        runs = 0;
        const muted = run(core, new Float32Array(hops(200)));
        expect(runs).toBe(FE_SLEEP_HOPS - 1);
        expect(
            muted.subarray(hops(FE_SLEEP_HOPS + 2)).every((v) => v === 0),
        ).toBe(true);
        // A quiet room (-50 dBFS noise) keeps it running.
        runs = 0;
        run(
            core,
            new Float32Array(hops(50)).map(() => rand() * 0.003),
        );
        expect(runs).toBe(50);
        // So does a sound right after sleeping, from its first hop.
        run(core, new Float32Array(hops(50)));
        runs = 0;
        const loud = new Float32Array(hops(10)).map(() => rand() * 0.1);
        const y = run(core, loud);
        expect(runs).toBe(10);
        expect(rms(y, hops(2), hops(10))).toBeGreaterThan(0);
        core.destroy();
    });

    it("keeps a loud voice-like tone instead of suppressing it as noise", () => {
        const core = make();
        const x = new Float32Array(2 * SR).map((_, i) => {
            // harmonics of 150 Hz with a speech-like envelope, over faint noise
            let s = 0;
            for (let h = 1; h <= 12; h++)
                s += Math.sin((2 * Math.PI * 150 * h * i) / SR) / h;
            return (
                s * 0.1 * (0.6 + 0.4 * Math.sin((2 * Math.PI * 3 * i) / SR)) +
                rand() * 0.001
            );
        });
        const y = run(core, x);
        expect(rms(y, SR, 2 * SR)).toBeGreaterThan(rms(x, SR, 2 * SR) * 0.3);
        core.destroy();
    });

    it("runs the Tiny model's weights", () => {
        const t = readFileSync("src/lib/audio/fastenhancer_t.bin");
        const core = new FastEnhancerCore(
            wasm,
            t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength),
            FE_TINY,
        );
        const x = new Float32Array(3 * SR).map(() => rand() * 0.003);
        const y = run(core, x);
        expect(rms(y, 2 * SR, 3 * SR)).toBeLessThan(
            rms(x, 2 * SR, 3 * SR) * 0.8,
        );
        core.destroy();
    });
});

// A mask of 1 + 0i: the network's output is its input (but for the Nyquist
// bin, which it drops; the test signals have nothing there).
const identity = new Float32Array(FE_SPEC).fill(1, 0, FE_SPEC / 2);
const tones = (n: number) =>
    new Float32Array(n).map(
        (_, i) =>
            0.05 * Math.sin((2 * Math.PI * 220 * i) / SR) +
            0.03 * Math.sin((2 * Math.PI * 3170 * i) / SR + 1) +
            0.02 * Math.sin((2 * Math.PI * 9001 * i) / SR + 2),
    );

describe("FeStft", () => {
    it("gives back its input through an identity mask, one hop late", () => {
        const stft = new FeStft();
        const x = tones(40 * FE_HOP);
        const y = new Float32Array(x.length);
        const spec = new Float32Array(FE_SPEC);
        for (let t = 0; t < 40; t++) {
            stft.analyze(x.subarray(t * FE_HOP, (t + 1) * FE_HOP), spec);
            stft.synthesize(
                spec,
                identity,
                y.subarray(t * FE_HOP, (t + 1) * FE_HOP),
            );
        }
        for (let i = 2 * FE_HOP; i < x.length; i++)
            expect(y[i]).toBeCloseTo(x[i - FE_HOP], 5);
    });
});

describe("FeGpuFramer", () => {
    // A backend that answers with `mask` when `answer(seq)` says so.
    function framer(
        opts: { slack?: number; maxSlack?: number },
        answer: (seq: number) => "now" | "later" | "never",
    ) {
        const later: ArrayBuffer[] = [];
        const f: FeGpuFramer = new FeGpuFramer((buf: ArrayBuffer) => {
            const m = decodeFrame(buf)!;
            const a = answer(m.seq);
            const reply = encodeFrame(m.seq, identity);
            if (a === "now") f.receive(reply);
            else if (a === "later") later.push(reply);
        }, opts);
        return { f, later };
    }
    const feed = (f: FeGpuFramer, x: Float32Array) => {
        const y = new Float32Array(x.length);
        for (let i = 0; i < x.length; i += 128)
            f.process(x.subarray(i, i + 128), y.subarray(i, i + 128));
        return y;
    };

    it("lags by FastEnhancer's delay plus the slack", () => {
        for (const slack of [0, 1, 3]) {
            const { f } = framer({ slack }, () => "now");
            const x = tones(30 * FE_HOP);
            const y = feed(f, x);
            const lag = FE_DELAY + slack * FE_HOP;
            // Silence until the first hop is synthesized; that hop is the
            // window's lead-in, near zero.
            for (let i = 0; i < lag - FE_HOP; i++) expect(y[i]).toBe(0);
            for (let i = lag - FE_HOP; i < lag; i++)
                expect(Math.abs(y[i])).toBeLessThan(1e-4);
            for (let i = lag + FE_HOP; i < x.length; i++)
                expect(y[i]).toBeCloseTo(x[i - lag], 5);
        }
    });

    it("plays answers that arrive within the slack", () => {
        const { f, later } = framer({ slack: 1 }, () => "later");
        const x = tones(30 * FE_HOP);
        const y = new Float32Array(x.length);
        for (let i = 0; i < x.length; i += 128) {
            // Answers land between render blocks.
            for (const b of later.splice(0)) f.receive(b);
            f.process(x.subarray(i, i + 128), y.subarray(i, i + 128));
        }
        expect(f.stats().misses).toBe(0);
        const lag = FE_DELAY + FE_HOP;
        for (let i = lag + FE_HOP; i < x.length; i++)
            expect(y[i]).toBeCloseTo(x[i - lag], 5);
    });

    it("conceals misses, widens the slack, then gives up", () => {
        const { f } = framer({ slack: 1, maxSlack: 3 }, (seq) =>
            seq < 20 ? "now" : "never",
        );
        const x = new Float32Array(60 * FE_HOP).map(() => rand() * 0.1);
        const y = feed(f, x);
        expect(f.stats().slack).toBe(3);
        expect(f.failed).toBe(true);
        // Concealed with the last mask (identity here), not dropped out.
        expect(rms(y, 40 * FE_HOP, 60 * FE_HOP)).toBeGreaterThan(0.03);
    });

    it("sends nothing while the mic is muted", () => {
        let sent = 0;
        const { f } = framer({ slack: 1 }, () => (sent++, "now"));
        feed(f, new Float32Array(100 * FE_HOP));
        expect(sent).toBe(FE_SLEEP_HOPS - 1);
        expect(f.failed).toBe(false);
    });
});
