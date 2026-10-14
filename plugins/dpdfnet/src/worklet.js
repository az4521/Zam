// @ts-nocheck: an AudioWorklet module (registerProcessor and
// AudioWorkletProcessor only exist in AudioWorkletGlobalScope); the core is
// plain JS so tests and the worklet run the same code.
//
// DPDFNet's audio-thread half. The model itself runs elsewhere (a Worker,
// or the desktop app's native host; see backend.ts):
// a model call takes a few milliseconds, far too long for the audio thread,
// which has to hand back every 128-sample block on time. This side does the
// cheap, time-critical work:
//
//   - frames the mic into 20 ms Vorbis windows every 10 ms (DPDF_WIN/HOP),
//     the model's STFT, and sends each spectrum to the backend port as a
//     binary frame (encodeFrame);
//   - plays the enhanced spectra back through the inverse STFT. The backend
//     answers asynchronously, so output runs `slack` frames behind input to
//     give it time. When an answer is late anyway the frame is concealed
//     (the last frame's per-bin gains applied to this frame's noisy
//     spectrum) instead of dropping out, and repeated misses widen the slack
//     one frame at a time, up to maxSlack;
//   - caps the attenuation the way Ceva's reference does: alpha * noisy +
//     (1 - alpha) * enhanced, the noisy spectrum taken DPDF_MODEL_LAG frames
//     back to line up with the model's output;
//   - outputs, on its second output, the dry input delayed to line up with
//     the enhanced output (the pause gate's reference).
//
// Output delay: the window (DPDF_WIN) plus the model's own lag
// (DPDF_MODEL_LAG frames) plus `slack` frames.

export const DPDF_SAMPLE_RATE = 48000;
export const DPDF_WIN = 960;
export const DPDF_HOP = 480;
export const DPDF_BINS = DPDF_WIN / 2 + 1;
/** The model's output for a frame describes the input DPDF_MODEL_LAG frames
 *  earlier (measured: 40 ms, and Ceva aligns its attenuation cap by it). */
export const DPDF_MODEL_LAG = 4;
/** Bytes in one binary frame: int32 sequence number, then DPDF_BINS complex
 *  values as interleaved float32 re, im (the model's [1, 1, 481, 2]). */
export const DPDF_FRAME_BYTES = 4 + DPDF_BINS * 2 * 4;

export function encodeFrame(seq, spec) {
    const buf = new ArrayBuffer(DPDF_FRAME_BYTES);
    new DataView(buf).setInt32(0, seq, true);
    new Float32Array(buf, 4, DPDF_BINS * 2).set(spec);
    return buf;
}

/** { seq, spec } from a binary frame (ArrayBuffer or a typed-array view of
 *  one), or null if it isn't one. */
export function decodeFrame(data) {
    let buf = data;
    let off = 0;
    if (ArrayBuffer.isView(data)) {
        buf = data.buffer;
        off = data.byteOffset;
        if (data.byteLength !== DPDF_FRAME_BYTES) return null;
    } else if (
        !(data instanceof ArrayBuffer) ||
        data.byteLength !== DPDF_FRAME_BYTES
    ) {
        return null;
    }
    const seq = new DataView(buf, off, 4).getInt32(0, true);
    // Copy: the view's offset need not be 4-aligned.
    const spec = new Float32Array(DPDF_BINS * 2);
    spec.set(new Float32Array(buf.slice(off + 4, off + DPDF_FRAME_BYTES)));
    return { seq, spec };
}

export function vorbisWindow(n) {
    const w = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const s = Math.sin((0.5 * Math.PI * (i + 0.5)) / (n / 2));
        w[i] = Math.sin(0.5 * Math.PI * s * s);
    }
    return w;
}

/** Complex FFT for sizes made of the factors 2, 3, 4 and 5 (960 = 4*4*4*3*5):
 *  a Stockham autosort, one generic radix-p pass per factor. */
