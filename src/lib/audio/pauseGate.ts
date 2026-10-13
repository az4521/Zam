/**
 * Loads the pause gate (pauseGate.worklet.js) into an AudioContext. Input 0
 * takes DeepFilterNet3's output, input 1 its input delayed by the model's
 * delay; see the worklet for how it decides.
 */
// no-inline: a data: URL worklet module could be refused by a CSP.
import pauseGateUrl from "./pauseGate.worklet.js?url&no-inline";
import { GATE_DELAY } from "./pauseGate.worklet.js";

/** Extra delay the gate adds (its lookahead), in seconds at 48 kHz. */
export const PAUSE_GATE_DELAY_S = GATE_DELAY / 48000;

const loaded = new WeakMap<BaseAudioContext, Promise<void>>();

export async function createPauseGateNode(
    ctx: BaseAudioContext,
): Promise<AudioWorkletNode> {
    let ready = loaded.get(ctx);
    if (!ready) {
        ready = ctx.audioWorklet.addModule(pauseGateUrl);
        loaded.set(ctx, ready);
        ready.catch(() => loaded.delete(ctx));
    }
    await ready;
    return new AudioWorkletNode(ctx, "zam-pause-gate", {
        numberOfInputs: 2,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: "explicit",
        outputChannelCount: [1],
    });
}
