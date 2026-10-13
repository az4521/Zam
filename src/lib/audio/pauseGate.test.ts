import { describe, it, expect } from "vitest";
import {
    PauseGateCore,
    GATE_DELAY,
    GATE_FRAME,
    GATE_PAUSE_DB,
} from "./pauseGate.worklet.js";

const SR = 48000;
let seed = 1;
const rand = () =>
    ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;

// Feed the gate in 128-sample blocks; `model(i)` gives [modelOut, modelIn].
function run(seconds: number, model: (i: number) => [number, number]) {
    const core = new PauseGateCore();
    const n = Math.round(seconds * SR);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i += 128) {
        const o = new Float32Array(128);
        const a = new Float32Array(128);
        const b = new Float32Array(128);
        for (let k = 0; k < 128; k++) [a[k], b[k]] = model(i + k);
        core.process(o, a, b);
        out.set(o.subarray(0, Math.min(128, n - i)), i);
    }
    return out;
}
const rms = (x: Float32Array, from: number, to: number) => {
    let s = 0;
    for (let i = from; i < to; i++) s += x[i] * x[i];
    return Math.sqrt(s / (to - from));
};
const at = (s: number) => Math.round(s * SR) + GATE_DELAY;

// The model's input: room noise at -50 dBFS, speech (a loud tone) from 2 s
// to 3 s. The model keeps speech and takes 18 dB off the noise.
const noise = (i: number) => rand() * 0.0055;
const speaking = (i: number) => i >= 2 * SR && i < 3 * SR;
const voice = (i: number) => 0.1 * Math.sin((i * 2 * Math.PI * 220) / SR);
const model = (i: number): [number, number] => {
    const n = noise(i);
    const v = speaking(i) ? voice(i) : 0;
    return [v + n * 0.125, v + n];
};

describe("PauseGateCore", () => {
    it("passes speech untouched and quietens the pauses around it", () => {
        seed = 1;
        const out = run(5, model);
        const speech = rms(out, at(2.2), at(2.8));
        expect(20 * Math.log10(speech / (0.1 / Math.SQRT2))).toBeGreaterThan(
            -0.5,
        );
        // Pause well after the hang time: the model's residue, a further
        // GATE_PAUSE_DB down.
        const pause = rms(out, at(3.6), at(4.6));
        const residue = 0.0055 * 0.125 * Math.sqrt(1 / 3);
        expect(20 * Math.log10(pause / residue)).toBeLessThan(
            -GATE_PAUSE_DB + 1,
        );
    });

    it("is open when a word starts, thanks to the lookahead", () => {
        seed = 1;
        const out = run(3, model);
        // First 10 ms of the word.
        const onset = rms(out, at(2), at(2) + GATE_FRAME);
        expect(20 * Math.log10(onset / (0.1 / Math.SQRT2))).toBeGreaterThan(-3);
    });

    it("stays shut for a click the model mostly removed", () => {
        seed = 1;
        const click = (i: number) =>
            i >= 4 * SR && i < 4 * SR + 300 ? rand() * 0.5 : 0;
        const out = run(5, (i) => {
            const n = noise(i);
            const c = click(i);
            return [n * 0.125 + c * 0.05, n + c]; // the model took 26 dB off it
        });
        const around = rms(out, at(4) - GATE_FRAME, at(4) + 3 * GATE_FRAME);
        const ungated = 0.5 * Math.sqrt(1 / 3) * 0.05 * Math.sqrt(300 / 1920);
        expect(around).toBeLessThan(ungated * 0.2);
    });

    it("outputs silence for silence", () => {
        const out = run(1, () => [0, 0]);
        expect(rms(out, 0, out.length)).toBe(0);
    });
});
