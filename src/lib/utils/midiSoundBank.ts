/**
 * Sound-bank MIDI rendering (spessasynth_core, in a worker). Banks, in order:
 *
 * 1. The OS's own bank, desktop app only (electron/main.cjs reads it): gm.dls
 *    on Windows, i.e. the Microsoft GS Wavetable Synth's sounds; Apple's
 *    gs_instruments.dls on macOS; a distro SoundFont on Linux.
 * 2. A SoundFont shipped with the app at BUNDLED_SOUND_BANK_URL (see
 *    static/soundfonts/README.md). Optional: absent until one is chosen.
 *
 * With neither, renderMidiWithSoundBank resolves null and the caller uses the
 * WebAudio oscillator synth in ./midi.ts.
 */
import type {
    MidiRenderRequest,
    MidiRenderResponse,
} from "$lib/workers/midiRender.worker";

/** Built by scripts/build-soundfont.mjs (SF3 with Opus samples). */
export const BUNDLED_SOUND_BANK_URL = "/soundfonts/default.sf3";

interface SoundBank {
    key: string;
    data: ArrayBuffer;
}

/** RIFF container check: a missing static file can come back as the SPA's
 *  index.html with a 200, which must not be handed to the loader. */
function isRiff(data: ArrayBuffer): boolean {
    const b = new Uint8Array(data, 0, Math.min(4, data.byteLength));
    return String.fromCharCode(...b) === "RIFF";
}

async function findSoundBank(): Promise<SoundBank | null> {
    try {
        const system = await window.desktop?.readSystemSoundBank?.();
        if (system && system.byteLength > 0) {
            // Copy out of the IPC buffer so the worker can take ownership.
            const data = system.slice().buffer;
            if (isRiff(data)) return { key: "system", data };
        }
    } catch {
        // bridge missing or read failed: try the bundled bank
    }
    try {
        const res = await fetch(BUNDLED_SOUND_BANK_URL);
        if (res.ok) {
            const data = await res.arrayBuffer();
            if (isRiff(data)) return { key: "bundled", data };
        }
    } catch {
        // offline or not shipped
    }
    return null;
}

let bankKey: Promise<string | null> | null = null;
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
        bankKey = null;
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
    // Found once per session; the bytes go to the worker with the first job
    // and stay parsed there.
    bankKey ??= findSoundBank().then((bank) => {
        pending = bank;
        return bank?.key ?? null;
    });
    const key = await bankKey;
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
