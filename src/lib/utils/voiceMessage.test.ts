import { describe, it, expect, vi, afterEach } from "vitest";
import { computeWaveform, pickAudioMimeType } from "./voiceMessage";

describe("computeWaveform", () => {
    it("returns [] for non-positive bars", () => {
        expect(computeWaveform(new Float32Array([1, 1]), 0)).toEqual([]);
        expect(computeWaveform(new Float32Array([1, 1]), -3)).toEqual([]);
    });
    it("returns `bars` zeros for silence", () => {
        const w = computeWaveform(new Float32Array(100), 30);
        expect(w.length).toBe(30);
        expect(w.every((v) => v === 0)).toBe(true);
    });
    it("maps a full-scale constant to ~1024", () => {
        const loud = new Float32Array(100).fill(1);
        const w = computeWaveform(loud, 16);
        expect(w.length).toBe(16);
        expect(w.every((v) => v === 1024)).toBe(true);
    });
    it("keeps all values within 0..1024 as integers", () => {
        const sig = Float32Array.from({ length: 500 }, (_, i) =>
            Math.sin(i / 3),
        );
        const w = computeWaveform(sig, 40);
        expect(w.length).toBe(40);
        for (const v of w) {
            expect(Number.isInteger(v)).toBe(true);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(1024);
        }
    });
    it("pads with zero buckets when bars exceed samples", () => {
        const w = computeWaveform(new Float32Array([1, 1, 1]), 10);
        expect(w.length).toBe(10);
        expect(w.slice(3).every((v) => v === 0)).toBe(true);
    });
});

describe("pickAudioMimeType", () => {
    const original = (globalThis as any).MediaRecorder;
    afterEach(() => {
        (globalThis as any).MediaRecorder = original;
    });
    it("returns '' when MediaRecorder is unavailable", () => {
        (globalThis as any).MediaRecorder = undefined;
        expect(pickAudioMimeType()).toBe("");
    });
    it("returns the first supported type in preference order", () => {
        (globalThis as any).MediaRecorder = {
            isTypeSupported: (t: string) => t === "audio/ogg;codecs=opus",
        };
        expect(pickAudioMimeType()).toBe("audio/ogg;codecs=opus");
    });
});
