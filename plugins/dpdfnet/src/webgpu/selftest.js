// A known answer for the WebGPU backend: before its first use a device runs
// SELFTEST_FRAMES synthetic frames through the model and compares the last
// SELFTEST_CHECK outputs with what ONNX Runtime gave for the same frames at
// build time (assets/selftest.bin, written by build.mjs). A GPU driver that
// miscompiles a kernel gets caught here instead of mangling a call.
// Plain JS so the build script can share it.

export const SELFTEST_FRAMES = 32;
export const SELFTEST_CHECK = 8;
/** Least signal-to-error ratio that passes; a correct GPU gives over 100. */
export const SELFTEST_MIN_SNR_DB = 60;

const BINS = 481;

/**
 * Frame t of the test input: voiced, speech-like harmonics over noise, the
 * pitch gliding and the voice pausing now and then, at the levels a 48 kHz
 * mic's spectrum has. Deterministic, the same in Node and every browser.
 * @param {number} t
 * @returns {Float32Array} 481 bins, re/im interleaved
 */
export function selftestFrame(t) {
    let seed = (t * 7919 + 1234) >>> 0;
    const rand = () => {
        seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
        return seed / 4294967296;
    };
    const out = new Float32Array(BINS * 2);
    const voiced = t % 16 < 11;
    const f0Bins = (130 + 40 * Math.sin(t / 5)) / 50;
    for (let k = 0; k < BINS; k++) {
        let amp = 0.2 * (0.5 + rand());
        if (voiced) {
            const h = Math.round(k / f0Bins);
            if (h >= 1 && Math.abs(k - h * f0Bins) < 0.75) amp += 30 / h;
        }
        const phase = rand() * 2 * Math.PI;
        out[2 * k] = amp * Math.cos(phase);
        out[2 * k + 1] = amp * Math.sin(phase);
    }
    return out;
}

/**
 * Signal-to-error ratio, in dB, of `got` against `want`.
 * @param {ArrayLike<number>} want
 * @param {ArrayLike<number>} got
 */
export function snrDb(want, got) {
    let s = 0;
    let e = 0;
    for (let i = 0; i < want.length; i++) {
        s += want[i] * want[i];
        e += (got[i] - want[i]) ** 2;
    }
    if (!(e === e) || !(s === s)) return -Infinity;
    return 10 * Math.log10(s / Math.max(e, 1e-30));
}