export class ComplexFFT {
    constructor(n) {
        const factors = [];
        let m = n;
        for (const p of [4, 2, 3, 5])
            while (m % p === 0) {
                factors.push(p);
                m /= p;
            }
        if (m !== 1)
            throw new Error(`FFT size ${n} has a factor other than 2, 3, 5`);
        this.n = n;
        this.factors = factors;
        this.bufRe = new Float64Array(n);
        this.bufIm = new Float64Array(n);
        // Per pass: twiddles exp(-2 pi i j r / len) for j < len/p, r < p.
        this.tw = [];
        let len = n;
        for (const p of factors) {
            const mm = len / p;
            const re = new Float64Array(mm * p);
            const im = new Float64Array(mm * p);
            for (let j = 0; j < mm; j++)
                for (let r = 0; r < p; r++) {
                    const a = (-2 * Math.PI * j * r) / len;
                    re[j * p + r] = Math.cos(a);
                    im[j * p + r] = Math.sin(a);
                }
            this.tw.push({ re, im });
            len = mm;
        }
        // exp(-2 pi i q r / p) for the small DFTs.
        this.roots = {};
        for (const p of new Set(factors)) {
            const re = new Float64Array(p * p);
            const im = new Float64Array(p * p);
            for (let q = 0; q < p; q++)
                for (let r = 0; r < p; r++) {
                    const a = (-2 * Math.PI * ((q * r) % p)) / p;
                    re[q * p + r] = Math.cos(a);
                    im[q * p + r] = Math.sin(a);
                }
            this.roots[p] = { re, im };
        }
        this.tmpRe = new Float64Array(5);
        this.tmpIm = new Float64Array(5);
    }

    /** In-place forward transform of (re, im). */
    forward(re, im) {
        const n = this.n;
        let xr = re,
            xi = im,
            yr = this.bufRe,
            yi = this.bufIm;
        let len = n;
        let s = 1;
        const tr = this.tmpRe,
            ti = this.tmpIm;
        for (let pass = 0; pass < this.factors.length; pass++) {
            const p = this.factors[pass];
            const m = len / p;
            const tw = this.tw[pass];
            const rt = this.roots[p];
            for (let j = 0; j < m; j++) {
                for (let k = 0; k < s; k++) {
                    for (let q = 0; q < p; q++) {
                        const idx = k + s * (j + q * m);
                        tr[q] = xr[idx];
                        ti[q] = xi[idx];
                    }
                    for (let r = 0; r < p; r++) {
                        let sr = 0,
                            si = 0;
                        for (let q = 0; q < p; q++) {
                            const wr = rt.re[q * p + r],
                                wi = rt.im[q * p + r];
                            sr += tr[q] * wr - ti[q] * wi;
                            si += tr[q] * wi + ti[q] * wr;
                        }
                        const twr = tw.re[j * p + r],
                            twi = tw.im[j * p + r];
                        const out = k + s * (p * j + r);
                        yr[out] = sr * twr - si * twi;
                        yi[out] = sr * twi + si * twr;
                    }
                }
            }
            [xr, yr] = [yr, xr];
            [xi, yi] = [yi, xi];
            len = m;
            s *= p;
        }
        if (xr !== re) {
            re.set(xr);
            im.set(xi);
        }
    }
}

/** Real STFT frames to and from the model's interleaved half spectrum. */
export class RealFFT {
    constructor(n) {
        this.n = n;
        this.fft = new ComplexFFT(n);
        this.re = new Float64Array(n);
        this.im = new Float64Array(n);
    }

    /** spec (interleaved, n/2+1 bins) = rfft(x). */
    forward(x, spec) {
        const { n, re, im } = this;
        for (let i = 0; i < n; i++) {
            re[i] = x[i];
            im[i] = 0;
        }
        this.fft.forward(re, im);
        for (let k = 0; k <= n / 2; k++) {
            spec[2 * k] = re[k];
            spec[2 * k + 1] = im[k];
        }
    }

    /** x = irfft(spec) (numpy's scaling: 1/n). */
    inverse(spec, x) {
        const { n, re, im } = this;
        const h = n / 2;
        // ifft(X) = conj(fft(conj(X))) / n, with X Hermitian-extended.
        for (let k = 0; k <= h; k++) {
            re[k] = spec[2 * k];
            im[k] = -spec[2 * k + 1];
        }
        im[0] = 0;
        im[h] = 0;
        for (let k = h + 1; k < n; k++) {
            re[k] = spec[2 * (n - k)];
            im[k] = spec[2 * (n - k) + 1];
        }
        this.fft.forward(re, im);
        for (let i = 0; i < n; i++) x[i] = re[i] / n;
    }
}

