/**
 * Zam's processing for the user's own microphone, used by the call (as a
 * LiveKit audio processor, $lib/audio/micProcessor) and by the settings mic
 * test, so what you hear in the test is what the call sends:
 *
 *   input -> [DeepFilterNet3] -> [leveller gain] -> soft clipper -> output
 *
 * The leveller evens out your voice in place of the browser's WebRTC AGC:
 * digital only (it never moves the OS microphone volume), it holds its gain
 * through pauses instead of pumping room noise up between sentences, and it
 * turns down fast but up slowly. Same maths as incoming-voice normalization.
 * It measures after DeepFilterNet, so it levels your voice, not the noise.
 *
 * DeepFilterNet3 loads asynchronously (a large wasm, fetched on first use):
 * until it is ready, and if it fails, audio passes through unfiltered.
 */
import {
    rmsDb,
    nextSpeechLevel,
    normalizationGain,
    gainTimeConstant,
} from "./voiceNormalization";
import { createSoftClipper } from "./softClip";
import { createDeepFilterNode } from "./deepFilter";

const LEVELLER_TICK_MS = 50;

export interface MicChainOptions {
    denoise: boolean;
    level: boolean;
}

export interface MicChain {
    /** Connect the mic source here. */
    input: AudioNode;
    /** Processed audio comes out here. */
    output: AudioNode;
    /** Resolves once DeepFilterNet3 is in the path (true) or has failed or
     *  wasn't asked for (false). */
    denoiseReady: Promise<boolean>;
    destroy(): void;
}

export function createMicChain(
    ctx: AudioContext,
    opts: MicChainOptions,
): MicChain {
    const input = ctx.createGain();
    const gain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    const clipper = createSoftClipper(ctx);
    input.connect(gain);
    input.connect(analyser);
    gain.connect(clipper.input);

    let destroyed = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    if (opts.level) {
        const buf = new Float32Array(analyser.fftSize);
        let level: number | null = null;
        timer = setInterval(() => {
            analyser.getFloatTimeDomainData(buf);
            level = nextSpeechLevel(level, rmsDb(buf));
            const target = normalizationGain(level);
            if (target === null) return;
            gain.gain.setTargetAtTime(
                target,
                ctx.currentTime,
                gainTimeConstant(gain.gain.value, target),
            );
        }, LEVELLER_TICK_MS);
    }

    let dfNode: AudioWorkletNode | null = null;
    const denoiseReady = opts.denoise
        ? createDeepFilterNode(ctx).then(
              (node) => {
                  if (destroyed) {
                      node.disconnect();
                      return false;
                  }
                  // Splice it in: input -> df -> (gain, analyser).
                  dfNode = node;
                  input.disconnect();
                  input.connect(node);
                  node.connect(gain);
                  node.connect(analyser);
                  return true;
              },
              (err) => {
                  console.warn("DeepFilterNet3 unavailable:", err);
                  return false;
              },
          )
        : Promise.resolve(false);

    return {
        input,
        output: clipper.output,
        denoiseReady,
        destroy() {
            if (destroyed) return;
            destroyed = true;
            if (timer !== null) clearInterval(timer);
            input.disconnect();
            dfNode?.disconnect();
            // The worklet keeps its wasm state until the processor is
            // collected; tell it to stop work in the meantime.
            dfNode?.port.postMessage({ type: "setEnabled", value: false });
            gain.disconnect();
            clipper.output.disconnect();
        },
    };
}
