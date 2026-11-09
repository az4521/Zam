/// <reference lib="webworker" />
/**
 * Decodes a sound bank's compressed Opus samples for the real-time MIDI
 * player (utils/midiStream.ts). AudioWorkletGlobalScope has no AudioDecoder,
 * so the decode happens here; the PCM then goes to the worklet alongside the
 * bank bytes, which the worklet parses itself.
 */
import { SoundBankLoader } from "spessasynth_core";
import { decodeBankOpusSamples } from "$lib/utils/opusSample";
import type {
    BankPrepRequest,
    BankPrepResponse,
    DecodedSample,
} from "./midiPlayer.messages";

const scope = self as DedicatedWorkerGlobalScope;

scope.onmessage = async (e: MessageEvent<BankPrepRequest>) => {
    try {
        const bank = SoundBankLoader.fromArrayBuffer(e.data.bank);
        const samples: DecodedSample[] = await decodeBankOpusSamples(
            bank.samples,
        );
        scope.postMessage({ samples } satisfies BankPrepResponse, {
            transfer: samples.map((s) => s.pcm.buffer),
        });
    } catch (err) {
        scope.postMessage({
            error: err instanceof Error ? err.message : String(err),
        } satisfies BankPrepResponse);
    }
};
