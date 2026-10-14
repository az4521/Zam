/**
 * Tracker music playback (MOD, XM, S3M, IT and friends). Browsers can't
 * decode modules in `<audio>`, so, like MIDI (./midi.ts), the file is
 * rendered to a WAV blob with libopenmpt and the player gets that instead.
 * The rendering happens in $lib/workers/trackerRender.worker.ts.
 */
import type {
    TrackerRenderRequest,
    TrackerRenderResponse,
} from "$lib/workers/trackerRender.worker";

/**
 * File extensions libopenmpt 0.8.9 plays (its get_supported_extensions()),
 * less ones that mostly mean something else (`ppm` is an image, `mus` and
 * `sfx` are as often game sound data, `fmt` is anything).
 * Packed modules (`mmcmp`, `xpk`) are unpacked by libopenmpt itself.
 */
// prettier-ignore
const TRACKER_EXTENSIONS = new Set([
    "mptm", "mod", "s3m", "xm", "it", "667", "669", "amf", "ams", "c67",
    "cba", "dbm", "digi", "dmf", "dsm", "dsym", "dtm", "etx", "far", "fc",
    "fc13", "fc14", "fst", "ftm", "imf", "ims", "ice", "j2b", "m15", "mdl",
    "med", "mms", "mt2", "mtm", "nst", "okt", "plm", "psm", "pt36", "ptm",
    "puma", "rtm", "smod", "st26", "stk", "stm", "stx", "stp", "symmod",
    "tcb", "gmc", "gtk", "gt2", "ult", "unic", "wow", "xmf", "gdm", "mo3",
    "oxm", "umx", "xpk", "mmcmp",
]);

const TRACKER_MIME =
    /^audio\/(x-)?(mod|xm|s3m|it|mptm|669|mtm|med|okt|stm|ult|far)$/;

/** True when an attachment's mimetype or filename says it's a tracker module. */
export function isTrackerAttachment(
    mimetype: string | null | undefined,
    filename: string | null | undefined,
): boolean {
    const base = (mimetype ?? "").toLowerCase().split(";")[0].trim();
    if (TRACKER_MIME.test(base)) return true;
    const name = (filename ?? "").trim().toLowerCase();
    const dot = name.lastIndexOf(".");
    return dot >= 0 && TRACKER_EXTENSIONS.has(name.slice(dot + 1));
}

let worker: Worker | null = null;
let nextId = 0;
const waiting = new Map<
    number,
    { resolve: (wav: ArrayBuffer) => void; reject: (err: Error) => void }
>();

function getWorker(): Worker {
    if (worker) return worker;
    worker = new Worker(
        new URL("../workers/trackerRender.worker.ts", import.meta.url),
        { type: "module" },
    );
    worker.onmessage = (e: MessageEvent<TrackerRenderResponse>) => {
        const job = waiting.get(e.data.id);
        if (!job) return;
        waiting.delete(e.data.id);
        if ("wav" in e.data) job.resolve(e.data.wav);
        else job.reject(new Error(e.data.error));
    };
    worker.onerror = () => {
        for (const job of waiting.values()) {
            job.reject(new Error("Tracker render worker failed"));
        }
        waiting.clear();
        worker?.terminate();
        worker = null;
    };
    return worker;
}

/** Render module bytes to a WAV blob. Rejects when libopenmpt can't. */
export async function renderTracker(module: ArrayBuffer): Promise<Blob> {
    const w = getWorker();
    const id = nextId++;
    const request: TrackerRenderRequest = { id, module };
    const wav = await new Promise<ArrayBuffer>((resolve, reject) => {
        waiting.set(id, { resolve, reject });
        w.postMessage(request, [module]);
    });
    return new Blob([wav], { type: "audio/wav" });
}

/**
 * Turn a module blob URL into a playable WAV blob URL. Always revokes the
 * input URL; the caller owns (and must revoke) the returned one.
 */
export async function trackerUrlToWavUrl(moduleUrl: string): Promise<string> {
    try {
        const data = await (await fetch(moduleUrl)).arrayBuffer();
        return URL.createObjectURL(await renderTracker(data));
    } finally {
        URL.revokeObjectURL(moduleUrl);
    }
}
