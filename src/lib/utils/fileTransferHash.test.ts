import { describe, expect, it } from "vitest";
import {
    BLOCK_SIZE,
    blockLeaf,
    importHashKey,
    treeRoot,
} from "$lib/utils/fileTransfer";
import { hashFile } from "$lib/utils/fileTransferHash";

function pattern(n: number): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = (i * 7 + 3) % 251;
    return out;
}

const FIXED_KEY = new Uint8Array(32).fill(9) as Uint8Array<ArrayBuffer>;

describe("hashFile", () => {
    it("hashes an empty file as one empty block", async () => {
        const h = await hashFile(new Blob([]), { hashKeyRaw: FIXED_KEY });
        expect(h.leaves).toHaveLength(1);
        const key = await importHashKey(FIXED_KEY);
        expect(h.leaves[0]).toEqual(await blockLeaf(key, 0, new Uint8Array(0)));
        expect(h.root).toEqual(h.leaves[0]);
    });

    it("hashes a 5 byte file as one block", async () => {
        const bytes = pattern(5);
        const h = await hashFile(new Blob([bytes]), {
            hashKeyRaw: FIXED_KEY,
        });
        expect(h.leaves).toHaveLength(1);
        const key = await importHashKey(FIXED_KEY);
        expect(h.leaves[0]).toEqual(await blockLeaf(key, 0, bytes));
    });

    it("hashes exactly BLOCK_SIZE as one block", async () => {
        const bytes = pattern(BLOCK_SIZE);
        const h = await hashFile(new Blob([bytes]), {
            hashKeyRaw: FIXED_KEY,
        });
        expect(h.leaves).toHaveLength(1);
        const key = await importHashKey(FIXED_KEY);
        expect(h.leaves[0]).toEqual(await blockLeaf(key, 0, bytes));
    });

    it("splits BLOCK_SIZE+1 into two leaves", async () => {
        const bytes = pattern(BLOCK_SIZE + 1);
        const h = await hashFile(new Blob([bytes]), {
            hashKeyRaw: FIXED_KEY,
        });
        expect(h.leaves).toHaveLength(2);
        const key = await importHashKey(FIXED_KEY);
        expect(h.leaves[0]).toEqual(
            await blockLeaf(key, 0, bytes.subarray(0, BLOCK_SIZE)),
        );
        expect(h.leaves[1]).toEqual(
            await blockLeaf(key, 1, bytes.subarray(BLOCK_SIZE)),
        );
    });

    it("gives a root equal to treeRoot of the leaves", async () => {
        const h = await hashFile(new Blob([pattern(3 * BLOCK_SIZE + 10)]), {
            hashKeyRaw: FIXED_KEY,
        });
        expect(h.leaves).toHaveLength(4);
        expect(h.root).toEqual(await treeRoot(h.leaves));
    });

    it("returns the hash key it used and makes a fresh one by default", async () => {
        const given = new Uint8Array(32).fill(4) as Uint8Array<ArrayBuffer>;
        const fixed = await hashFile(new Blob([pattern(10)]), {
            hashKeyRaw: given,
        });
        expect(fixed.hashKeyRaw).toEqual(given);

        const a = await hashFile(new Blob([pattern(10)]));
        const b = await hashFile(new Blob([pattern(10)]));
        expect(a.hashKeyRaw).toHaveLength(32);
        expect(a.hashKeyRaw).not.toEqual(b.hashKeyRaw);
        expect(a.root).not.toEqual(b.root);
    });

    it("reports progress up to the file size", async () => {
        const size = 2 * BLOCK_SIZE + 100;
        const seen: number[] = [];
        await hashFile(new Blob([pattern(size)]), {
            hashKeyRaw: FIXED_KEY,
            onProgress: (bytes) => seen.push(bytes),
        });
        expect(seen).toEqual([BLOCK_SIZE, 2 * BLOCK_SIZE, size]);
    });

    it("reports zero progress for an empty file", async () => {
        const seen: number[] = [];
        await hashFile(new Blob([]), {
            hashKeyRaw: FIXED_KEY,
            onProgress: (bytes) => seen.push(bytes),
        });
        expect(seen).toEqual([0]);
    });

    it("rejects with AbortError when aborted mid-way", async () => {
        const controller = new AbortController();
        const calls: number[] = [];
        const promise = hashFile(new Blob([pattern(3 * BLOCK_SIZE)]), {
            hashKeyRaw: FIXED_KEY,
            signal: controller.signal,
            onProgress: (bytes) => {
                calls.push(bytes);
                if (bytes >= BLOCK_SIZE) controller.abort();
            },
        });
        await expect(promise).rejects.toMatchObject({ name: "AbortError" });
        expect(calls).toEqual([BLOCK_SIZE]);
    });

    it("rejects immediately when the signal is already aborted", async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(
            hashFile(new Blob([pattern(10)]), {
                signal: controller.signal,
            }),
        ).rejects.toMatchObject({ name: "AbortError" });
    });
});
