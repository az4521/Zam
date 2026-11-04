/// <reference types="@webgpu/types" />
/**
 * FastEnhancer's network on the GPU ($lib/audio/fastenhancerGpuEngine), in a
 * dedicated Worker so neither the audio thread nor the page's main thread
 * ever waits on it. One Worker serves the page: the page starts a model
 * ({ type: "engine" }), which is checked against the wasm engine's output
 * before first use, then connects a MessagePort per mic chain
 * ({ type: "connect" }), each with its own GRU state. On a port, binary
 * frames (fastenhancer.worklet.js encodeFrame) carry spectra in and masks
 * out, in order; a string is an error (the GPU went away).
 */
import {
    FE_HOP,
    FastEnhancerCore,
    FeStft,
    decodeFrame,
    encodeFrame,
} from "$lib/audio/fastenhancer.worklet.js";
import {
    FE_SPEC,
    FeGpuModel,
    type FeDims,
} from "$lib/audio/fastenhancerGpuEngine";

export type FeGpuWorkerMessage =
    | {
          type: "engine";
          model: string;
          wasm: ArrayBuffer;
          weights: ArrayBuffer;
          dims: FeDims;
      }
    | { type: "connect"; model: string };

export type FeGpuWorkerEvent =
    | { type: "engine-ready"; model: string; detail: string; snrDb: number }
    | { type: "engine-error"; model: string; message: string };

/** Hops in the self-test, and the agreement it needs with the wasm engine
 *  over the last SELFTEST_CHECK of them. */
const SELFTEST_HOPS = 96;
const SELFTEST_CHECK = 64;
const SELFTEST_MIN_SNR_DB = 50;

interface Engine {
    model: FeGpuModel;
    detail: string;
    dead: boolean;
}

const errorText = (err: unknown) =>
    err instanceof Error ? err.message : String(err);

let device: Promise<{ device: GPUDevice; detail: string }> | null = null;
const engines = new Map<string, Promise<Engine>>();
const live = new Set<Engine>();

function getDevice() {
    if (!device) {
        device = (async () => {
            const gpu = navigator.gpu;
            if (!gpu) throw new Error("no WebGPU here");
            // A laptop's integrated GPU where there is one: the work is
            // small, and this keeps a discrete GPU asleep.
            const adapter = await gpu.requestAdapter({
                powerPreference: "low-power",
            });
            if (!adapter) throw new Error("no WebGPU adapter");
            const dev = await adapter.requestDevice();
            const info = adapter.info;
            const detail =
                `${info.vendor} ${info.architecture} ${info.description}`.trim();
            dev.lost.then((l) => {
                console.warn("FastEnhancer: WebGPU device lost:", l.message);
                device = null;
                for (const e of live) e.dead = true;
                live.clear();
                engines.clear();
            });
            return { device: dev, detail };
        })();
        device.catch(() => (device = null));
    }
    return device;
}

/** A deterministic voice-like test signal. */
function testSignal(): Float32Array {
    const n = SELFTEST_HOPS * FE_HOP;
    let seed = 1;
    const rand = () =>
        ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 -
        1;
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        let s = 0;
        for (let h = 1; h <= 10; h++)
            s += Math.sin((2 * Math.PI * 140 * h * i) / 48000) / h;
        const env = 0.5 + 0.5 * Math.sin((2 * Math.PI * 2 * i) / 48000);
        x[i] = s * 0.08 * env + rand() * 0.01;
    }
    return x;
}

