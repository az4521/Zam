/**
 * FastEnhancer with its network on the GPU: the STFT and overlap-add run on
 * the audio thread (the "zam-fastenhancer-gpu" processor in
 * fastenhancer.worklet.js) and each hop's spectrum goes to a Worker
 * ($lib/workers/fastenhancerGpu.worker) that runs the network as WGSL
 * kernels and sends the mask back. Measured on a Ryzen 5800X + RX 6000:
 * about 6% of a core across all of Electron's processes, against 15% for
 * the CPU worklet. Answers are asynchronous, so it adds one hop (10.7 ms) of
 * delay to FastEnhancer's, more if the GPU is slow to answer.
 *
 * The page keeps one Worker and starts a model on it once, checked against
 * the CPU engine's output before first use; a GPU that is missing, fails
 * that check, or later can't keep up falls back to the CPU worklet (the
 * caller's onFailure).
 */
import type {
    FeGpuWorkerEvent,
    FeGpuWorkerMessage,
} from "$lib/workers/fastenhancerGpu.worker";
import {
    fastEnhancerDims,
    fastEnhancerSupported,
    loadFastEnhancerFiles,
    loadFastEnhancerWorklet,
    type FastEnhancerModel,
} from "./fastenhancer";
import { FE_SAMPLE_RATE } from "./fastenhancer.worklet.js";

export interface FastEnhancerGpuNode {
    node: AudioWorkletNode;
    /** The GPU can't keep up or went away; called once. */
    onFailure: ((reason: string) => void) | null;
    close(): void;
}

/** Whether this browser has WebGPU at all (a GPU may still be missing). */
export function fastEnhancerGpuSupported(): boolean {
    return (
        fastEnhancerSupported() &&
        typeof navigator !== "undefined" &&
        "gpu" in navigator
    );
}

let worker: Worker | null = null;
const engines = new Map<FastEnhancerModel, Promise<void>>();

function getWorker(): Worker {
    if (!worker) {
        worker = new Worker(
            new URL("../workers/fastenhancerGpu.worker.ts", import.meta.url),
            { type: "module" },
        );
        worker.addEventListener("error", (e) =>
            console.warn("FastEnhancer GPU worker:", e.message),
        );
    }
    return worker;
}

/** Starts `model` on the GPU, once per page (again after a failure). */
function startEngine(model: FastEnhancerModel): Promise<void> {
    let p = engines.get(model);
    if (p) return p;
    p = loadFastEnhancerFiles(model).then(
        ([wasm, weights]) =>
            new Promise<void>((resolve, reject) => {
                const w = getWorker();
                const onMessage = (e: MessageEvent<FeGpuWorkerEvent>) => {
                    if (e.data.model !== model) return;
                    w.removeEventListener("message", onMessage);
                    if (e.data.type === "engine-ready") {
                        console.info(
                            `FastEnhancer (${model}) on the GPU: ${e.data.detail}, ` +
                                `${e.data.snrDb.toFixed(0)} dB against the CPU engine`,
                        );
                        resolve();
                    } else {
                        reject(new Error(e.data.message));
                    }
                };
                w.addEventListener("message", onMessage);
                w.postMessage({
                    type: "engine",
                    model,
                    wasm,
                    weights,
                    dims: fastEnhancerDims(model),
                } satisfies FeGpuWorkerMessage);
            }),
    );
    engines.set(model, p);
    p.catch(() => {
        if (engines.get(model) === p) engines.delete(model);
    });
    return p;
}

/** Starts `model` on the GPU ahead of a call (shaders, weights, the
 *  self-test); false where it can't run. */
export function prepareFastEnhancerGpu(
    model: FastEnhancerModel,
): Promise<boolean> {
    if (!fastEnhancerGpuSupported()) return Promise.resolve(false);
    return startEngine(model).then(
        () => true,
        () => false,
    );
}

export async function createFastEnhancerGpuNode(
    ctx: AudioContext,
    model: FastEnhancerModel,
): Promise<FastEnhancerGpuNode> {
    if (!fastEnhancerGpuSupported()) throw new Error("no WebGPU here");
    if (ctx.sampleRate !== FE_SAMPLE_RATE)
        throw new Error(`FastEnhancer needs 48 kHz, got ${ctx.sampleRate}`);
    await Promise.all([loadFastEnhancerWorklet(ctx), startEngine(model)]);
    const node = new AudioWorkletNode(ctx, "zam-fastenhancer-gpu", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: "explicit",
        outputChannelCount: [1],
        processorOptions: { slack: 1, maxSlack: 6 },
    });
    const ch = new MessageChannel();
    getWorker().postMessage(
        { type: "connect", model } satisfies FeGpuWorkerMessage,
        [ch.port1],
    );
    node.port.postMessage({ type: "backend" }, [ch.port2]);
    let closed = false;
    const res: FastEnhancerGpuNode = {
        node,
        onFailure: null,
        close() {
            if (closed) return;
            closed = true;
            node.port.postMessage({ type: "stop" });
            node.port.onmessage = null;
            node.disconnect();
        },
    };
    node.port.onmessage = (e) => {
        if (e.data?.type === "failed") {
            // A lost GPU: start the model again for the next chain.
            engines.delete(model);
            const cb = res.onFailure;
            res.onFailure = null;
            cb?.(String(e.data.reason));
        }
    };
    return res;
}
