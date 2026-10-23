import type {
    JpegProgressiveRequest,
    JpegProgressiveResponse,
} from "$lib/workers/jpegProgressive.worker";

let worker: Worker | null = null;
let nextId = 0;
const waiting = new Map<
    number,
    {
        resolve: (jpeg: ArrayBuffer | null) => void;
        reject: (err: Error) => void;
    }
>();

function getWorker(): Worker {
    if (worker) return worker;
    worker = new Worker(
        new URL("../workers/jpegProgressive.worker.ts", import.meta.url),
        { type: "module" },
    );
    worker.onmessage = (e: MessageEvent<JpegProgressiveResponse>) => {
        const job = waiting.get(e.data.id);
        if (!job) return;
        waiting.delete(e.data.id);
        if ("jpeg" in e.data) job.resolve(e.data.jpeg);
        else job.reject(new Error(e.data.error));
    };
    worker.onerror = () => {
        // A failed load shouldn't poison every later attempt.
        for (const job of waiting.values()) {
            job.reject(new Error("JPEG worker failed"));
        }
        waiting.clear();
        worker?.terminate();
        worker = null;
    };
    return worker;
}

function convertInWorker(jpeg: ArrayBuffer): Promise<ArrayBuffer | null> {
    return new Promise((resolve, reject) => {
        const id = nextId++;
        waiting.set(id, { resolve, reject });
        getWorker().postMessage({ id, jpeg } satisfies JpegProgressiveRequest, [
            jpeg,
        ]);
    });
}

/**
 * A progressive copy of `file` if it is a baseline JPEG (same pixels and
 * metadata, see utils/jpegProgressive), so receivers see the whole picture
 * early and sharpening as it downloads. Anything else, or any failure, gives
 * back `file` itself. Never throws.
 */
export async function progressiveJpegForUpload(file: File): Promise<File> {
    try {
        const head = new Uint8Array(await file.slice(0, 3).arrayBuffer());
        if (head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) {
            return file;
        }
        if (typeof Worker === "undefined") return file;
        const out = await convertInWorker(await file.arrayBuffer());
        if (!out) return file;
        return new File([out], file.name, {
            type: file.type || "image/jpeg",
            lastModified: file.lastModified,
        });
    } catch (err) {
        console.warn("Progressive JPEG conversion failed", err);
        return file;
    }
}
