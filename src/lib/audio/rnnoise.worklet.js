// @ts-nocheck: an AudioWorklet module (registerProcessor and
// AudioWorkletProcessor only exist in AudioWorkletGlobalScope); the core is
// plain JS so tests and the worklet run the same code.
//
// RNNoise 0.2 (Xiph's recurrent noise suppressor, BSD-3-Clause; rnnoise.wasm
// is Jitsi's build of it, Apache-2.0, taken from @jitsi/rnnoise-wasm 0.2.1's
// rnnoise-sync.js: its plain rnnoise.wasm is the older 0.1) as Zam's default noise suppression. It
// works on 10 ms frames of 48 kHz audio and has no lookahead, so output runs
// one frame (RNNOISE_FRAME samples) behind the input. It was picked over
// DeepFilterNet3 because it keeps a voice at one level: measured 2026-10-29
// on TTS speech in room noise, DeepFilterNet3 dips the voice by 8-13 dB for
// stretches of 10-30 ms inside words (5 dB standard deviation, a jump over
// 3 dB every 7 frames), where RNNoise holds it within 1 dB.

export const RNNOISE_FRAME = 480; // 10 ms at 48 kHz
/** RNNoise takes and gives 16-bit-range floats. */
const SCALE = 32768;

export class RnnoiseCore {
    /** @param wasm bytes or a compiled module of rnnoise.wasm */
    constructor(wasm) {
        const module =
            wasm instanceof WebAssembly.Module
                ? wasm
                : new WebAssembly.Module(wasm);
        let x = null;
        const heap = () => new Uint8Array(x.c.buffer);
        const instance = new WebAssembly.Instance(module, {
            a: {
                // emscripten_resize_heap: never grow, the memory it starts
                // with is plenty for one RNNoise state.
                a: () => 0,
                // emscripten_memcpy_big
                b: (dest, src, n) => heap().copyWithin(dest, src, src + n),
            },
        });
        x = instance.exports;
        // The minified export names are emscripten's: c memory, d
        // __wasm_call_ctors, e malloc, f free, g rnnoise_init, h
        // rnnoise_create, i rnnoise_destroy, j rnnoise_process_frame.
        this.x = x;
        x.d();
        this.state = x.h(0);
        if (!this.state) throw new Error("RNNoise can't start");
        this.inPtr = x.e(RNNOISE_FRAME * 4);
        this.outPtr = x.e(RNNOISE_FRAME * 4);
        this.pending = new Float32Array(RNNOISE_FRAME);
        this.pendingLen = 0;
        // Processed output waiting to go out; starts one frame deep (the
        // delay).
        this.out = new Float32Array(RNNOISE_FRAME * 4);
        this.outStart = 0;
        this.outLen = RNNOISE_FRAME;
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
        const n = RNNOISE_FRAME;
        for (let i = 0; i < input.length;) {
            const take = Math.min(n - this.pendingLen, input.length - i);
            this.pending.set(input.subarray(i, i + take), this.pendingLen);
            this.pendingLen += take;
            i += take;
            if (this.pendingLen === n) {
                const buf = this.x.c.buffer;
                const inp = new Float32Array(buf, this.inPtr, n);
                for (let k = 0; k < n; k++) inp[k] = this.pending[k] * SCALE;
                this.x.j(this.state, this.outPtr, this.inPtr);
                const res = new Float32Array(buf, this.outPtr, n);
                const frame = new Float32Array(n);
                for (let k = 0; k < n; k++) frame[k] = res[k] / SCALE;
                this.pushOut(frame);
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
        this.x.i(this.state);
        this.x.f(this.inPtr);
        this.x.f(this.outPtr);
    }
}

if (typeof registerProcessor === "function") {
    registerProcessor(
        "zam-rnnoise",
        class extends AudioWorkletProcessor {
            constructor(options) {
                super();
                this.core = new RnnoiseCore(options.processorOptions.wasm);
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