const HIST = 64; // frames of spectra kept (> DPDF_MODEL_LAG + maxSlack + 2)
const IN_RING = 32768; // input samples kept (> window + delay + a block)
const OUT_RING = 32768;
/** Most slack the rings above can hold. */
export const DPDF_SLACK_LIMIT = 48;
const MISS_WINDOW = 200; // frames (2 s) over which misses are counted
const MISSES_TO_WIDEN = 3;

export class DpdfnetFramer {
    /**
     * @param send   (ArrayBuffer) => void, a binary frame for the backend
     * @param opts   { attenuationDb, slack, maxSlack }
     */
    constructor(send, opts = {}) {
        this.send = send;
        this.alpha = 10 ** (-(opts.attenuationDb ?? 100) / 20);
        this.slack = opts.slack ?? 2;
        this.slack = Math.min(this.slack, DPDF_SLACK_LIMIT);
        this.maxSlack = Math.min(
            DPDF_SLACK_LIMIT,
            Math.max(this.slack, opts.maxSlack ?? 8),
        );
        this.maxInflight = this.maxSlack + 4;
        this.fft = new RealFFT(DPDF_WIN);
        this.window = vorbisWindow(DPDF_WIN);
        this.input = new Float32Array(IN_RING); // by absolute sample index
        this.taken = 0; // input samples taken
        this.sinceFrame = 0;
        this.frame = new Float32Array(DPDF_WIN);
        this.time = new Float32Array(DPDF_WIN);
        this.noisy = Array.from(
            { length: HIST },
            () => new Float32Array(DPDF_BINS * 2),
        );
        this.result = Array.from(
            { length: HIST },
            () => new Float32Array(DPDF_BINS * 2),
        );
        this.resultSeq = new Int32Array(HIST).fill(-1);
        this.mix = new Float32Array(DPDF_BINS * 2);
        this.gains = new Float32Array(DPDF_BINS).fill(this.alpha);
        this.ola = new Float32Array(DPDF_WIN);
        this.out = new Float32Array(OUT_RING); // synthesized, by content index
        this.next = 0; // next frame to produce
        this.nextSynth = 0; // next frame to synthesize
        this.contentPos = 0; // next content sample to play
        // Silence first: the full delay of window + slack before content.
        this.gap = DPDF_WIN + this.slack * DPDF_HOP;
        this.sent = 0;
        this.received = 0;
        this.misses = 0;
        this.late = 0;
        this.skipped = 0;
        this.missLog = new Int32Array(MISSES_TO_WIDEN).fill(-1e9);
        this.missLogPos = 0;
    }

    /** Output delay in samples: content lags input by this much. */
    get delay() {
        return DPDF_WIN + this.slack * DPDF_HOP + DPDF_MODEL_LAG * DPDF_HOP;
    }

    /** A backend answer (binary frame). */
    receive(data) {
        const f = decodeFrame(data);
        if (!f) return;
        this.received++;
        if (f.seq < this.nextSynth || f.seq >= this.next) {
            this.late++;
            return;
        }
        const i = f.seq % HIST;
        this.result[i].set(f.spec);
        this.resultSeq[i] = f.seq;
    }

    /** One render block: `input` in, enhanced to `out`, aligned dry input to
     *  `dry` (either output may be null). */
    process(out, dry, input) {
        const len = out
            ? out.length
            : dry
              ? dry.length
              : input
                ? input.length
                : 128;
        for (let i = 0; i < len; i++) {
            this.input[this.taken % IN_RING] = input ? input[i] : 0;
            this.taken++;
            if (++this.sinceFrame >= DPDF_HOP && this.taken >= DPDF_WIN) {
                this.sinceFrame = 0;
                this.produce();
            }
        }
        for (let i = 0; i < len; i++) {
            let y = 0;
            let d = 0;
            if (this.gap > 0) {
                this.gap--;
            } else if (this.contentPos < this.nextSynth * DPDF_HOP) {
                y = this.out[this.contentPos % OUT_RING];
                const src = this.contentPos - DPDF_MODEL_LAG * DPDF_HOP;
                if (src >= 0) d = this.input[src % IN_RING];
                this.contentPos++;
            }
            if (out) out[i] = y;
            if (dry) dry[i] = d;
        }
    }

