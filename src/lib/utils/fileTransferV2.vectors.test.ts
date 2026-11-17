import { describe, expect, it } from "vitest";
import vectors from "./fileTransferV2.vectors.json";
import {
    BLOCK_SIZE,
    blockCount,
    blockLeaf,
    deriveMacKey,
    deriveMacKeyBits,
    importHashKey,
    leafListMatches,
    openBlock,
    openPacket,
    sealBlock,
    sealPacket,
    treeRoot,
} from "./fileTransfer";

type Bytes = Uint8Array<ArrayBuffer>;

function fromHex(hex: string): Bytes {
    return Uint8Array.from(hex.match(/../g) ?? [], (h) => parseInt(h, 16));
}

function toHex(bytes: Uint8Array): string {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(bytes: Bytes): Promise<string> {
    return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}

/** The vectors' file: byte j is (j * 7 + 3) % 251. */
function vectorFile(size: number): Bytes {
    const out = new Uint8Array(size);
    for (let j = 0; j < size; j++) out[j] = (j * 7 + 3) % 251;
    return out;
}

const PREFIX = vectors.aad_prefix;
const INFO = vectors.packet_mac.hkdf_info;
const TRANSFER_ID = vectors.transfer_id;
const RAW_KEY = fromHex(vectors.key);
const RAW_HASH_KEY = fromHex(vectors.hash_key);

describe("v2 vectors: files", () => {
    it.each(vectors.files.map((f) => [f.size, f] as const))(
        "file of %d bytes",
        async (size, f) => {
            const file = vectorFile(size);
            expect(await sha256Hex(file)).toBe(f.file_sha256);
            expect(f.block_count).toBe(blockCount(size));

            const hashKey = await importHashKey(RAW_HASH_KEY);
            const key = await crypto.subtle.importKey(
                "raw",
                RAW_KEY,
                "AES-GCM",
                false,
                ["encrypt", "decrypt"],
            );

            const blocks: Bytes[] = [];
            for (let i = 0; i < f.block_count; i++)
                blocks.push(
                    file.slice(
                        i * BLOCK_SIZE,
                        Math.min(size, (i + 1) * BLOCK_SIZE),
                    ),
                );

            const leaves: Bytes[] = [];
            for (let i = 0; i < blocks.length; i++)
                leaves.push(await blockLeaf(hashKey, i, blocks[i]));
            expect(leaves.map(toHex)).toEqual(f.leaves);

            const root = await treeRoot(leaves);
            expect(toHex(root)).toBe(f.root);
            expect(await leafListMatches(leaves, size, root)).toBe(true);

            for (const s of f.sealed) {
                expect(s.aad).toBe(
                    `${PREFIX}|${TRANSFER_ID}|${s.index}|${size}`,
                );
                const plain = blocks[s.index];
                expect(plain.length).toBe(s.plaintext_len);

                const sealed = await sealBlock(
                    key,
                    TRANSFER_ID,
                    size,
                    s.index,
                    plain,
                    { iv: fromHex(s.iv), prefix: PREFIX },
                );
                expect(sealed.length).toBe(s.sealed_len);
                expect(await sha256Hex(sealed)).toBe(s.sealed_sha256);
                expect(toHex(sealed.slice(0, 48))).toBe(s.sealed_head);
                expect(toHex(sealed.slice(-32))).toBe(s.sealed_tail);

                const opened = await openBlock(
                    key,
                    TRANSFER_ID,
                    size,
                    s.index,
                    sealed,
                    PREFIX,
                );
                expect(toHex(opened)).toBe(toHex(plain));
            }
        },
    );
});

describe("v2 vectors: short leaf list", () => {
    const t = vectors.tamper_short_leaf_list;

    it("rebuilds the root with two leaves, which the count check rejects", async () => {
        const hashKey = await importHashKey(RAW_HASH_KEY);
        const leaves: Bytes[] = [];
        for (let i = 0; i < 3; i++)
            leaves.push(
                await blockLeaf(hashKey, i, new Uint8Array(10).fill(i)),
            );
        expect(leaves.map(toHex)).toEqual(t.leaves);

        const root = fromHex(t.root);
        expect(toHex(await treeRoot(leaves))).toBe(t.root);
        expect(await leafListMatches(leaves, 2 * BLOCK_SIZE + 10, root)).toBe(
            true,
        );

        const bad = t.bad_leaf_list.map(fromHex);
        expect(toHex(await treeRoot(bad))).toBe(t.root);
        expect(await leafListMatches(bad, 2 * BLOCK_SIZE + 10, root)).toBe(
            false,
        );
    });
});

describe("v2 vectors: tampered AAD", () => {
    const t = vectors.tamper_aad;

    it("block 1 of a 2 MiB file fails under index 0 or size + 1", async () => {
        const size = t.size;
        const file = vectorFile(size);
        const plain = file.slice(BLOCK_SIZE, Math.min(size, 2 * BLOCK_SIZE));
        const key = await crypto.subtle.importKey(
            "raw",
            RAW_KEY,
            "AES-GCM",
            false,
            ["encrypt", "decrypt"],
        );
        const sealed = await sealBlock(
            key,
            TRANSFER_ID,
            size,
            t.sealed_for_index,
            plain,
            { iv: fromHex(t.iv), prefix: PREFIX },
        );
        expect(await sha256Hex(sealed)).toBe(t.sealed_sha256);

        const ok = await openBlock(
            key,
            TRANSFER_ID,
            size,
            t.sealed_for_index,
            sealed,
            PREFIX,
        );
        expect(toHex(ok)).toBe(toHex(plain));
        await expect(
            openBlock(key, TRANSFER_ID, size, 0, sealed, PREFIX),
        ).rejects.toThrow();
        await expect(
            openBlock(
                key,
                TRANSFER_ID,
                size + 1,
                t.sealed_for_index,
                sealed,
                PREFIX,
            ),
        ).rejects.toThrow();
    });
});

describe("v2 vectors: packet authentication", () => {
    it("derives the MAC key from the transfer key", async () => {
        const bits = await deriveMacKeyBits(RAW_KEY, INFO);
        expect(toHex(bits)).toBe(vectors.packet_mac.mac_key);
    });

    it.each(vectors.packet_mac.packets.map((p, i) => [i, p] as const))(
        "packet %d seals to its wire form and opens",
        async (_i, p) => {
            const macKey = await deriveMacKey(RAW_KEY, INFO);
            const packet = fromHex(p.packet);
            const wire = await sealPacket(
                macKey,
                p.direction as 1 | 2,
                p.sequence,
                packet,
            );
            expect(toHex(wire)).toBe(p.on_wire);

            const opened = await openPacket(
                macKey,
                p.direction as 1 | 2,
                fromHex(p.on_wire),
            );
            expect(opened).not.toBeNull();
            expect(opened?.seq).toBe(p.sequence);
            expect(toHex(opened?.packet ?? new Uint8Array())).toBe(p.packet);
        },
    );
});
