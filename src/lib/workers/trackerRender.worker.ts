/// <reference lib="webworker" />
/**
 * Renders a tracker module (MOD, XM, S3M, IT and the rest libopenmpt reads)
 * to WAV. libopenmpt is compiled to WebAssembly by chiptune3, whose build
 * inlines the wasm into the one JS module, so there is no separate asset to
 * fetch. Runs in a worker because a long module is seconds of mixing that
 * would otherwise freeze the UI. Driven by $lib/utils/tracker.ts.
 */
import createLibopenmpt from "chiptune3/libopenmpt.worklet.js";

export interface TrackerRenderRequest {
    id: number;
    module: ArrayBuffer;
}

export type TrackerRenderResponse =
    { id: number; wav: ArrayBuffer } | { id: number; error: string };

const SAMPLE_RATE = 44100;
const CHUNK_FRAMES = 8192;
/** Same bound as MIDI rendering: past this the WAV gets unreasonably big. */
const MAX_SECONDS = 15 * 60;

let lib: ReturnType<typeof createLibopenmpt> | null = null;

async function render(data: ArrayBuffer): Promise<ArrayBuffer> {
    const m = await (lib ??= createLibopenmpt());
    const bytes = new Uint8Array(data);
    const filePtr = m._malloc(bytes.length);
    m.HEAPU8.set(bytes, filePtr);
    // The module copies what it needs out of the file while loading.
    const mod = m._openmpt_module_create_from_memory(
        filePtr,
        bytes.length,
        0,
        0,
        0,
    );
    m._free(filePtr);
    if (!mod) throw new Error("Not a module libopenmpt can play");

    const buf = m._malloc(CHUNK_FRAMES * 4);
    const parts: Uint8Array[] = [];
    let frames = 0;
    try {
        // Play the song once: modules that loop back on themselves would
        // otherwise render forever.
        m._openmpt_module_set_repeat_count(mod, 0);
        while (frames < MAX_SECONDS * SAMPLE_RATE) {
            const n = m._openmpt_module_read_interleaved_stereo(
                mod,
                SAMPLE_RATE,
                CHUNK_FRAMES,
                buf,
            );
            if (n === 0) break;
            // Interleaved little-endian int16 is already WAV's data layout.
            // HEAPU8 is re-read each time: memory growth replaces it.
            parts.push(m.HEAPU8.slice(buf, buf + n * 4));
            frames += n;
        }
    } finally {
        m._free(buf);
        m._openmpt_module_destroy(mod);
    }
    if (frames === 0) throw new Error("Module rendered no audio");
    return wav(parts, frames * 4);
}

function wav(parts: Uint8Array[], dataBytes: number): ArrayBuffer {
    const out = new Uint8Array(44 + dataBytes);
    const dv = new DataView(out.buffer);
    const str = (at: number, s: string) => {
        for (let i = 0; i < s.length; i++) out[at + i] = s.charCodeAt(i);
    };
    str(0, "RIFF");
    dv.setUint32(4, 36 + dataBytes, true);
    str(8, "WAVE");
    str(12, "fmt ");
    dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true); // PCM
    dv.setUint16(22, 2, true);
    dv.setUint32(24, SAMPLE_RATE, true);
    dv.setUint32(28, SAMPLE_RATE * 4, true);
    dv.setUint16(32, 4, true);
    dv.setUint16(34, 16, true);
    str(36, "data");
    dv.setUint32(40, dataBytes, true);
    let at = 44;
    for (const p of parts) {
        out.set(p, at);
        at += p.length;
    }
    return out.buffer;
}

self.onmessage = async (e: MessageEvent<TrackerRenderRequest>) => {
    const { id, module } = e.data;
    try {
        const wavBuf = await render(module);
        const res: TrackerRenderResponse = { id, wav: wavBuf };
        self.postMessage(res, [wavBuf]);
    } catch (err) {
        const res: TrackerRenderResponse = {
            id,
            error: err instanceof Error ? err.message : String(err),
        };
        self.postMessage(res);
    }
};