    produce() {
        const t = this.next++;
        const start = this.taken - DPDF_WIN;
        for (let i = 0; i < DPDF_WIN; i++)
            this.frame[i] = this.input[(start + i) % IN_RING] * this.window[i];
        const spec = this.noisy[t % HIST];
        this.fft.forward(this.frame, spec);
        this.resultSeq[t % HIST] = -1;
        if (this.sent - this.received < this.maxInflight) {
            this.sent++;
            this.send(encodeFrame(t, spec));
        } else {
            this.skipped++;
        }
        while (this.nextSynth <= t - this.slack) this.synth(this.nextSynth++);
    }

    synth(f) {
        const i = f % HIST;
        const alpha = this.alpha;
        const mix = this.mix;
        const lagF = f - DPDF_MODEL_LAG;
        const noisy = lagF >= 0 ? this.noisy[lagF % HIST] : null;
        if (this.resultSeq[i] === f) {
            const e = this.result[i];
            for (let k = 0; k < DPDF_BINS; k++) {
                const nr = noisy ? noisy[2 * k] : 0;
                const ni = noisy ? noisy[2 * k + 1] : 0;
                const er = e[2 * k],
                    ei = e[2 * k + 1];
                const mr = alpha * nr + (1 - alpha) * er;
                const mi = alpha * ni + (1 - alpha) * ei;
                mix[2 * k] = mr;
                mix[2 * k + 1] = mi;
                const nm = nr * nr + ni * ni;
                this.gains[k] =
                    nm > 1e-20
                        ? Math.min(1, Math.sqrt((mr * mr + mi * mi) / nm))
                        : alpha;
            }
        } else {
            this.misses++;
            this.missLog[this.missLogPos] = f;
            this.missLogPos = (this.missLogPos + 1) % MISSES_TO_WIDEN;
            for (let k = 0; k < DPDF_BINS; k++) {
                const g = this.gains[k];
                mix[2 * k] = noisy ? noisy[2 * k] * g : 0;
                mix[2 * k + 1] = noisy ? noisy[2 * k + 1] * g : 0;
            }
            // MISSES_TO_WIDEN misses within MISS_WINDOW frames: the backend
            // needs more time than the slack gives it.
            const oldest = this.missLog[this.missLogPos];
            if (f - oldest < MISS_WINDOW && this.slack < this.maxSlack) {
                this.slack++;
                this.gap += DPDF_HOP;
                this.missLog.fill(-1e9);
            }
        }
        this.fft.inverse(mix, this.time);
        const ola = this.ola;
        for (let n = 0; n < DPDF_WIN; n++)
            ola[n] += this.time[n] * this.window[n];
        const base = f * DPDF_HOP;
        for (let n = 0; n < DPDF_HOP; n++)
            this.out[(base + n) % OUT_RING] = ola[n];
        ola.copyWithin(0, DPDF_HOP);
        ola.fill(0, DPDF_WIN - DPDF_HOP);
    }

    stats() {
        return {
            frames: this.next,
            sent: this.sent,
            received: this.received,
            misses: this.misses,
            late: this.late,
            skipped: this.skipped,
            slack: this.slack,
        };
    }
}

if (typeof registerProcessor === "function") {
    registerProcessor(
        "zam-dpdfnet",
        class extends AudioWorkletProcessor {
            constructor(options) {
                super();
                const o = options.processorOptions ?? {};
                this.backend = null;
                this.core = new DpdfnetFramer(
                    (buf) => this.backend?.postMessage(buf),
                    o,
                );
                this.blocks = 0;
                this.port.onmessage = (e) => {
                    const m = e.data;
                    if (m instanceof ArrayBuffer || ArrayBuffer.isView(m)) {
                        // Relay mode: the main thread forwards backend answers.
                        this.core.receive(m);
                    } else if (m?.type === "backend") {
                        const port = e.ports?.[0] ?? m.port;
                        port.onmessage = (ev) => this.core.receive(ev.data);
                        this.backend = port;
                    } else if (m?.type === "relay") {
                        // The backend port couldn't be moved here: frames go
                        // to the main thread, which passes them on.
                        this.backend = this.port;
                    } else if (m?.type === "stop") {
                        if (this.backend && this.backend !== this.port) {
                            this.backend.postMessage(
                                JSON.stringify({ type: "close" }),
                            );
                            this.backend.close();
                        }
                        this.backend = null;
                    }
                };
            }
            process(inputs, outputs) {
                this.core.process(
                    outputs[0]?.[0],
                    outputs[1]?.[0],
                    inputs[0]?.[0],
                );
                // About once a second.
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
