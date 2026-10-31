// Where a received file goes while it arrives. A file too big to upload is too
// big for memory, so blocks go straight to disk, in whatever order they land.
//
// There are three ways to reach a disk, best first:
//   - Android: native code writes into Downloads. The WebView has no save
//     dialog and no download manager for blob: URLs.
//   - A save dialog (showSaveFilePicker: desktop Chromium, Electron): the file
//     is written where the user chose.
//   - A download fed through the service worker (Firefox, Android Chrome):
//     see fileTransferStream.ts.
//   - The origin private file system (Safari, or with no service worker yet):
//     the browser's private disk space, up to its quota, then an ordinary
//     download out of it. That takes the file's size twice over until the copy
//     is cleaned up, because a page can't tell when a download has finished.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { downloadObjectUrl } from "$lib/utils/saveFile";
import {
    bytesToBase64,
    randomToken,
    safeFileName,
} from "$lib/utils/fileTransfer";
import type {
    OpfsSinkRequest,
    OpfsSinkResponse,
} from "$lib/workers/opfsSink.worker";
import type { TransferSink } from "./fileTransferEngine";
import { openStreamSink } from "./fileTransferStream";

export interface SaveSink extends TransferSink {
    /** Everything is verified: make the file the user's. */
    finish(): Promise<void>;
    /** Throw away what was written. */
    abort(): Promise<void>;
}

export class SaveUnsupportedError extends Error {}
export class StorageFullError extends Error {}

interface WritableFile {
    write(chunk: {
        type: "write";
        position: number;
        data: Uint8Array<ArrayBuffer>;
    }): Promise<void>;
    close(): Promise<void>;
    abort(): Promise<void>;
}

interface WritableHandle {
    createWritable(): Promise<WritableFile>;
}

type SavePicker = (options: {
    suggestedName: string;
}) => Promise<WritableHandle>;

interface FileTransferPlugin {
    open(options: {
        filename: string;
        mimeType: string;
        size: number;
    }): Promise<{ id: string }>;
    write(options: {
        id: string;
        position: number;
        data: string;
    }): Promise<void>;
    finish(options: { id: string }): Promise<void>;
    abort(options: { id: string }): Promise<void>;
    keepRunning(): Promise<void>;
    letStop(): Promise<void>;
}

const FileTransfer = registerPlugin<FileTransferPlugin>("FileTransfer");

/** WebView's binary route to native code. Older WebViews don't have it. */
interface BlockChannel {
    postMessage(data: ArrayBuffer): void;
    onmessage: ((e: { data: string }) => void) | null;
}

const BLOCK_HEADER_BYTES = 4 + 8 + 36;

const SCRATCH_PREFIX = "zam-transfer-";
/** A scratch copy older than this is from a finished or abandoned transfer.
 *  The browser needs it until its download has taken the bytes. */
const SCRATCH_MAX_AGE_MS = 6 * 60 * 60_000;

function isAndroid(): boolean {
    return (
        Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"
    );
}

let nextBlockSequence = 0;
const blocksWaiting = new Map<
    number,
    { resolve: () => void; reject: (err: Error) => void }
>();

/** Writes over the binary channel, or null where there isn't one. Sends
 *  blocks without the Capacitor bridge's cost (FileTransferPlugin.java). The
 *  channel is one object however many transfers run, so replies are matched
 *  by sequence number across all of them. */
function blockWriter(
    id: string,
): ((position: number, data: Uint8Array) => Promise<void>) | null {
    const channel = (window as unknown as { zamFileBlocks?: BlockChannel })
        .zamFileBlocks;
    if (!channel) return null;
    channel.onmessage ??= (e) => {
        const [sequence, outcome] = e.data.split(":");
        const job = blocksWaiting.get(Number(sequence));
        blocksWaiting.delete(Number(sequence));
        if (outcome === "ok") job?.resolve();
        else job?.reject(Object.assign(new Error(outcome), { code: outcome }));
    };
    const idBytes = new TextEncoder().encode(id);
    return (position, data) =>
        new Promise((resolve, reject) => {
            const sequence = nextBlockSequence++;
            const frame = new Uint8Array(BLOCK_HEADER_BYTES + data.length);
            const view = new DataView(frame.buffer);
            view.setUint32(0, sequence);
            view.setBigUint64(4, BigInt(position));
            frame.set(idBytes, 12);
            frame.set(data, BLOCK_HEADER_BYTES);
            blocksWaiting.set(sequence, { resolve, reject });
            channel.postMessage(frame.buffer);
        });
}

async function openedAndroidSink(
    name: string,
    mimeType: string,
    size: number,
): Promise<SaveSink> {
    let id: string;
    try {
        ({ id } = await FileTransfer.open({ filename: name, mimeType, size }));
    } catch (err) {
        if ((err as { code?: string }).code === "STORAGE_FULL")
            throw new StorageFullError();
        throw err;
    }
    const write =
        blockWriter(id) ??
        ((position, data) =>
            FileTransfer.write({ id, position, data: bytesToBase64(data) }));
    return {
        write,
        finish: () => FileTransfer.finish({ id }),
        abort: () => FileTransfer.abort({ id }).catch(() => {}),
    };
}