/** The GPU's output against the wasm engine's on the same signal, in dB. */
async function selfTest(
    model: FeGpuModel,
    m: Extract<FeGpuWorkerMessage, { type: "engine" }>,
): Promise<number> {
    const x = testSignal();
    const core = new FastEnhancerCore(m.wasm, m.weights, m.dims);
    const want = new Float32Array(x.length);
    for (let i = 0; i < x.length; i += FE_HOP)
        core.process(x.subarray(i, i + FE_HOP), want.subarray(i, i + FE_HOP));
    core.destroy();
    const stft = new FeStft();
    const specs = Array.from({ length: SELFTEST_HOPS }, (_, t) => {
        const s = new Float32Array(FE_SPEC);
        stft.analyze(x.subarray(t * FE_HOP, (t + 1) * FE_HOP), s);
        return s;
    });
    const sess = model.session();
    // Every hop in flight at once.
    const masks = await Promise.all(specs.map((s) => sess.process(s)));
    sess.destroy();
    // The core's output lags by the collection hop: hop t comes out at t + 1.
    let sig = 0;
    let err = 0;
    const out = new Float32Array(FE_HOP);
    for (let t = 0; t < SELFTEST_HOPS - 1; t++) {
        stft.synthesize(specs[t], masks[t], out);
        if (t < SELFTEST_HOPS - 1 - SELFTEST_CHECK) continue;
        const w = want.subarray((t + 1) * FE_HOP, (t + 2) * FE_HOP);
        for (let i = 0; i < FE_HOP; i++) {
            sig += w[i] * w[i];
            err += (w[i] - out[i]) ** 2;
        }
    }
    return 10 * Math.log10(sig / Math.max(err, 1e-30));
}

async function startEngine(
    m: Extract<FeGpuWorkerMessage, { type: "engine" }>,
): Promise<Engine & { snrDb: number }> {
    const { device: dev, detail } = await getDevice();
    const model = await FeGpuModel.create(
        dev,
        m.dims,
        new Float32Array(m.weights.slice(0)),
    );
    const snrDb = await selfTest(model, m);
    if (!(snrDb >= SELFTEST_MIN_SNR_DB)) {
        model.destroy();
        throw new Error(
            `self-test failed on ${detail}: ${snrDb.toFixed(1)} dB against the CPU engine`,
        );
    }
    const engine = { model, detail, dead: false, snrDb };
    live.add(engine);
    return engine;
}

function serve(port: MessagePort, enginePromise: Promise<Engine>): void {
    let sess: ReturnType<FeGpuModel["session"]> | null = null;
    let engine: Engine | null = null;
    let failed = false;
    let closed = false;
    // Answers go out in hop order.
    let last: Promise<unknown> = Promise.resolve();
    const fail = (err: unknown) => {
        if (failed || closed) return;
        failed = true;
        port.postMessage(errorText(err));
    };
    enginePromise.then((e) => {
        if (closed) return;
        engine = e;
        sess = e.model.session();
    }, fail);
    port.onmessage = (e) => {
        if (e.data === "close") {
            closed = true;
            sess?.destroy();
            sess = null;
            port.close();
            return;
        }
        const frame = decodeFrame(e.data);
        if (!frame || !sess || failed) return;
        if (engine?.dead) {
            fail("the GPU went away");
            return;
        }
        const out = sess.process(frame.data);
        const seq = frame.seq;
        last = last
            .then(() => out)
            .then((mask) => {
                if (closed) return;
                const buf = encodeFrame(seq, mask);
                port.postMessage(buf, [buf]);
            }, fail);
    };
}

self.onmessage = (e: MessageEvent<FeGpuWorkerMessage>) => {
    const m = e.data;
    if (m.type === "engine") {
        let p = engines.get(m.model);
        if (!p) {
            const started = startEngine(m);
            p = started;
            engines.set(m.model, p);
            started.catch(() => {
                if (engines.get(m.model) === started) engines.delete(m.model);
            });
        }
        p.then(
            (en) =>
                self.postMessage({
                    type: "engine-ready",
                    model: m.model,
                    detail: en.detail,
                    snrDb: (en as Engine & { snrDb: number }).snrDb,
                } satisfies FeGpuWorkerEvent),
            (err) =>
                self.postMessage({
                    type: "engine-error",
                    model: m.model,
                    message: errorText(err),
                } satisfies FeGpuWorkerEvent),
        );
    } else if (m.type === "connect" && e.ports[0]) {
        serve(
            e.ports[0],
            engines.get(m.model) ??
                Promise.reject(new Error(`${m.model} isn't started`)),
        );
    }
};
