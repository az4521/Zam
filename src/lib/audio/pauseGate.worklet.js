// @ts-nocheck: an AudioWorklet module (registerProcessor and
// AudioWorkletProcessor only exist in AudioWorkletGlobalScope); the core is
// plain JS so tests and the worklet run the same code.
//
// Pause gate after the noise model (DPDFNet or DeepFilterNet3; tuned on
// DeepFilterNet3, and measured 2026-10-13 to carry over to DPDFNet unchanged:
// on 54 real-speech clips it took DPDFNet's DNSMOS background score from 3.46
// to 3.90 and PESQ from 2.65 to 2.70 without moving the speech score).
// The model's attenuation is capped
// (DEEP_FILTER_ATTENUATION_DB) because unlimited suppression muffled speech,
// but then clicks, keys and room noise in pauses only lose that much, and
// anything turning the voice up afterwards turns them up too. This gate adds
// GATE_PAUSE_DB in pauses only.
//
// Input 0 is the model's output, input 1 the model's input delayed to line
// up with it, both at the mic's own level. Speech is judged over a window of
// GATE_WINDOW_FRAMES 10 ms frames, energy-weighted so the voice's loud parts
// count most, and needs both:
//  - the model kept most of it (removed under GATE_KEEP_DB). It takes far
//    more off clicks and keys (~20 dB, measured), so a loud click can't open
//    the gate the way a level threshold would let it.
//  - it stands GATE_ABOVE_FLOOR_DB over the model output's noise floor. With
//    faint room noise the model also trims speech by up to ~10 dB, so the
//    first test alone let much of the noise through (17% of noise frames).
// Noise still passes both now and then for a single frame, so the gate only
// opens on GATE_MIN_RUN speech frames in a row (measured: one stray frame,
// held open for the hang time, kept the gate open through ~46% of pauses).
// It looks GATE_LOOKAHEAD_FRAMES ahead, on top of the window's own reach, so
// that run is found before the word starts; output is delayed by GATE_DELAY
// to make room. The gate stays open GATE_HANG_FRAMES after speech.

export const GATE_FRAME = 480; // 10 ms at 48 kHz
export const GATE_WINDOW_FRAMES = 5; // centred: two frames either side
const HALF = (GATE_WINDOW_FRAMES - 1) / 2;
export const GATE_MIN_RUN = 3;
export const GATE_LOOKAHEAD_FRAMES = 1;
/** A frame is decided once the frames after it in its window are in (and
 *  the one being filled isn't), plus the lookahead: output waits that long. */
export const GATE_DELAY = (HALF + 1 + GATE_LOOKAHEAD_FRAMES) * GATE_FRAME;
export const GATE_KEEP_DB = 12;
export const GATE_ABOVE_FLOOR_DB = 15;
/** Model output quieter than this is never speech. */
export const GATE_MIN_DB = -70;
export const GATE_HANG_FRAMES = 20;
export const GATE_PAUSE_DB = 20;
/** Output noise floor follower, per frame: falls fast, rises over ~12 s. */
const FLOOR_FALL = 0.3;
const FLOOR_RISE = 0.01 / 12;
/** Gain smoothing: open within ~2 ms, close over ~30 ms. */
const OPEN_TAU_SAMPLES = 0.002 * 48000;
const CLOSE_TAU_SAMPLES = 0.03 * 48000;

const HISTORY = 64; // frames kept (> window + hang)
const toDb = (energy) => 10 * Math.log10(energy + 1e-20);