function sinkOverWritable(writable: WritableFile): SaveSink {
    return {
        write: (position, data) =>
            writable.write({ type: "write", position, data }),
        // Writes land in a temporary file until this, so a file that failed
        // its hash never appears under the user's chosen name.
        finish: () => writable.close(),
        abort: () => writable.abort().catch(() => {}),
    };
}

/** The worker's calls, as promises. */
function opfsWorker() {
    const worker = new Worker(
        new URL("../workers/opfsSink.worker.ts", import.meta.url),
        { type: "module" },
    );
    let nextId = 0;
    const waiting = new Map<
        number,
        { resolve: () => void; reject: (err: Error) => void }
    >();
    worker.onmessage = (e: MessageEvent<OpfsSinkResponse>) => {
        const job = waiting.get(e.data.id);
        waiting.delete(e.data.id);
        if (e.data.ok) job?.resolve();
        else job?.reject(new Error(e.data.error));
    };
    return {
        call: (
            request: DistributiveOmit<OpfsSinkRequest, "id">,
            transfer: Transferable[] = [],
        ) =>
            new Promise<void>((resolve, reject) => {
                const id = nextId++;
                waiting.set(id, { resolve, reject });
                worker.postMessage({ ...request, id }, transfer);
            }),
        end: () => worker.terminate(),
    };
}

type DistributiveOmit<T, K extends keyof T> = T extends unknown
    ? Omit<T, K>
    : never;

async function openedOpfsSink(name: string, size: number): Promise<SaveSink> {
    // Firefox only goes past 10 GiB for a site with persistent storage. Asked
    // in the click, since it shows a prompt there.
    await navigator.storage.persist?.().catch(() => false);
    const { quota, usage } = await navigator.storage.estimate();
    if (quota !== undefined && size > quota - (usage ?? 0))
        throw new StorageFullError();
    const root = await navigator.storage.getDirectory();
    const scratch = `${SCRATCH_PREFIX}${randomToken(8)}`;
    const worker = opfsWorker();
    const remove = () => root.removeEntry(scratch).catch(() => {});
    try {
        await worker.call({ kind: "open", name: scratch });
    } catch (err) {
        worker.end();
        await remove();
        throw err;
    }
    return {
        write: (position, data) =>
            worker.call({ kind: "write", position, data }, [data.buffer]),
        finish: async () => {
            await worker.call({ kind: "close" });
            worker.end();
            const handle = await root.getFileHandle(scratch);
            // A File from here is backed by the disk, so this copies it to
            // Downloads without reading it into memory.
            downloadObjectUrl(
                URL.createObjectURL(await handle.getFile()),
                name,
            );
        },
        abort: async () => {
            await worker.call({ kind: "close" }).catch(() => {});
            worker.end();
            await remove();
        },
    };
}

/** Ask where the file goes. Null if the user backed out. Must run in a click:
 *  the save dialog needs one. */
export async function openSaveSink(
    rawName: string,
    mimeType: string,
    size: number,
): Promise<SaveSink | null> {
    const name = safeFileName(rawName);
    if (isAndroid()) return openedAndroidSink(name, mimeType, size);
    const picker = (window as unknown as { showSaveFilePicker?: SavePicker })
        .showSaveFilePicker;
    if (picker) {
        try {
            const handle = await picker({ suggestedName: name });
            return sinkOverWritable(await handle.createWritable());
        } catch (err) {
            if ((err as Error).name === "AbortError") return null;
            throw err;
        }
    }
    const streamed = await openStreamSink(name, size);
    if (streamed) return streamed;
    if (typeof navigator.storage?.getDirectory !== "function")
        throw new SaveUnsupportedError();
    try {
        return await openedOpfsSink(name, size);
    } catch (err) {
        if (err instanceof StorageFullError) throw err;
        console.warn("[file-transfer] no private file storage", err);
        throw new SaveUnsupportedError();
    }
}

/** Remove scratch copies left behind by earlier sessions. */
export async function cleanOldScratch(): Promise<void> {
    if (typeof navigator.storage?.getDirectory !== "function") return;
    const root = await navigator.storage.getDirectory();
    const entries = (
        root as unknown as { keys(): AsyncIterable<string> }
    ).keys();
    for await (const name of entries) {
        if (!name.startsWith(SCRATCH_PREFIX)) continue;
        const handle = await root.getFileHandle(name);
        const file = await handle.getFile();
        if (Date.now() - file.lastModified < SCRATCH_MAX_AGE_MS) continue;
        // Refused for a file another tab is still writing, which is right.
        await root.removeEntry(name).catch(() => {});
    }
}

/** Android: keep the app running through a transfer, off screen too. */
export function holdAppForTransfer(): () => void {
    if (!isAndroid()) return () => {};
    void FileTransfer.keepRunning().catch((err) =>
        console.warn("[file-transfer] can't keep running", err),
    );
    let released = false;
    return () => {
        if (released) return;
        released = true;
        void FileTransfer.letStop().catch(() => {});
    };
}
