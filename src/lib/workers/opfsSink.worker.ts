// Writes a received file into the origin private file system. A sync access
// handle is the one way to write there that every browser with OPFS has (Safari
// is the holdout for createWritable), and it only exists in a dedicated worker.

export type OpfsSinkRequest =
    | { id: number; kind: "open"; name: string }
    | { id: number; kind: "write"; position: number; data: Uint8Array }
    | { id: number; kind: "close" };

export type OpfsSinkResponse =
    { id: number; ok: true } | { id: number; ok: false; error: string };

interface AccessHandle {
    write(data: Uint8Array, options: { at: number }): number;
    flush(): void;
    close(): void;
}

let handle: AccessHandle | null = null;

async function open(name: string): Promise<void> {
    const root = await navigator.storage.getDirectory();
    const file = await root.getFileHandle(name, { create: true });
    handle = await (
        file as unknown as {
            createSyncAccessHandle(): Promise<AccessHandle>;
        }
    ).createSyncAccessHandle();
}

function write(position: number, data: Uint8Array): void {
    if (!handle) throw new Error("not open");
    // A short write means the quota ran out.
    if (handle.write(data, { at: position }) !== data.length)
        throw new DOMException("short write", "QuotaExceededError");
}

function close(): void {
    handle?.flush();
    handle?.close();
    handle = null;
}

self.onmessage = async (e: MessageEvent<OpfsSinkRequest>) => {
    const request = e.data;
    try {
        if (request.kind === "open") await open(request.name);
        else if (request.kind === "write")
            write(request.position, request.data);
        else close();
        self.postMessage({ id: request.id, ok: true });
    } catch (err) {
        self.postMessage({
            id: request.id,
            ok: false,
            error: (err as Error).name,
        });
    }
};
