import { describe, it, expect } from "vitest";
import {
    PcmJitterBuffer,
    PCM_START_FRAMES,
    PCM_MAX_FRAMES,
} from "./pcmStream.worklet.js";

const QUANTUM = 128;

/** Interleaved stereo frames numbered from `start`: left = n, right = -n. */
function frames(start: number, count: number): Float32Array {
    const out = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
        out[i * 2] = start + i;
        out[i * 2 + 1] = -(start + i);
    }
    return out;
}

function pull(buf: InstanceType<typeof PcmJitterBuffer>) {
    const left = new Float32Array(QUANTUM);
    const right = new Float32Array(QUANTUM);
    buf.pull(left, right);
    return { left, right };
}

describe("PcmJitterBuffer", () => {
    it("stays silent until enough audio is queued, then plays it in order", () => {
        const buf = new PcmJitterBuffer();
        buf.push(frames(1, PCM_START_FRAMES - 1));
        expect(pull(buf).left.every((v) => v === 0)).toBe(true);
        buf.push(frames(PCM_START_FRAMES, 1));
        const { left, right } = pull(buf);
        expect(left[0]).toBe(1);
        expect(left[QUANTUM - 1]).toBe(QUANTUM);
        expect(right[5]).toBe(-6);
    });

    it("plays silence on an underrun and waits to refill", () => {
        const buf = new PcmJitterBuffer();
        buf.push(frames(1, PCM_START_FRAMES));
        for (let i = 0; i < Math.floor(PCM_START_FRAMES / QUANTUM); i++) {
            pull(buf);
        }
        // Less than a quantum left: silence, and wait for a refill.
        expect(pull(buf).left.every((v) => v === 0)).toBe(true);
        expect(buf.underruns).toBe(1);
        buf.push(frames(1000, QUANTUM));
        expect(pull(buf).left.every((v) => v === 0)).toBe(true);
    });

    it("drops the oldest audio when the queue grows too long", () => {
        const buf = new PcmJitterBuffer();
        const total = PCM_MAX_FRAMES + 100;
        buf.push(frames(1, total));
        expect(buf.size).toBe(PCM_START_FRAMES);
        // What's left is the newest audio.
        expect(pull(buf).left[0]).toBe(total - PCM_START_FRAMES + 1);
    });

    it("wraps around its ring without losing samples", () => {
        const buf = new PcmJitterBuffer();
        let next = 1;
        let expected = 1;
        // Five seconds through a one-second ring, in 10 ms bursts of the
        // same rate as the 128-sample quanta pulling them out.
        for (let q = 0; q < 1875; q++) {
            if (q % 15 === 0) {
                for (let k = 0; k < 4; k++) {
                    buf.push(frames(next, 480));
                    next += 480;
                }
            }
            const { left } = pull(buf);
            if (left[0] !== 0) {
                expect(left[0]).toBe(expected);
                expected += QUANTUM;
            }
        }
        expect(expected).toBeGreaterThan(48000 * 4);
        expect(buf.dropped).toBe(0);
    });

    it("downmixes to mono when there is one output channel", () => {
        const buf = new PcmJitterBuffer();
        const stereo = new Float32Array(PCM_START_FRAMES * 2);
        for (let i = 0; i < PCM_START_FRAMES; i++) {
            stereo[i * 2] = 0.5;
            stereo[i * 2 + 1] = 0.25;
        }
        buf.push(stereo);
        const mono = new Float32Array(QUANTUM);
        buf.pull(mono, undefined);
        expect(mono[0]).toBeCloseTo(0.375);
    });
});
