import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { RnnoiseCore, RNNOISE_FRAME } from "./rnnoise.worklet.js";

const SR = 48000;
let seed = 1;
const rand = () =>
    ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
const wasm = readFileSync("src/lib/audio/rnnoise.wasm");

// Feed `x` in 128-sample blocks, as the audio thread does.
function run(core: InstanceType<typeof RnnoiseCore>, x: Float32Array) {
    const out = new Float32Array(x.length);
    for (let i = 0; i < x.length; i += 128) {
        const o = new Float32Array(Math.min(128, x.length - i));
        core.process(x.subarray(i, i + o.length), o);
        out.set(o, i);
    }
    return out;
}
const rms = (x: Float32Array, a: number, b: number) => {
    let s = 0;
    for (let i = a; i < b; i++) s += x[i] * x[i];
    return Math.sqrt(s / (b - a));
};

describe("RnnoiseCore", () => {
    it("delays by one frame and starts with silence", () => {
        const core = new RnnoiseCore(wasm);
        const x = new Float32Array(SR).map(() => rand() * 0.1);
        const y = run(core, x);
        for (let i = 0; i < RNNOISE_FRAME; i++) expect(y[i]).toBe(0);
        core.destroy();
    });

    it("takes steady room noise right down", () => {
        const core = new RnnoiseCore(wasm);
        const x = new Float32Array(3 * SR).map(() => rand() * 0.001);
        const y = run(core, x);
        // The last second, once it has settled.
        expect(rms(y, 2 * SR, 3 * SR)).toBeLessThan(
            rms(x, 2 * SR, 3 * SR) * 0.3,
        );
        core.destroy();
    });

    it("answers any block size the same", () => {
        const x = new Float32Array(SR).map(() => rand() * 0.05);
        const a = run(new RnnoiseCore(wasm), x);
        const core = new RnnoiseCore(wasm);
        const b = new Float32Array(x.length);
        for (let i = 0; i < x.length;) {
            const n = Math.min(1 + ((i * 7) % 300), x.length - i);
            const o = new Float32Array(n);
            core.process(x.subarray(i, i + n), o);
            b.set(o, i);
            i += n;
        }
        expect(Array.from(b)).toEqual(Array.from(a));
    });
});
