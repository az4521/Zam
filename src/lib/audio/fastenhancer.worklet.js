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
/** The Tiny model (fastenhancer_t.bin): about a third of Base's work. */
export const FE_TINY = { c: 24, f: 128, r: 20, rf: 24, blocks: 2, heads: 4 };
/** Delay in samples from input to output. */
export const FE_DELAY = FE_HOP + (FE_FFT - FE_HOP);
/** A hop whose peak stays under this (-70 dBFS) is silence: a muted mic
 *  (exact zeros) or a quiet room. Quiet speech peaks far above it. */
export const FE_SILENCE_PEAK = 10 ** (-70 / 20);
/** Silent hops (about 0.25 s) before the network stops running; the first
 *  hop over the threshold wakes it. */
export const FE_SLEEP_HOPS = 24;

/** Decides, hop by hop, when the network can stop running. Asleep, the
 *  engine keeps the state of the last hop it ran, which was silence too, so
 *  waking needs no reset. */
export class FeSleep {
    constructor() {
        this.silentHops = 0;
    }

    /** Whether to skip the network for this hop (FE_HOP samples). */
    asleep(hop) {
        let peak = 0;
        for (let i = 0; i < FE_HOP; i++) {
            const a = Math.abs(hop[i]);
            if (a > peak) peak = a;
        }
        if (peak >= FE_SILENCE_PEAK) {
            this.silentHops = 0;
            return false;
        }
        if (this.silentHops < FE_SLEEP_HOPS) this.silentHops++;
        return this.silentHops >= FE_SLEEP_HOPS;
    }
}

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
        this.sleep = new FeSleep();
        this.zeros = new Float32Array(FE_HOP);
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
            if (this.pendingLen === FE_HOP && this.sleep.asleep(this.pending)) {
                this.pushOut(this.zeros);
                this.pendingLen = 0;
            } else if (this.pendingLen === FE_HOP) {
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

const COMPRESSION = 0.3;
const MAG_FLOOR = 1e-5;
/** Floats in a spectrum or mask: FE_FFT / 2 bins (the network drops the
 *  last), re then im. */
export const FE_SPEC = FE_FFT;
/** Bytes in a binary frame to or from the GPU worker: int32 sequence number,
 *  then FE_SPEC float32s. */
export const FE_FRAME_BYTES = 4 + FE_SPEC * 4;

/** lib.rs's STFT on its own, for when the network runs elsewhere (the GPU):
 *  `analyze` takes a hop to the compressed spectrum the network reads,
 *  `synthesize` applies the network's mask to it and overlap-adds a hop of
 *  output. Each keeps its own history, so call each once per hop, in order.
 *  Same windows, compression and scaling as the Rust engine. */
export class FeStft {
    constructor() {
        const n = FE_FFT;
        const h = FE_HOP;
        this.window = new Float64Array(n);
        for (let i = 0; i < n; i++)
            this.window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
        this.windowI = new Float64Array(n);
        for (let j = 0; j < n; j++) {
            let s = 0;
            for (let m = 0; m < n / h; m++)
                s += this.window[(j % h) + m * h] ** 2;
            this.windowI[j] = this.window[j] / s;
        }
        this.cos = new Float64Array(n / 2);
        this.sin = new Float64Array(n / 2);
        for (let i = 0; i < n / 2; i++) {
            const a = (-2 * Math.PI * i) / n;
            this.cos[i] = Math.cos(a);
            this.sin[i] = Math.sin(a);
        }
        this.re = new Float64Array(n);
        this.im = new Float64Array(n);
        this.cacheIn = new Float32Array(n - h);
        this.cacheOut = new Float64Array(n - h);
    }

    /** In-place complex FFT of (re, im); `inverse` unscaled. */
    fft(inverse) {
        const n = FE_FFT;
        const { re, im } = this;
        for (let i = 1, j = 0; i < n; i++) {
            let bit = n >> 1;
            for (; j & bit; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) {
                [re[i], re[j]] = [re[j], re[i]];
                [im[i], im[j]] = [im[j], im[i]];
            }
        }
        for (let len = 2; len <= n; len <<= 1) {
            const step = n / len;
            const half = len / 2;
            for (let i = 0; i < n; i += len) {
                for (let k = 0; k < half; k++) {
                    const wr = this.cos[k * step];
                    const wi = inverse
                        ? -this.sin[k * step]
                        : this.sin[k * step];
                    const a = i + k;
                    const b = a + half;
                    const xr = re[b] * wr - im[b] * wi;
                    const xi = re[b] * wi + im[b] * wr;
                    re[b] = re[a] - xr;
                    im[b] = im[a] - xi;
                    re[a] += xr;
                    im[a] += xi;
                }
            }
        }
    }

    /** One hop (FE_HOP samples) in, its compressed spectrum to `spec`. */
    analyze(hop, spec) {
        const keep = FE_FFT - FE_HOP;
        const nb = FE_FFT / 2;
        const { re, im, window } = this;
        for (let i = 0; i < keep; i++) re[i] = this.cacheIn[i] * window[i];
        for (let i = 0; i < FE_HOP; i++)
            re[keep + i] = hop[i] * window[keep + i];
        im.fill(0);
        this.cacheIn.set(hop.subarray(FE_HOP - keep, FE_HOP));
        this.fft(false);
        for (let k = 0; k < nb; k++) {
            const mag = Math.max(Math.hypot(re[k], im[k]), MAG_FLOOR);
            const g = mag ** (COMPRESSION - 1);
            spec[k] = re[k] * g;
            spec[nb + k] = im[k] * g;
        }
    }

    /** `mask` applied to `spec` (both as analyze lays them out), one hop
     *  of output to `out`. */
    synthesize(spec, mask, out) {
        const n = FE_FFT;
        const nb = n / 2;
        const keep = n - FE_HOP;
        const { re, im } = this;
        const up = 1 / COMPRESSION - 1;
        for (let k = 0; k < nb; k++) {
            const sr = spec[k];
            const si = spec[nb + k];
            const mr = mask[k];
            const mi = mask[nb + k];
            const yr = sr * mr - si * mi;
            const yi = sr * mi + si * mr;
            const g = Math.hypot(yr, yi) ** up;
            re[k] = yr * g;
            im[k] = yi * g;
        }
        re[nb] = 0;
        im[nb] = 0;
        for (let k = 1; k < nb; k++) {
            re[n - k] = re[k];
            im[n - k] = -im[k];
        }
        this.fft(true);
        for (let i = 0; i < n; i++) {
            let y = (re[i] / n) * this.windowI[i];
            if (i < keep) y += this.cacheOut[i];
            if (i < FE_HOP) out[i] = y;
            else this.cacheOut[i - FE_HOP] = y;
        }
    }
}

export function encodeFrame(seq, data) {
    const buf = new ArrayBuffer(FE_FRAME_BYTES);
    new DataView(buf).setInt32(0, seq, true);
    new Float32Array(buf, 4, FE_SPEC).set(data);
    return buf;
}

/** { seq, data } from a binary frame, or null if it isn't one. */
export function decodeFrame(buf) {
    if (!(buf instanceof ArrayBuffer) || buf.byteLength !== FE_FRAME_BYTES)
        return null;
    return {
        seq: new DataView(buf).getInt32(0, true),
        data: new Float32Array(buf, 4, FE_SPEC),
    };
}

const HIST = 32; // hops of spectra and masks kept (> maxSlack + a few)
const OUT_RING = 16384; // output samples kept (> (maxSlack + 2) hops)
/** Most slack the rings above can hold. */
export const FE_SLACK_LIMIT = 16;
const MISS_WINDOW = 200; // hops (2 s) over which misses are counted
const MISSES_TO_WIDEN = 3;

/**
 * FastEnhancer with the network elsewhere (a GPU worker): the hop's
 * spectrum goes out with `send` and the mask comes back through `receive`.
 * Answers are asynchronous, so output runs `slack` hops behind: a hop is
 * synthesized when the hop `slack` later is taken in. A mask that is late
 * anyway is concealed (the last mask, applied to this hop's spectrum), and
 * repeated misses widen the slack one hop at a time, up to maxSlack; past
 * that the framer reports `failed` (the backend can't keep up). With slack
 * 0 and instant answers it outputs exactly what FastEnhancerCore does.
 */
export class FeGpuFramer {
    /** @param send  (ArrayBuffer) => void, a binary frame for the backend
     *  @param opts  { slack, maxSlack } */
    constructor(send, opts = {}) {
        this.send = send;
        this.slack = Math.min(opts.slack ?? 1, FE_SLACK_LIMIT);
        this.maxSlack = Math.min(
            FE_SLACK_LIMIT,
            Math.max(this.slack, opts.maxSlack ?? 6),
        );
        this.maxInflight = this.maxSlack + 4;
        this.stft = new FeStft();
        this.sleep = new FeSleep();
        this.pending = new Float32Array(FE_HOP);
        this.pendingLen = 0;
        this.spec = Array.from(
            { length: HIST },
            () => new Float32Array(FE_SPEC),
        );
        this.mask = Array.from(
            { length: HIST },
            () => new Float32Array(FE_SPEC),
        );
        this.maskSeq = new Int32Array(HIST).fill(-1);
        this.asleep = new Uint8Array(HIST);
        this.lastMask = new Float32Array(FE_SPEC);
        this.hopOut = new Float32Array(FE_HOP);
        this.out = new Float32Array(OUT_RING);
        this.next = 0; // next hop to take in
        this.nextSynth = 0;
        this.contentPos = 0;
        // Silence first: the collection hop plus the slack.
        this.gap = (1 + this.slack) * FE_HOP;
        this.sent = 0;
        this.received = 0;
        this.misses = 0;
        this.late = 0;
        this.failed = false;
        this.missLog = new Int32Array(MISSES_TO_WIDEN).fill(-1e9);
        this.missLogPos = 0;
    }

    /** A backend answer (binary frame). */
    receive(buf) {
        const f = decodeFrame(buf);
        if (!f) return;
        this.received++;
        if (f.seq < this.nextSynth || f.seq >= this.next) {
            this.late++;
            return;
        }
        const i = f.seq % HIST;
        this.mask[i].set(f.data);
        this.maskSeq[i] = f.seq;
    }

    /** Process `input` into `output` (same length; input may be null). */
    process(input, output) {
        const len = output.length;
        for (let i = 0; i < len;) {
            const take = Math.min(FE_HOP - this.pendingLen, len - i);
            if (input)
                this.pending.set(input.subarray(i, i + take), this.pendingLen);
            else this.pending.fill(0, this.pendingLen, this.pendingLen + take);
            this.pendingLen += take;
            i += take;
            if (this.pendingLen === FE_HOP) {
                this.pendingLen = 0;
                this.produce();
            }
        }
        for (let i = 0; i < len; i++) {
            let y = 0;
            if (this.gap > 0) {
                this.gap--;
            } else if (this.contentPos < this.nextSynth * FE_HOP) {
                y = this.out[this.contentPos % OUT_RING];
                this.contentPos++;
            }
            output[i] = y;
        }
    }

    produce() {
        const t = this.next++;
        const i = t % HIST;
        this.maskSeq[i] = -1;
        this.asleep[i] = this.sleep.asleep(this.pending) ? 1 : 0;
        if (!this.asleep[i]) {
            this.stft.analyze(this.pending, this.spec[i]);
            if (this.sent - this.received < this.maxInflight) {
                this.sent++;
                this.send(encodeFrame(t, this.spec[i]));
            }
        }
        while (this.nextSynth <= t - this.slack) this.synth(this.nextSynth++);
    }

    synth(f) {
        const i = f % HIST;
        const out = this.hopOut;
        if (this.asleep[i]) {
            out.fill(0);
        } else if (this.maskSeq[i] === f) {
            this.lastMask.set(this.mask[i]);
            this.stft.synthesize(this.spec[i], this.mask[i], out);
        } else {
            this.misses++;
            this.stft.synthesize(this.spec[i], this.lastMask, out);
            this.missLog[this.missLogPos] = f;
            this.missLogPos = (this.missLogPos + 1) % MISSES_TO_WIDEN;
            const oldest = this.missLog[this.missLogPos];
            if (f - oldest < MISS_WINDOW) {
                if (this.slack < this.maxSlack) {
                    this.slack++;
                    this.gap += FE_HOP;
                    this.missLog.fill(-1e9);
                } else {
                    this.failed = true;
                }
            }
        }
        const base = f * FE_HOP;
        for (let n = 0; n < FE_HOP; n++)
            this.out[(base + n) % OUT_RING] = out[n];
    }

    stats() {
        return {
            hops: this.next,
            sent: this.sent,
            received: this.received,
            misses: this.misses,
            late: this.late,
            slack: this.slack,
        };
    }
}

if (typeof registerProcessor === "function") {
    // The GPU path: the network runs in a worker that this node is given a
    // port to ({ type: "backend" }, port transferred). Posts { type: "stats" }
    // about once a second and { type: "failed", reason } once if the backend
    // can't keep up or reports an error.
    registerProcessor(
        "zam-fastenhancer-gpu",
        class extends AudioWorkletProcessor {
            constructor(options) {
                super();
                this.backend = null;
                this.core = new FeGpuFramer(
                    (buf) => this.backend?.postMessage(buf, [buf]),
                    options.processorOptions ?? {},
                );
                this.blocks = 0;
                this.reported = false;
                this.port.onmessage = (e) => {
                    const m = e.data;
                    if (m?.type === "backend" && e.ports[0]) {
                        const port = e.ports[0];
                        port.onmessage = (ev) => {
                            if (typeof ev.data === "string") this.fail(ev.data);
                            else this.core.receive(ev.data);
                        };
                        this.backend = port;
                    } else if (m?.type === "stop") {
                        this.backend?.postMessage("close");
                        this.backend?.close();
                        this.backend = null;
                    }
                };
            }
            fail(reason) {
                if (this.reported) return;
                this.reported = true;
                this.port.postMessage({ type: "failed", reason });
            }
            process(inputs, outputs) {
                const out = outputs[0]?.[0];
                if (!out) return true;
                this.core.process(inputs[0]?.[0] ?? null, out);
                if (this.core.failed) this.fail("can't keep up");
                if (++this.blocks % 375 === 0)
                    this.port.postMessage({
                        type: "stats",
                        ...this.core.stats(),
                    });
                return true;
            }
        },
    );
}

if (typeof registerProcessor === "function") {
    registerProcessor(
        "zam-fastenhancer",
        class extends AudioWorkletProcessor {
            constructor(options) {
                super();
                const o = options.processorOptions;
                this.core = new FastEnhancerCore(
                    o.wasm,
                    o.weights,
                    o.dims ?? FE_BASE,
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
                this.core.process(input, out);
                return true;
            }
        },
    );
}
