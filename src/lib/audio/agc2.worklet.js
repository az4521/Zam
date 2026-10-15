// @ts-nocheck: an AudioWorklet module (registerProcessor and
// AudioWorkletProcessor only exist in AudioWorkletGlobalScope); the core is
// plain JS so tests and the worklet run the same code.
//
// Auto gain control for the user's own mic: WebRTC's AGC2, the adaptive
// digital controller and limiter from Chromium's WebRTC audio processing
// (scripts/agc2/zam_agc2.cc, built to agc2.wasm). It replaced Zam's own
// leveller, which cut the gain on every loud syllable within ~150 ms and
// crept back up over seconds, so voices pumped. AGC2 instead:
//  - only learns the speech level from frames its RNN voice detector is sure
//    are speech (and needs 12 in a row before it trusts the estimate),
//  - moves the gain at most 6 dB a second, and never lifts it so far that
//    the noise floor would come out above -50 dBFS,
//  - leaves peaks to its limiter rather than ducking the whole voice.
// It is digital only: it never touches the OS microphone volume.
//
// AGC2 works on 10 ms frames, so output runs one frame (AGC2_FRAME_MS)
// behind the input.

export const AGC2_FRAME_MS = 10;

/** AGC2's defaults (AudioProcessing::Config::GainController2). */
export const AGC2_DEFAULTS = {
    headroomDb: 5,
    maxGainDb: 50,
    initialGainDb: 15,
    maxGainChangeDbPerSecond: 6,
    maxOutputNoiseLevelDbfs: -50,
};

/** Instantiate agc2.wasm (bytes or a compiled module) synchronously and set
 *  up one controller for mono audio at `sampleRate`. */
export function createAgc2(wasm, sampleRate, config = AGC2_DEFAULTS) {
    const module =
        wasm instanceof WebAssembly.Module
            ? wasm
            : new WebAssembly.Module(wasm);
    const instance = new WebAssembly.Instance(module, {
        env: { emscripten_notify_memory_growth: () => {} },
    });
    const x = instance.exports;
    x._initialize();
    const c = { ...AGC2_DEFAULTS, ...config };
    const agc = x.agc_create(
        sampleRate,
        c.headroomDb,
        c.maxGainDb,
        c.initialGainDb,
        c.maxGainChangeDbPerSecond,
        c.maxOutputNoiseLevelDbfs,
    );
    if (!agc) throw new Error(`AGC2 can't run at ${sampleRate} Hz`);
    const n = Math.round((sampleRate * AGC2_FRAME_MS) / 1000);
    const framePtr = x.agc_frame(agc);
    // Input waiting for a full frame, and processed output waiting to go out
    // (starts one frame deep: that's the delay).
    const pending = new Float32Array(n);
    let pendingLen = 0;
    let out = new Float32Array(n * 4);
    let outStart = 0;
    let outLen = n;
    const view = () => new Float32Array(x.memory.buffer, framePtr, n);

    function pushOut(samples) {
        if (outStart + outLen + samples.length > out.length) {
            const bigger = new Float32Array(
                Math.max(out.length, (outLen + samples.length) * 2),
            );
            bigger.set(out.subarray(outStart, outStart + outLen));
            out = bigger;
            outStart = 0;
        }
        out.set(samples, outStart + outLen);
        outLen += samples.length;
    }

    return {
        frameSamples: n,
        get speechProbability() {
            return x.agc_speech_probability(agc);
        },
        get gainDb() {
            return x.agc_gain_db(agc);
        },
        /** Process `input` into `output` (same length; any length). */
        process(input, output) {
            for (let i = 0; i < input.length;) {
                const take = Math.min(n - pendingLen, input.length - i);
                pending.set(input.subarray(i, i + take), pendingLen);
                pendingLen += take;
                i += take;
                if (pendingLen === n) {
                    view().set(pending);
                    x.agc_process(agc);
                    pushOut(view());
                    pendingLen = 0;
                }
            }
            const len = Math.min(output.length, outLen);
            output.set(out.subarray(outStart, outStart + len));
            output.fill(0, len);
            outStart += len;
            outLen -= len;
            if (outLen === 0) outStart = 0;
        },
        destroy() {
            x.agc_destroy(agc);
        },
    };
}

if (typeof registerProcessor === "function") {
    registerProcessor(
        "zam-agc2",
        class extends AudioWorkletProcessor {
            constructor(options) {
                super();
                this.agc = createAgc2(
                    options.processorOptions.wasm,
                    sampleRate,
                    options.processorOptions.config,
                );
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
                this.agc.process(input, out);
                return true;
            }
        },
    );
}
