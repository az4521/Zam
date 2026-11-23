/**
 * The sender's hash of a whole file, made once in the background after the
 * offer is posted and reused for every request. Reads one block at a time.
 */
import {
    BLOCK_SIZE,
    LEAF_HEADER_BYTES,
    blockCount,
    blockLeafInPlace,
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

/**
 * Fills `dest` with the bytes of `blob`, which must be exactly `dest.length`
 * long. Reads the blob's stream in its own chunks, so no block-sized buffer of
 * the blob's own is made.
 */
async function readInto(blob: Blob, dest: Uint8Array): Promise<void> {
    if (typeof blob.stream !== "function") {
        // Some DOM implementations (jsdom) have no Blob.stream. This copies
        // the block once, as the reads did before.
        const bytes =
            typeof blob.arrayBuffer === "function"
                ? new Uint8Array(await blob.arrayBuffer())
                : new Uint8Array(await new Response(blob).arrayBuffer());
        if (bytes.length !== dest.length) throw new Error("blob size changed");
        dest.set(bytes);
        return;
    }
    const reader = blob.stream().getReader();
    let at = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (at + value.length > dest.length)
            throw new Error("blob size changed");
        dest.set(value, at);
        at += value.length;
    }
    if (at !== dest.length) throw new Error("blob size changed");
}

function abortError(): DOMException {
    return new DOMException("The operation was aborted.", "AbortError");
}

/**
 * Hashes `file` block by block. Rejects with an AbortError if `signal` aborts.
 *
 * One buffer, the size of a block with its leaf header in front, serves every
 * block: each block is read into it and signed where it lies. The only
 * retained output is the leaves, 32 bytes a block.
 */
export async function hashFile(
    file: Blob,
    opts: HashFileOptions = {},
): Promise<FileHashes> {
    const hashKeyRaw =
        opts.hashKeyRaw ?? crypto.getRandomValues(new Uint8Array(32));
    const hashKey = await importHashKey(hashKeyRaw);
    const blocks = blockCount(file.size);
    const leaves: Uint8Array<ArrayBuffer>[] = [];
    const scratch = new Uint8Array(LEAF_HEADER_BYTES + BLOCK_SIZE);
    let hashed = 0;
    for (let index = 0; index < blocks; index++) {
        if (opts.signal?.aborted) throw abortError();
        const start = index * BLOCK_SIZE;
        const length = Math.min(file.size, start + BLOCK_SIZE) - start;
        await readInto(
            file.slice(start, start + length),
            scratch.subarray(LEAF_HEADER_BYTES, LEAF_HEADER_BYTES + length),
        );
        if (opts.signal?.aborted) throw abortError();
        // Awaited before the buffer is refilled: the next block overwrites it.
        leaves.push(await blockLeafInPlace(hashKey, index, scratch, length));
        hashed += length;
        opts.onProgress?.(hashed);
    }
    return { hashKeyRaw, leaves, root: await treeRoot(leaves) };
}