export class PauseGateCore {
    constructor() {
        this.closedGain = 10 ** (-GATE_PAUSE_DB / 20);
        this.openCoef = 1 - Math.exp(-1 / OPEN_TAU_SAMPLES);
        this.closeCoef = 1 - Math.exp(-1 / CLOSE_TAU_SAMPLES);
        this.delay = new Float32Array(GATE_DELAY + GATE_FRAME);
        this.frameIn = new Float64Array(HISTORY);
        this.frameOut = new Float64Array(HISTORY);
        this.speech = new Uint8Array(HISTORY);
        this.n = 0; // samples taken in
        this.eOut = 0;
        this.eIn = 0;
        this.fill = 0;
        this.complete = 0; // frames measured
        this.decided = 0; // frames judged (complete - HALF)
        this.floor = null;
        this.target = this.closedGain;
        this.targetFrame = -1;
        this.gain = this.closedGain;
    }

    /** Was frame `f` speech? */
    isSpeech(f) {
        return f >= 0 && f < this.decided && this.speech[f % HISTORY] === 1;
    }

    /** Judge frame `d` from the window around it (all measured). */
    decide(d) {
        let eIn = 0;
        let eOut = 0;
        let n = 0;
        for (let k = d - HALF; k <= d + HALF; k++) {
            if (k < 0) continue;
            eIn += this.frameIn[k % HISTORY];
            eOut += this.frameOut[k % HISTORY];
            n++;
        }
        const outDb = toDb(eOut / (n * GATE_FRAME));
        const removed = toDb(eIn) - toDb(eOut);
        const floor = this.floor;
        this.floor =
            floor === null
                ? outDb
                : floor +
                  (outDb < floor ? FLOOR_FALL : FLOOR_RISE) * (outDb - floor);
        this.speech[d % HISTORY] =
            floor !== null &&
            outDb >= GATE_MIN_DB &&
            outDb >= floor + GATE_ABOVE_FLOOR_DB &&
            removed < GATE_KEEP_DB
                ? 1
                : 0;
    }

    /** Open while a run of GATE_MIN_RUN speech frames ends anywhere from
     *  GATE_HANG_FRAMES back to the lookahead. */
    targetFor(f) {
        let run = 0;
        for (
            let k = f - GATE_HANG_FRAMES - GATE_MIN_RUN + 1;
            k <= f + GATE_LOOKAHEAD_FRAMES;
            k++
        ) {
            run = this.isSpeech(k) ? run + 1 : 0;
            if (run >= GATE_MIN_RUN && k >= f - GATE_HANG_FRAMES) return 1;
        }
        return this.closedGain;
    }

    /** Fill `out` from `modelOut` (and `modelIn`, for the decisions). */
    process(out, modelOut, modelIn) {
        const len = out.length;
        const size = this.delay.length;
        for (let i = 0; i < len; i++) {
            const x = modelOut ? modelOut[i] : 0;
            const r = modelIn ? modelIn[i] : 0;
            this.eOut += x * x;
            this.eIn += r * r;
            if (++this.fill === GATE_FRAME) {
                this.frameIn[this.complete % HISTORY] = this.eIn;
                this.frameOut[this.complete % HISTORY] = this.eOut;
                this.complete++;
                this.eOut = this.eIn = 0;
                this.fill = 0;
                if (this.complete > HALF) this.decide(this.decided++);
            }
            this.delay[this.n % size] = x;
            const p = this.n - GATE_DELAY; // the sample leaving now
            let y = 0;
            if (p >= 0) {
                const f = Math.floor(p / GATE_FRAME);
                if (f !== this.targetFrame) {
                    this.targetFrame = f;
                    this.target = this.targetFor(f);
                }
                const coef =
                    this.target > this.gain ? this.openCoef : this.closeCoef;
                this.gain += (this.target - this.gain) * coef;
                y = this.delay[p % size] * this.gain;
            }
            out[i] = y;
            this.n++;
        }
    }
}

if (typeof registerProcessor === "function") {
    registerProcessor(
        "zam-pause-gate",
        class extends AudioWorkletProcessor {
            constructor() {
                super();
                this.core = new PauseGateCore();
            }
            process(inputs, outputs) {
                const out = outputs[0]?.[0];
                if (out) this.core.process(out, inputs[0]?.[0], inputs[1]?.[0]);
                return true;
            }
        },
    );
}
