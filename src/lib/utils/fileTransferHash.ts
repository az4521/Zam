/**
 * The sender's hash of a whole file, made once in the background after the
 * offer is posted and reused for every request. Reads one block at a time.
 */
import {
    BLOCK_SIZE,
    blockCount,
    blockLeaf,
    importHashKey,
    treeRoot,
} from "$lib/utils/fileTransfer";

export interface FileHashes {
    /** 32 random bytes, made once per offer. */
    hashKeyRaw: Uint8Array<ArrayBuffer>;
    /** One 32-byte leaf per block. */
    leaves: Uint8Array<ArrayBuffer>[];
    root: Uint8Array<ArrayBuffer>;
}

export interface HashFileOptions {
    signal?: AbortSignal;
    /** Bytes hashed so far, after each block. */
    onProgress?: (bytes: number) => void;
    /** For tests only; the default is fresh random bytes. */
    hashKeyRaw?: Uint8Array<ArrayBuffer>;
}

async function readBytes(blob: Blob): Promise<Uint8Array<ArrayBuffer>> {
    if (typeof blob.arrayBuffer === "function")
        return new Uint8Array(await blob.arrayBuffer());
    // Some DOM implementations (jsdom) have no Blob.arrayBuffer.
    return new Uint8Array(await new Response(blob).arrayBuffer());
}

function abortError(): DOMException {
    return new DOMException("The operation was aborted.", "AbortError");
}

/** Hashes `file` block by block. Rejects with an AbortError if `signal` aborts. */
export async function hashFile(
    file: Blob,
    opts: HashFileOptions = {},
): Promise<FileHashes> {
    const hashKeyRaw =
        opts.hashKeyRaw ?? crypto.getRandomValues(new Uint8Array(32));
    const hashKey = await importHashKey(hashKeyRaw);
    const blocks = blockCount(file.size);
    const leaves: Uint8Array<ArrayBuffer>[] = [];
    let hashed = 0;
    for (let index = 0; index < blocks; index++) {
        if (opts.signal?.aborted) throw abortError();
        const start = index * BLOCK_SIZE;
        const plain = await readBytes(
            file.slice(start, Math.min(file.size, start + BLOCK_SIZE)),
        );
        if (opts.signal?.aborted) throw abortError();
        leaves.push(await blockLeaf(hashKey, index, plain));
        hashed += plain.length;
        opts.onProgress?.(hashed);
    }
    return { hashKeyRaw, leaves, root: await treeRoot(leaves) };
}
