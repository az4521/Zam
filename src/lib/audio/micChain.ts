/**
 * Zam's processing for the user's own microphone, used by the call (as a
 * LiveKit audio processor, $lib/audio/micProcessor) and by the settings mic
 * test, so what you hear in the test is what the call sends. With
 * DeepFilterNet3:
 *
 *   input -> [drive -> DeepFilterNet3 -> undo drive -> pause gate]
 *         -> [AGC2] -> soft clipper -> output
 *
 * or with a plugin's noise filter ($lib/audio/micFilters):
 *
 *   input -> [plugin filter -> pause gate] -> [AGC2] -> soft clipper -> output
 *
 * DeepFilterNet3 mangles speech it hears as quiet ($lib/audio/deepFilterDrive),
 * so the drive lifts a quiet mic into the model's range and the same gain
 * comes off after it: the chain's output level is what it was, the model just
 * gets a signal it can work with. A plugin filter gets the mic as it is
 * (it handles level itself). The pause gate ($lib/audio/pauseGate) then
 * quietens what the model leaves of clicks, keys and room noise between
 * words; a plugin filter gets it only if it outputs its dry input lined up
 * with its output (MicFilterInstance.dryOutput).
 *
 * AGC2 ($lib/audio/agc2) evens out your voice: WebRTC's adaptive digital
 * gain controller and limiter, the same code the browser's AGC runs after
 * noise suppression, minus the part that moves the OS microphone volume. It
 * replaced Zam's own leveller, which ducked every loud word by several dB
 * and crept back up over seconds.
 *
 * The models load asynchronously: until one is ready, and if all fail, audio
 * passes through unfiltered. A plugin filter that isn't loaded, can't
 * start on this device, or stops coping mid-stream is swapped for
 * DeepFilterNet3 in place.
 */
import { rmsDb } from "./voiceNormalization";
import { createAgc2Node } from "./agc2";
import { createSoftClipper } from "./softClip";
import { createDeepFilterNode } from "./deepFilter";
import {
    findMicFilter,
    micFilterUsable,
    type PluginFilterKey,
} from "./micFilters";
import type { MicFilterInstance } from "$lib/plugins/types";
import { createPauseGateNode } from "./pauseGate";
import {
    createDriveState,
    DEEP_FILTER_DELAY_S,
    DRIVE_GLIDE_S,
    driveTick,
    undriveCurve,
} from "./deepFilterDrive";

const DRIVE_TICK_MS = 50;

/** Which noise model the chain runs: DeepFilterNet3, or a plugin's filter
 *  (falling back to DeepFilterNet3 wherever it can't run). */
export type DenoiseEngine = "deepfilter" | PluginFilterKey;

export interface MicChainOptions {
    denoise: DenoiseEngine | null;
    level: boolean;
}

export interface MicChain {
    /** Connect the mic source here. */
    input: AudioNode;
    /** Processed audio comes out here. */
    output: AudioNode;
    /** Resolves once a noise model is in the path (to the one that is), or
     *  to null when none could start or none was asked for. */
    denoiseReady: Promise<DenoiseEngine | null>;
    /** The noise model in the path right now (null: none, or not yet). */
    readonly engine: DenoiseEngine | null;
    destroy(): void;
}

