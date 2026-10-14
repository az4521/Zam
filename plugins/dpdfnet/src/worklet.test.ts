import { describe, it, expect } from "vitest";
import {
    ComplexFFT,
    RealFFT,
    DpdfnetFramer,
    DPDF_BINS,
    DPDF_HOP,
    DPDF_MODEL_LAG,
    DPDF_WIN,
    decodeFrame,
    encodeFrame,
} from "./worklet.js";

let seed = 1;
const rand = () =>
    ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;

describe("ComplexFFT", () => {
    for (const n of [960, 480, 60, 8]) {
        it(`matches a naive DFT at n=${n}`, () => {
            const re = Float64Array.from({ length: n }, rand);
            const im = Float64Array.from({ length: n }, rand);
            const wantRe = new Float64Array(n);
            const wantIm = new Float64Array(n);
            for (let k = 0; k < n; k++)
                for (let t = 0; t < n; t++) {
                    const a = (-2 * Math.PI * k * t) / n;
                    wantRe[k] += re[t] * Math.cos(a) - im[t] * Math.sin(a);
                    wantIm[k] += re[t] * Math.sin(a) + im[t] * Math.cos(a);
                }
            new ComplexFFT(n).forward(re, im);
            for (let k = 0; k < n; k++) {
                expect(re[k]).toBeCloseTo(wantRe[k], 9);
                expect(im[k]).toBeCloseTo(wantIm[k], 9);
            }
        });
    }

    it("rejects sizes with other prime factors", () => {
        expect(() => new ComplexFFT(7 * 64)).toThrow();
    });
});

describe("RealFFT", () => {
    it("inverse undoes forward", () => {
        const f = new RealFFT(DPDF_WIN);
        const x = Float32Array.from({ length: DPDF_WIN }, rand);
        const spec = new Float32Array(DPDF_BINS * 2);
        const y = new Float32Array(DPDF_WIN);
        f.forward(x, spec);
        f.inverse(spec, y);
        for (let i = 0; i < DPDF_WIN; i++) expect(y[i]).toBeCloseTo(x[i], 5);
    });
});

describe("binary frames", () => {
    it("round-trip, also from an unaligned view", () => {
        const spec = Float32Array.from({ length: DPDF_BINS * 2 }, rand);
        const buf = encodeFrame(42, spec);
        expect(decodeFrame(buf)!.seq).toBe(42);
        expect(Array.from(decodeFrame(buf)!.spec)).toEqual(Array.from(spec));
        const padded = new Uint8Array(buf.byteLength + 3);
        padded.set(new Uint8Array(buf), 3);
        const view = new Uint8Array(padded.buffer, 3, buf.byteLength);
        expect(decodeFrame(view)!.seq).toBe(42);
        expect(decodeFrame(new ArrayBuffer(10))).toBeNull();
        expect(decodeFrame("x")).toBeNull();
    });
});

/** Runs a framer against a fake backend that answers each frame with the
 *  noisy spectrum from DPDF_MODEL_LAG frames earlier (an "identity model"
 *  with the real model's lag), `answerAfter` render blocks later (null:
 *  never). */
function run(
    seconds: number,
    opts: {
        answerAfter: number | null;
        attenuationDb?: number;
        slack?: number;
        maxSlack?: number;
    },
) {
    const sent: { seq: number; spec: Float32Array }[] = [];
    const pending: { due: number; buf: ArrayBuffer }[] = [];
    const framer = new DpdfnetFramer(
        (buf: ArrayBuffer) => {
            const f = decodeFrame(buf)!;
            sent[f.seq] = f;
            if (opts.answerAfter === null) return;
            const src =
                sent[f.seq - DPDF_MODEL_LAG]?.spec ??
                new Float32Array(DPDF_BINS * 2);
            pending.push({
                due: block + opts.answerAfter,
                buf: encodeFrame(f.seq, src),
            });
        },
        {
            attenuationDb: opts.attenuationDb ?? 100,
            slack: opts.slack,
            maxSlack: opts.maxSlack,
        },
    );
    const n = Math.round(seconds * 48000);
    const input = Float32Array.from({ length: n }, () => 0.3 * rand());
    const out = new Float32Array(n);
    const dry = new Float32Array(n);
    let block = 0;
    for (let i = 0; i < n; i += 128, block++) {
        while (pending.length && pending[0].due <= block)
            framer.receive(pending.shift()!.buf);
        const o = new Float32Array(128);
        const d = new Float32Array(128);
        framer.process(o, d, input.subarray(i, i + 128));
        out.set(o.subarray(0, Math.min(128, n - i)), i);
        dry.set(d.subarray(0, Math.min(128, n - i)), i);
    }
    return { framer, input, out, dry };
}

describe("DpdfnetFramer", () => {
    it("reconstructs the input exactly, lined up with the dry output", () => {
        const { framer, input, out, dry } = run(1, { answerAfter: 0 });
        const delay = framer.delay;
        expect(delay).toBe(DPDF_WIN + 2 * DPDF_HOP + DPDF_MODEL_LAG * DPDF_HOP);
        expect(framer.stats().misses).toBe(0);
        for (let i = delay + DPDF_WIN; i < input.length; i++) {
            expect(out[i]).toBeCloseTo(input[i - delay], 4);
            expect(dry[i]).toBeCloseTo(input[i - delay], 6);
        }
        // Silence, not garbage, before the first frame is out.
        for (let i = 0; i < DPDF_WIN + 2 * DPDF_HOP; i++)
            expect(out[i]).toBe(0);
    });

    it("hides a backend that answers within the slack", () => {
        // 7 blocks = 18.7 ms, under the 2-frame (20 ms) slack.
        const { framer } = run(2, { answerAfter: 7 });
        expect(framer.stats().misses).toBe(0);
        expect(framer.stats().slack).toBe(2);
    });

    it("widens the slack for a slower backend, then stops missing", () => {
        // 15 blocks = 40 ms: a slack of 4-5 frames, depending on block phase.
        const { framer, input, out } = run(4, { answerAfter: 15 });
        const s = framer.stats();
        expect(s.slack).toBeGreaterThanOrEqual(4);
        expect(s.slack).toBeLessThanOrEqual(6);
        const missesBefore = s.misses;
        expect(missesBefore).toBeGreaterThan(0);
        // Once widened, the tail is a clean copy at the new delay.
        const delay = framer.delay;
        for (let i = input.length - 48000; i < input.length; i++)
            expect(out[i]).toBeCloseTo(input[i - delay], 4);
    });

    it("conceals a silent backend at the attenuation cap, never louder", () => {
        const { framer, out, dry } = run(1, {
            answerAfter: null,
            attenuationDb: 25,
            maxSlack: 3,
        });
        expect(framer.stats().slack).toBe(3);
        expect(framer.stats().skipped).toBeGreaterThan(0);
        let eOut = 0;
        let eDry = 0;
        for (let i = 24000; i < out.length; i++) {
            eOut += out[i] ** 2;
            eDry += dry[i] ** 2;
        }
        expect(10 * Math.log10(eOut / eDry)).toBeCloseTo(-25, 0);
    });

    it("ignores answers for frames already played or never sent", () => {
        const framer = new DpdfnetFramer(() => {}, {});
        framer.receive(encodeFrame(5, new Float32Array(DPDF_BINS * 2)));
        expect(framer.stats().late).toBe(1);
    });
});
