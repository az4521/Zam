import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { FastEnhancerCore, FE_HOP, FE_DELAY } from "./fastenhancer.worklet.js";

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
});