export function createMicChain(
    ctx: AudioContext,
    opts: MicChainOptions,
): MicChain {
    const input = ctx.createGain();
    // Where the noise model's output meets AGC2 (or the clipper, until AGC2
    // has loaded or when it's off).
    const gain = ctx.createGain();
    const clipper = createSoftClipper(ctx);
    input.connect(gain);
    gain.connect(clipper.input);

    let destroyed = false;
    let agcNode: AudioWorkletNode | null = null;
    if (opts.level) {
        createAgc2Node(ctx).then(
            (node) => {
                if (destroyed) return;
                agcNode = node;
                gain.disconnect();
                gain.connect(node);
                node.connect(clipper.input);
            },
            (err) => console.warn("AGC2 unavailable:", err),
        );
    }

    let dfNode: AudioWorkletNode | null = null;
    let gateNode: AudioWorkletNode | null = null;
    let plug: MicFilterInstance | null = null;
    let engine: DenoiseEngine | null = null;
    // The model's input, lined up with its output for the gate's decisions.
    const gateRef = ctx.createDelay(0.2);
    gateRef.delayTime.value = DEEP_FILTER_DELAY_S;
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
        }, DRIVE_TICK_MS);
    };

    // Without the gate the model still runs, just ungated.
    const makeGate = () =>
        createPauseGateNode(ctx).catch((err) => {
            console.warn("Pause gate unavailable:", err);
            return null;
        });

    /** Take the plugin filter out of the path (once something else is in
     *  it). */
    const dropPlugin = () => {
        if (!plug) return;
        const p = plug;
        plug = null;
        p.onFailure = null;
        p.node.disconnect();
        try {
            p.close();
        } catch (err) {
            console.warn("Noise filter plugin close failed:", err);
        }
    };

    const spliceDeepFilter = (): Promise<DenoiseEngine | null> =>
        Promise.all([createDeepFilterNode(ctx), makeGate()]).then(
            ([node, gate]) => {
                if (destroyed) {
                    node.disconnect();
                    gate?.disconnect();
                    return null;
                }
                // Splice it in: input -> drive -> df -> undrive ->
                // [gate, with input -> delay as its reference] -> gain.
                const oldGate = gateNode;
                dfNode = node;
                gateNode = gate;
                input.disconnect();
                input.connect(drive);
                drive.connect(node);
                node.connect(undrive);
                const out: AudioNode = gate ?? undrive;
                if (gate) {
                    undrive.connect(gate, 0, 0);
                    input.connect(gateRef);
                    gateRef.connect(gate, 0, 1);
                }
                out.connect(gain);
                oldGate?.disconnect();
                dropPlugin();
                startDrive();
                engine = "deepfilter";
                return engine;
            },
            (err) => {
                console.warn("DeepFilterNet3 unavailable:", err);
                return null;
            },
        );

    const splicePlugin = (
        key: PluginFilterKey,
    ): Promise<DenoiseEngine | null> => {
        const filter = findMicFilter(key);
        if (!filter || !micFilterUsable(filter)) {
            if (!filter)
                console.info(
                    `Noise filter ${key} isn't loaded: DeepFilterNet3`,
                );
            return spliceDeepFilter();
        }
        return Promise.all([filter.create(ctx), makeGate()]).then(
            ([inst, gate]) => {
                if (destroyed) {
                    inst.node.disconnect();
                    inst.close();
                    gate?.disconnect();
                    return null;
                }
                // input -> filter -> [gate, with the filter's lined-up dry
                // output as its reference] -> gain.
                plug = inst;
                const dry = inst.dryOutput;
                const gated = gate && dry !== undefined ? gate : null;
                gateNode = gated;
                if (gate && !gated) gate.disconnect();
                input.disconnect();
                input.connect(inst.node);
                if (gated) {
                    inst.node.connect(gated, 0, 0);
                    inst.node.connect(gated, dry!, 1);
                    gated.connect(gain);
                } else {
                    inst.node.connect(gain, 0);
                }
                engine = key;
                // Stopped coping: DeepFilterNet3 takes over; the filter
                // carries on until it is in.
                inst.onFailure = (reason) => {
                    console.warn(
                        `Noise filter ${key} failed (${reason}): DeepFilterNet3`,
                    );
                    if (!destroyed && plug === inst) void spliceDeepFilter();
                };
                return engine;
            },
            (err) => {
                console.info(`Noise filter ${key} can't run here:`, err);
                return destroyed ? null : spliceDeepFilter();
            },
        );
    };

    const denoiseReady: Promise<DenoiseEngine | null> =
        opts.denoise === "deepfilter"
            ? spliceDeepFilter()
            : opts.denoise
              ? splicePlugin(opts.denoise)
              : Promise.resolve(null);

    return {
        input,
        output: clipper.output,
        denoiseReady,
        get engine() {
            return engine;
        },
        destroy() {
            if (destroyed) return;
            destroyed = true;
            if (driveTimer !== null) clearInterval(driveTimer);
            input.disconnect();
            drive.disconnect();
            dfNode?.disconnect();
            undrive.disconnect();
            gateRef.disconnect();
            gateNode?.disconnect();
            dropPlugin();
            // The worklet keeps its wasm state until the processor is
            // collected; tell it to stop work in the meantime.
            dfNode?.port.postMessage({ type: "setEnabled", value: false });
            gain.disconnect();
            agcNode?.disconnect();
            clipper.output.disconnect();
        },
    };
}
