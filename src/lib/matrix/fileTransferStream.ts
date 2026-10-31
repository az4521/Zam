// Saves a received file by streaming it through the service worker: the worker
// answers a download request with a stream the page feeds, so to the browser
// this is one long ordinary download. It takes no quota and no second copy of
// the file, and the page knows when the browser has taken the last byte.
//
// A download only runs forwards and blocks can land in any order, so they wait
// here for their turn. The last one waits for the file's hash too: until it
// goes, the browser can't consider the download complete, so a file that fails
// the check ends as a failed download and never as a finished one.
import type { SaveSink } from "./fileTransferSink";

const STREAM_PATH = "/__zam_file_stream/";
/** Blocks held ahead of a gap before the receiver stops taking more. A lost
 *  block gets resent within seconds, and the sender has at most this many out
 *  after a gap it hasn't noticed. */
const MAX_HELD = 40;
/** How long the worker gets to pick up the download. */
const START_TIMEOUT_MS = 4_000;
const PING_MS = 10_000;
/** The worker didn't answer for this long: the browser stopped it. */
const DEAD_AFTER_MS = 30_000;

type WorkerMessage = { type: "started" | "pull" | "cancelled" | "pong" };
type PageMessage =
    | { type: "chunk"; data: Uint8Array<ArrayBuffer> }
    | { type: "done" | "error" | "ping" };

export class StreamSink implements SaveSink {
    private readonly held = new Map<number, Uint8Array<ArrayBuffer>>();
    private readonly waiters: (() => void)[] = [];
    private next = 0;
    private credits = 0;
    private finishing = false;
    private failure: Error | null = null;
    private flushed: (() => void) | null = null;
    private rejectFlush: ((err: Error) => void) | null = null;

    constructor(
        private readonly size: number,
        private readonly post: (
            message: PageMessage,
            transfer?: Transferable[],
        ) => void,
        private readonly onEnd: () => void = () => {},
    ) {}

    /** The worker asked for one more chunk. */
    pull(): void {
        this.credits++;
        this.pump();
    }

    /** The download is gone: the user cancelled it, or the worker died. */
    fail(err: Error): void {
        this.failure ??= err;
        this.rejectFlush?.(err);
        this.releaseWaiters();
        this.onEnd();
    }

    async write(
        position: number,
        data: Uint8Array<ArrayBuffer>,
    ): Promise<void> {
        if (this.failure) throw this.failure;
        this.held.set(position, data);
        this.pump();
        if (this.held.size > MAX_HELD)
            await new Promise<void>((resolve) => this.waiters.push(resolve));
        if (this.failure) throw this.failure;
    }

    async finish(): Promise<void> {
        if (this.failure) throw this.failure;
        this.finishing = true;
        this.pump();
        if (this.next < this.size)
            await new Promise<void>((resolve, reject) => {
                this.flushed = resolve;
                this.rejectFlush = reject;
            });
        this.post({ type: "done" });
        this.onEnd();
    }

    async abort(): Promise<void> {
        this.post({ type: "error" });
        this.failure ??= new Error("aborted");
        this.releaseWaiters();
        this.onEnd();
    }

    private pump(): void {
        while (this.credits > 0 && !this.failure) {
            const data = this.held.get(this.next);
            if (!data) break;
            const last = this.next + data.length >= this.size;
            if (last && !this.finishing) break;
            this.held.delete(this.next);
            this.next += data.length;
            if (data.length > 0) {
                this.credits--;
                this.post({ type: "chunk", data }, [data.buffer]);
            }
        }
        if (this.next >= this.size && this.finishing) this.flushed?.();
        if (this.held.size <= MAX_HELD) this.releaseWaiters();
    }

    private releaseWaiters(): void {
        for (const resolve of this.waiters.splice(0)) resolve();
    }
}

/** Whether streaming a download through a worker can work here at all. Safari
 *  doesn't reliably treat a worker's response as a download. */
function canStream(): boolean {
    const agent = navigator.userAgent;
    const webkit =
        /iP(hone|ad|od)/.test(agent) ||
        (/Safari\//.test(agent) && !/Chrome|Chromium|Android/.test(agent));
    return !webkit && !!navigator.serviceWorker?.controller;
}

/** Start a download fed by the service worker. Null if it can't start here,
 *  which leaves nothing behind. */
export async function openStreamSink(
    name: string,
    size: number,
): Promise<SaveSink | null> {
    const worker = navigator.serviceWorker?.controller;
    if (!worker || !canStream()) return null;
    const id = crypto.randomUUID();
    const { port1: port, port2 } = new MessageChannel();
    const frame = document.createElement("iframe");
    frame.hidden = true;

    let lastHeard = Date.now();
    const pinger = setInterval(() => {
        if (Date.now() - lastHeard >= DEAD_AFTER_MS) {
            sink.fail(new Error("service worker stopped"));
            return;
        }
        port.postMessage({ type: "ping" });
    }, PING_MS);
    const sink = new StreamSink(
        size,
        (message, transfer = []) => port.postMessage(message, transfer),
        () => {
            clearInterval(pinger);
            // Not removed yet: some browsers tie the download to its frame.
            setTimeout(() => frame.remove(), 60_000);
        },
    );

    const started = new Promise<boolean>((resolve) => {
        setTimeout(() => resolve(false), START_TIMEOUT_MS);
        port.onmessage = (e: MessageEvent<WorkerMessage>) => {
            lastHeard = Date.now();
            if (e.data.type === "started") resolve(true);
            else if (e.data.type === "pull") sink.pull();
            else if (e.data.type === "cancelled")
                sink.fail(new Error("download cancelled"));
        };
    });

    worker.postMessage({ type: "FILE_STREAM_OPEN", id, name, size }, [port2]);
    frame.src = `${STREAM_PATH}${id}`;
    document.body.appendChild(frame);
    if (await started) return sink;
    await sink.abort();
    frame.remove();
    return null;
}
