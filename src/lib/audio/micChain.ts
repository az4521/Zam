/**
 * Zam's processing for the user's own microphone, used by the call (as a
 * LiveKit audio processor, $lib/audio/micProcessor) and by the settings mic
 * test, so what you hear in the test is what the call sends:
 *
 *   input -> [drive -> DeepFilterNet3 -> undo drive] -> [leveller gain]
 *         -> soft clipper -> output
 *
 * DeepFilterNet3 mangles speech it hears as quiet ($lib/audio/deepFilterDrive),
 * so the drive lifts a quiet mic into the model's range and the same gain
 * comes off after it: the chain's output level is what it was, the model just
 * gets a signal it can work with.
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
import {
    createDriveState,
    DEEP_FILTER_DELAY_S,
    DRIVE_GLIDE_S,
    driveTick,
    undriveCurve,
} from "./deepFilterDrive";

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
    const drive = ctx.createGain();
    const undrive = ctx.createGain();
    let driveTimer: ReturnType<typeof setInterval> | null = null;

    // Drive follows the speech level (driveTick) in steps. Each step is a linear ramp,
    // and the cut after the model is its exact inverse, landing after the
    // model's delay, so the chain's output level never moves with it.
    const startDrive = () => {
        const driveAnalyser = ctx.createAnalyser();
        driveAnalyser.fftSize = 2048;
        input.connect(driveAnalyser);
        const buf = new Float32Array(driveAnalyser.fftSize);
        const state = createDriveState();
        let current = 1;
        let busyUntil = 0;
        driveTimer = setInterval(() => {
            driveAnalyser.getFloatTimeDomainData(buf);
            const next = driveTick(state, rmsDb(buf), current);
            const now = ctx.currentTime;
            // One step at a time: a value curve can't overlap other events.
            if (now < busyUntil) return;
            if (next === null) return;
            drive.gain.setValueAtTime(current, now);
            drive.gain.linearRampToValueAtTime(next, now + DRIVE_GLIDE_S);
            undrive.gain.setValueCurveAtTime(
                undriveCurve(current, next),
                now + DEEP_FILTER_DELAY_S,
                DRIVE_GLIDE_S,
            );
            current = next;
            busyUntil = now + DEEP_FILTER_DELAY_S + DRIVE_GLIDE_S;
        }, LEVELLER_TICK_MS);
    };

    const denoiseReady = opts.denoise
        ? createDeepFilterNode(ctx).then(
              (node) => {
                  if (destroyed) {
                      node.disconnect();
                      return false;
                  }
                  // Splice it in:
                  // input -> drive -> df -> undrive -> (gain, analyser).
                  dfNode = node;
                  input.disconnect();
                  input.connect(drive);
                  drive.connect(node);
                  node.connect(undrive);
                  undrive.connect(gain);
                  undrive.connect(analyser);
                  startDrive();
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
            if (driveTimer !== null) clearInterval(driveTimer);
            input.disconnect();
            drive.disconnect();
            dfNode?.disconnect();
            undrive.disconnect();
            // The worklet keeps its wasm state until the processor is
            // collected; tell it to stop work in the meantime.
            dfNode?.port.postMessage({ type: "setEnabled", value: false });
            gain.disconnect();
            clipper.output.disconnect();
        },
    };
}
