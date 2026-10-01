/**
 * Sound-bank MIDI rendering (spessasynth_core, in a worker). Which bank plays
 * is the user's choice (settingsState.midiSoundBank, Settings > Messages &
 * media):
 *
 * - "system": the OS's own bank, desktop app only (electron/main.cjs reads
 *   it): gm.dls on Windows, i.e. the Microsoft GS Wavetable Synth's sounds;
 *   Apple's gs_instruments.dls on macOS; a distro SoundFont on Linux.
 * - "bundled": the SoundFont shipped at BUNDLED_SOUND_BANK_URL (see
 *   static/soundfonts/README.md).
 * - "custom": an SF2/SF3/DLS the user picked, kept in IndexedDB
 *   (./customSoundBank.ts).
 *
 * A choice that can't be met (no system bank, no stored custom one) falls
 * back to the bundled bank. With no bank at all, renderMidiWithSoundBank
 * resolves null and the caller uses the WebAudio oscillator synth in
 * ./midi.ts.
 */
import type {
    MidiRenderRequest,
    MidiRenderResponse,
} from "$lib/workers/midiRender.worker";
import { settingsState } from "$lib/stores/settings.svelte";
import type { MidiSoundBankChoice } from "./midiSoundBankChoice";
import { getStoredSoundBank, isRiff } from "./customSoundBank";

/** Built by scripts/build-soundfont.mjs (SF3 with Opus samples). */
export const BUNDLED_SOUND_BANK_URL = "/soundfonts/default.sf3";

interface SoundBank {
    key: string;
    data: ArrayBuffer;
}

/** Whether the OS has a bank to offer (desktop app only). */
export async function hasSystemSoundBank(): Promise<boolean> {
    try {
        return (await window.desktop?.hasSystemSoundBank?.()) === true;
    } catch {
        return false;
    }
}

async function systemBank(): Promise<SoundBank | null> {
    try {
        const system = await window.desktop?.readSystemSoundBank?.();
        if (system && system.byteLength > 0) {
            // Copy out of the IPC buffer so the worker can take ownership.
            const data = system.slice().buffer;
            if (isRiff(data)) return { key: "system", data };
        }
    } catch {
        // bridge missing or read failed
    }
    return null;
}

async function customBank(): Promise<SoundBank | null> {
    const rec = await getStoredSoundBank();
    if (!rec || !isRiff(rec.data)) return null;
    return { key: `custom:${rec.storedAt}`, data: rec.data };
}

async function bundledBank(): Promise<SoundBank | null> {
    try {
        const res = await fetch(BUNDLED_SOUND_BANK_URL);
        if (res.ok) {
            const data = await res.arrayBuffer();
            // A missing static file can come back as the SPA's index.html
            // with a 200, which must not be handed to the loader.
            if (isRiff(data)) return { key: "bundled", data };
        }
    } catch {
        // offline or not shipped
    }
    return null;
}

async function findSoundBank(
    choice: MidiSoundBankChoice,
): Promise<SoundBank | null> {
    const preferred =
        choice === "system"
            ? await systemBank()
            : choice === "custom"
              ? await customBank()
              : null;
    return preferred ?? (await bundledBank());
}

/** The bank found for `choice`; its key is null when there is none. */
let found: { choice: MidiSoundBankChoice; key: Promise<string | null> } | null =
    null;

/** Forget the bank found so far, e.g. after the custom one is replaced. */
export function resetSoundBank(): void {
    found = null;
    pending = null;
}

let worker: Worker | null = null;
let pending: SoundBank | null = null;
let nextId = 0;
const waiting = new Map<
    number,
    { resolve: (wav: ArrayBuffer) => void; reject: (err: Error) => void }
>();

function getWorker(): Worker {
    if (worker) return worker;
    worker = new Worker(
        new URL("../workers/midiRender.worker.ts", import.meta.url),
        { type: "module" },
    );
    worker.onmessage = (e: MessageEvent<MidiRenderResponse>) => {
        const job = waiting.get(e.data.id);
        if (!job) return;
        waiting.delete(e.data.id);
        if ("wav" in e.data) job.resolve(e.data.wav);
        else job.reject(new Error(e.data.error));
    };
    worker.onerror = () => {
        // A crashed worker loses its loaded bank: start over next time.
        for (const job of waiting.values()) {
            job.reject(new Error("MIDI render worker failed"));
        }
        waiting.clear();
        worker?.terminate();
        worker = null;
        found = null;
    };
    return worker;
}

/**
 * Render MIDI bytes to a WAV blob with the best available sound bank, or
 * resolve null when there is none. Rejects if rendering itself fails.
 */
export async function renderMidiWithSoundBank(
    midi: ArrayBuffer,
): Promise<Blob | null> {
    // Found once per choice; the bytes go to the worker with the first job
    // and stay parsed there.
    const choice = settingsState.midiSoundBank;
    if (found?.choice !== choice) {
        const search = findSoundBank(choice).then((bank) => {
            // A newer search (the choice changed meanwhile) owns `pending`.
            if (found?.key === search) pending = bank;
            return bank?.key ?? null;
        });
        found = { choice, key: search };
    }
    const key = await found.key;
    if (!key) return null;

    const w = getWorker();
    const id = nextId++;
    const request: MidiRenderRequest = { id, midi, bankKey: key };
    const transfer: Transferable[] = [midi];
    if (pending) {
        request.bank = pending;
        transfer.push(pending.data);
        pending = null;
    }
    const wav = await new Promise<ArrayBuffer>((resolve, reject) => {
        waiting.set(id, { resolve, reject });
        w.postMessage(request, transfer);
    });
    return new Blob([wav], { type: "audio/wav" });
}
