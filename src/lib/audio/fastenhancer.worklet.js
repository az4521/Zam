// @ts-nocheck: an AudioWorklet module (registerProcessor and
// AudioWorkletProcessor only exist in AudioWorkletGlobalScope); the core is
// plain JS so tests and the worklet run the same code.
//
// FastEnhancer (Ahn et al., MIT; github.com/aask1357/fastenhancer), Zam's
// default noise suppression: a 100 K-parameter streaming network that takes
// 48 kHz audio in hops of FE_HOP samples (10.7 ms) and holds a voice at one
// level, where DeepFilterNet3 and DPDFNet dip it by 8-13 dB for stretches
// inside words (measured 2026-10-29 on TTS speech in room noise: 5 dB level
// standard deviation, against about 1 dB here).
//
// The network runs in fastenhancer.wasm (scripts/fastenhancer/src/lib.rs, a
// hand port to wasm SIMD that matches ONNX Runtime to better than 100 dB), so
// there is no ONNX runtime in the app. Output lags the input by two hops: one
// to collect a hop, one for the 1024-sample STFT window.

export const FE_SAMPLE_RATE = 48000;
export const FE_HOP = 512;
export const FE_FFT = 1024;
/** Network sizes of the shipped Base model; the order fe_create takes. */
export const FE_BASE = { c: 48, f: 128, r: 36, rf: 36, blocks: 3, heads: 4 };
/** Delay in samples from input to output. */
export const FE_DELAY = FE_HOP + (FE_FFT - FE_HOP);

export class FastEnhancerCore {
    /** @param wasm  fastenhancer.wasm (bytes or a compiled module)
     *  @param weights  the flat float32 file, as bytes (ArrayBuffer) */
    constructor(wasm, weights, dims = FE_BASE) {
        const module =
            wasm instanceof WebAssembly.Module
                ? wasm
                : new WebAssembly.Module(wasm);
        const x = new WebAssembly.Instance(module, {}).exports;
        this.x = x;
        const n = weights.byteLength / 4;
        const ptr = x.fe_weights(n);
        new Uint8Array(x.memory.buffer, ptr, weights.byteLength).set(
            new Uint8Array(weights),
        );
        const d = dims;
        this.eng = x.fe_create(
            d.c,
            d.f,
            d.r,
            d.rf,
            d.blocks,
            d.heads,
            FE_FFT,
            FE_HOP,
        );
        if (!this.eng) throw new Error("FastEnhancer: weights don't fit");
        this.pending = new Float32Array(FE_HOP);
        this.pendingLen = 0;
        // Processed output waiting to go out; starts one hop deep (the
        // collection delay).
        this.out = new Float32Array(FE_HOP * 4);
        this.outStart = 0;
        this.outLen = FE_HOP;
    }

    pushOut(samples) {
        if (this.outStart + this.outLen + samples.length > this.out.length) {
            const bigger = new Float32Array(
                Math.max(this.out.length, (this.outLen + samples.length) * 2),
            );
            bigger.set(
                this.out.subarray(this.outStart, this.outStart + this.outLen),
            );
            this.out = bigger;
            this.outStart = 0;
        }
        this.out.set(samples, this.outStart + this.outLen);
        this.outLen += samples.length;
    }

    /** Process `input` into `output` (same length; any length). */
    process(input, output) {
        for (let i = 0; i < input.length;) {
            const take = Math.min(FE_HOP - this.pendingLen, input.length - i);
            this.pending.set(input.subarray(i, i + take), this.pendingLen);
            this.pendingLen += take;
            i += take;
            if (this.pendingLen === FE_HOP) {
                const buf = this.x.memory.buffer;
                new Float32Array(buf, this.x.fe_input(this.eng), FE_HOP).set(
                    this.pending,
                );
                this.x.fe_process(this.eng);
                this.pushOut(
                    new Float32Array(
                        this.x.memory.buffer,
                        this.x.fe_output(this.eng),
                        FE_HOP,
                    ),
                );
                this.pendingLen = 0;
            }
        }
        const len = Math.min(output.length, this.outLen);
        output.set(this.out.subarray(this.outStart, this.outStart + len));
        output.fill(0, len);
        this.outStart += len;
        this.outLen -= len;
        if (this.outLen === 0) this.outStart = 0;
    }

    destroy() {
        this.x.fe_destroy(this.eng);
    }
}

if (typeof registerProcessor === "function") {
    registerProcessor(
        "zam-fastenhancer",
        class extends AudioWorkletProcessor {
            constructor(options) {
                super();
                const o = options.processorOptions;
                this.core = new FastEnhancerCore(o.wasm, o.weights);
                this.silence = new Float32Array(128);
            }
            process(inputs, outputs) {
                const out = outputs[0]?.[0];
                if (!out) return true;
                let input = inputs[0]?.[0];
                if (!input) {
                    if (this.silence.length !== out.length)
                        this.silence = new Float32Array(out.length);
                    input = this.silence;
                }
                this.core.process(input, out);
                return true;
            }
        },
    );
}
