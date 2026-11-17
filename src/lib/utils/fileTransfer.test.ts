import { describe, expect, it } from "vitest";
import {
    BLOCK_SIZE,
    FILE_OFFER_EVENT,
    LEAF_BYTES,
    MAC_TRAILER_BYTES,
    MAX_DATA_PAYLOAD,
    MAX_FILE_SIZE,
    MAX_LEAVES_PER_PACKET,
    OFFER_LIFETIME_MS,
    PART_SIZE,
    base64UrlToBytes,
    blockCount,
    blockLeaf,
    blockLength,
    buildFileOffer,
    bytesToBase64,
    bytesToBase64Url,
    decodePacket,
    deriveMacKey,
    encodeAckPacket,
    encodeDataPackets,
    encodeLeavesPackets,
    formatTransferBytes,
    generateTransferKey,
    importHashKey,
    isFileOfferEventType,
    leafListMatches,
    offerExpiresAt,
    openBlock,
    openPacket,
    parseAckContent,
    parseFileOffer,
    safeFileName,
    sealBlock,
    sealedLength,
    sealPacket,
    transferIdentity,
    transferRoomAlias,
    treeRoot,
} from "./fileTransfer";

const offer = {
    transferId: "t1",
    name: "big.iso",
    size: 5_000_000,
    mimetype: "application/octet-stream",
    senderDevice: "DEV",
    expiresTs: 1234,
    relayOnly: false,
};

describe("offers", () => {
    it("round-trips", () => {
        expect(parseFileOffer(buildFileOffer(offer))).toEqual(offer);
    });

    it("round-trips relay_only when set", () => {
        const built = buildFileOffer({ ...offer, relayOnly: true });
        expect(built.relay_only).toBe(true);
        expect(parseFileOffer(built)).toEqual({ ...offer, relayOnly: true });
    });

    it("leaves relay_only off the wire unless set", () => {
        expect(buildFileOffer(offer)).not.toHaveProperty("relay_only");
    });

    it("defaults relay_only to false when absent", () => {
        const content = buildFileOffer(offer);
        expect(parseFileOffer(content)?.relayOnly).toBe(false);
    });

    it("recognises only its own event type", () => {
        expect(isFileOfferEventType(FILE_OFFER_EVENT)).toBe(true);
        expect(isFileOfferEventType("m.room.message")).toBe(false);
    });

    it.each([
        ["version 1", { version: 1 }],
        ["a newer version", { version: 3 }],
        ["a negative size", { size: -1 }],
        ["a fractional size", { size: 1.5 }],
        ["a size past the limit", { size: MAX_FILE_SIZE + 1 }],
        ["an empty name", { name: "" }],
        ["no sender device", { sender_device: undefined }],
        ["no transfer id", { transfer_id: "" }],
        ["a string relay_only", { relay_only: "true" }],
        ["a null relay_only", { relay_only: null }],
        ["a string expiry", { expires_ts: "1234" }],
        ["a missing expiry", { expires_ts: undefined }],
        ["an infinite expiry", { expires_ts: Infinity }],
        ["a NaN expiry", { expires_ts: NaN }],
    ])("rejects %s", (_label, change) => {
        expect(
            parseFileOffer({ ...buildFileOffer(offer), ...change }),
        ).toBeNull();
    });

    it("rejects non-objects", () => {
        expect(parseFileOffer(null)).toBeNull();
        expect(parseFileOffer("offer")).toBeNull();
    });
});

describe("offer expiry", () => {
    const serverTs = 1_700_000_000_000;

    it("keeps an earlier expiry the offer names", () => {
        const early = { ...offer, expiresTs: serverTs + 60_000 };
        expect(offerExpiresAt(early, serverTs)).toBe(serverTs + 60_000);
    });

    it("caps a later expiry at a day after the server stamped it", () => {
        const late = { ...offer, expiresTs: serverTs + 365 * 24 * 3600_000 };
        expect(offerExpiresAt(late, serverTs)).toBe(
            serverTs + OFFER_LIFETIME_MS,
        );
    });

    it("counts the day from the server stamp, not from now", () => {
        const late = { ...offer, expiresTs: Number.MAX_SAFE_INTEGER };
        const stamped = serverTs - 3 * 24 * 3600_000;
        expect(offerExpiresAt(late, stamped)).toBe(stamped + OFFER_LIFETIME_MS);
    });
});

describe("names", () => {
    it("builds lk-jwt-service's identity", () => {
        expect(transferIdentity("@a:b", "DEV")).toBe("@a:b:DEV");
    });

    it("names the LiveKit room by its secret alone", () => {
        expect(transferRoomAlias("abc")).toBe("zam-transfer-abc");
    });

    it.each([
        ["../../etc/passwd", "passwd"],
        ["C:\\Windows\\evil.exe", "evil.exe"],
        ["a/b\\c.txt", "c.txt"],
        ['a<b>c:"d|e?f*g.txt', "a_b_c__d_e_f_g.txt"],
        ["..", "file"],
        ["   ", "file"],
        ["", "file"],
        ["\u0000\u0001", "file"],
        ["ab\u0000c\u007Fd\u009Fe", "abcde"],
        ["a\u202Etxt.exe", "atxt.exe"],
        ["\u200Eab\u2066c\u2069\u061C", "abc"],
        [".hidden", "hidden"],
        ["...dots", "dots"],
        ["name. . ", "name"],
        ["trailing dot.", "trailing dot"],
        ["CON.txt", "_CON.txt"],
        ["con", "_con"],
        ["Nul.tar.gz", "_Nul.tar.gz"],
        ["com1.log", "_com1.log"],
        ["LPT9", "_LPT9"],
        ["COM10.txt", "COM10.txt"],
        ["CONSOLE.txt", "CONSOLE.txt"],
        ["photo.png", "photo.png"],
    ])("cleans %j", (name, expected) => {
        expect(safeFileName(name)).toBe(expected);
    });

    it("caps a long name at 200 characters", () => {
        expect(safeFileName("a".repeat(300))).toBe("a".repeat(200));
    });

    it("keeps a short extension when it caps a long name", () => {
        const name = safeFileName(`${"b".repeat(300)}.pdf`);
        expect(name).toHaveLength(200);
        expect(name.endsWith(".pdf")).toBe(true);
    });

    it("counts a long extension as part of the name", () => {
        const long = `${"c".repeat(300)}.${"x".repeat(20)}`;
        expect(safeFileName(long)).toBe("c".repeat(200));
    });

    it("leaves a name at the cap alone", () => {
        expect(safeFileName("d".repeat(200))).toBe("d".repeat(200));
    });

    it("does not end a capped name on a space", () => {
        expect(safeFileName(`${"e".repeat(199)} x`)).toBe("e".repeat(199));
    });
});

describe("block maths", () => {
    it("gives an empty file one block", () => {
        expect(blockCount(0)).toBe(1);
        expect(blockLength(0, 0)).toBe(0);
    });

    it("counts exact and partial blocks", () => {
        expect(blockCount(BLOCK_SIZE)).toBe(1);
        expect(blockCount(BLOCK_SIZE + 1)).toBe(2);
        expect(blockLength(BLOCK_SIZE + 1, 0)).toBe(BLOCK_SIZE);
        expect(blockLength(BLOCK_SIZE + 1, 1)).toBe(1);
    });
});

describe("base64", () => {
    it("handles a whole block", () => {
        const bytes = new Uint8Array(BLOCK_SIZE).fill(7);
        expect(atob(bytesToBase64(bytes))).toHaveLength(BLOCK_SIZE);
    });
});

describe("base64url", () => {
    it("round-trips every byte value", () => {
        const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
        const text = bytesToBase64Url(bytes);
        expect(text).not.toMatch(/[+/=]/);
        expect(base64UrlToBytes(text)).toEqual(bytes);
    });
});

describe("sealed blocks", () => {
    const plain = new TextEncoder().encode("some file bytes");

    it("open with the same key at the same place", async () => {
        const { key } = await generateTransferKey();
        const sealed = await sealBlock(key, "t", 100, 3, plain);
        expect(sealed.length).toBe(plain.length + 28);
        const opened = await openBlock(key, "t", 100, 3, sealed);
        expect(Array.from(opened)).toEqual(Array.from(plain));
    });

    it("predict their length", () => {
        expect(sealedLength(10, 0)).toBe(38);
    });

    it.each([
        ["another block index", "t", 100, 4],
        ["another transfer", "u", 100, 3],
        ["another file size", "t", 101, 3],
    ])("refuse %s", async (_label, id, size, index) => {
        const { key } = await generateTransferKey();
        const sealed = await sealBlock(key, "t", 100, 3, plain);
        await expect(openBlock(key, id, size, index, sealed)).rejects.toThrow();
    });

    it("refuse another AAD prefix", async () => {
        const { key } = await generateTransferKey();
        const sealed = await sealBlock(key, "t", 100, 3, plain);
        await expect(
            openBlock(key, "t", 100, 3, sealed, "m.file_transfer.v2"),
        ).rejects.toThrow();
    });

    it("refuse altered bytes and other keys", async () => {
        const { key } = await generateTransferKey();
        const other = await generateTransferKey();
        const sealed = await sealBlock(key, "t", 100, 3, plain);
        await expect(
            openBlock(other.key, "t", 100, 3, sealed),
        ).rejects.toThrow();
        sealed[sealed.length - 1] ^= 1;
        await expect(openBlock(key, "t", 100, 3, sealed)).rejects.toThrow();
    });

    it("never reuse an IV", async () => {
        const { key } = await generateTransferKey();
        const a = await sealBlock(key, "t", 100, 3, plain);
        const b = await sealBlock(key, "t", 100, 3, plain);
        expect(a.subarray(0, 12)).not.toEqual(b.subarray(0, 12));
    });
});

describe("hash tree", () => {
    const leafOf = (i: number) => new Uint8Array(LEAF_BYTES).fill(i + 1);

    it("gives a single leaf as the root", async () => {
        const leaf = leafOf(0);
        expect(await treeRoot([leaf])).toEqual(leaf);
    });

    it("rejects an empty leaf list", async () => {
        await expect(treeRoot([])).rejects.toThrow();
    });

    it("promotes an odd node unchanged", async () => {
        const leaves = [leafOf(0), leafOf(1), leafOf(2)];
        const pair = await treeRoot([leaves[0], leaves[1]]);
        const root = await treeRoot([pair, leaves[2]]);
        expect(await treeRoot(leaves)).toEqual(root);
    });

    it("leaves are keyed HMACs of index and plaintext", async () => {
        const { raw } = await generateTransferKey();
        const hashKey = await importHashKey(raw);
        const plain = new Uint8Array([1, 2, 3]);
        const a = await blockLeaf(hashKey, 0, plain);
        expect(a).toHaveLength(LEAF_BYTES);
        expect(await blockLeaf(hashKey, 1, plain)).not.toEqual(a);
    });

    it("accepts a complete leaf list that rebuilds the root", async () => {
        const leaves = [leafOf(0), leafOf(1), leafOf(2)];
        const root = await treeRoot(leaves);
        expect(await leafListMatches(leaves, 2 * BLOCK_SIZE + 10, root)).toBe(
            true,
        );
    });

    it("rejects the too-short list that rebuilds the root", async () => {
        const leaves = [leafOf(0), leafOf(1), leafOf(2)];
        const root = await treeRoot(leaves);
        const pair = await treeRoot([leaves[0], leaves[1]]);
        const bad = [pair, leaves[2]];
        expect(await treeRoot(bad)).toEqual(root);
        expect(await leafListMatches(bad, 2 * BLOCK_SIZE + 10, root)).toBe(
            false,
        );
    });

    it("rejects a leaf of the wrong length", async () => {
        const leaves = [leafOf(0), new Uint8Array(31)];
        const root = await treeRoot(leaves);
        expect(await leafListMatches(leaves, BLOCK_SIZE + 1, root)).toBe(false);
    });

    it("rejects a wrong root", async () => {
        const leaves = [leafOf(0), leafOf(1)];
        const root = await treeRoot(leaves);
        root[0] ^= 1;
        expect(await leafListMatches(leaves, BLOCK_SIZE + 1, root)).toBe(false);
    });
});

describe("packets", () => {
    it("split a block and carry it whole", () => {
        const sealed = Uint8Array.from(
            { length: PART_SIZE * 2 + 5 },
            (_, i) => i % 251,
        );
        const packets = encodeDataPackets(7, sealed);
        expect(packets).toHaveLength(3);
        const out: number[] = [];
        packets.forEach((packet, i) => {
            const decoded = decodePacket(packet);
            if (decoded?.kind !== "data") throw new Error("not data");
            expect(decoded.data).toMatchObject({
                block: 7,
                part: i,
                parts: 3,
            });
            out.push(...decoded.data.payload);
        });
        expect(Uint8Array.from(out)).toEqual(sealed);
    });

    it("stay under LiveKit's limit", () => {
        const packets = encodeDataPackets(0, new Uint8Array(BLOCK_SIZE));
        expect(Math.max(...packets.map((p) => p.length))).toBeLessThan(15_000);
    });

    it("accept a data channel's largest part", () => {
        const packet = new Uint8Array(9 + MAX_DATA_PAYLOAD);
        packet[0] = 1;
        packet[8] = 1; // parts = 1
        expect(decodePacket(packet)?.kind).toBe("data");
    });

    it("reject a part above a data channel's largest", () => {
        const packet = new Uint8Array(9 + MAX_DATA_PAYLOAD + 1);
        packet[0] = 1;
        packet[8] = 1;
        expect(decodePacket(packet)).toBeNull();
    });

    it("carry acknowledgements", () => {
        const ack = { contiguous: 12, have: [14, 20] };
        expect(decodePacket(encodeAckPacket(ack))).toEqual({
            kind: "ack",
            ack,
        });
    });

    it("read from a view into a larger buffer", () => {
        const packet = encodeAckPacket({ contiguous: 1, have: [] });
        const padded = new Uint8Array(packet.length + 8);
        padded.set(packet, 4);
        expect(decodePacket(padded.subarray(4, 4 + packet.length))).toEqual({
            kind: "ack",
            ack: { contiguous: 1, have: [] },
        });
    });

    it.each([
        ["empty", []],
        ["an unknown kind", [9, 0, 0, 0, 0, 0, 0, 0, 1]],
        ["a truncated header", [1, 0, 0]],
        ["no parts", [1, 0, 0, 0, 0, 0, 0, 0, 0]],
        ["a part past the end", [1, 0, 0, 0, 0, 0, 2, 0, 2]],
        ["an ack with the wrong length", [2, 0, 0, 0, 0, 0, 1]],
    ])("reject %s", (_label, bytes) => {
        expect(decodePacket(Uint8Array.from(bytes))).toBeNull();
    });
});

describe("leaves packets", () => {
    const leafOf = (i: number) =>
        Uint8Array.from({ length: LEAF_BYTES }, (_, j) => (i + j) % 256);

    it("round-trip the leaf list", () => {
        const leaves = [leafOf(0), leafOf(1), leafOf(2)];
        const packets = encodeLeavesPackets(leaves);
        expect(packets).toHaveLength(1);
        expect(decodePacket(packets[0])).toEqual({
            kind: "leaves",
            leaves: { first: 0, leaves },
        });
    });

    it("split 438 leaves into two packets", () => {
        const leaves = Array.from({ length: 438 }, (_, i) => leafOf(i));
        const packets = encodeLeavesPackets(leaves);
        expect(packets).toHaveLength(2);
        expect(MAX_LEAVES_PER_PACKET).toBe(437);
        const first = decodePacket(packets[0]);
        const second = decodePacket(packets[1]);
        if (first?.kind !== "leaves" || second?.kind !== "leaves")
            throw new Error("not leaves");
        expect(first.leaves.first).toBe(0);
        expect(first.leaves.leaves).toHaveLength(437);
        expect(second.leaves.first).toBe(437);
        expect(second.leaves.leaves).toEqual([leaves[437]]);
    });

    it("keep every packet under a LiveKit part", () => {
        const leaves = Array.from({ length: 1000 }, (_, i) => leafOf(i));
        for (const p of encodeLeavesPackets(leaves))
            expect(p.length).toBeLessThanOrEqual(PART_SIZE);
    });

    it("encode nothing for an empty list", () => {
        expect(encodeLeavesPackets([])).toEqual([]);
    });

    it.each([
        ["a zero count", 0, 0],
        ["a count past the maximum", 438, 438 * LEAF_BYTES],
        ["a count with a short body", 2, 2 * LEAF_BYTES - 1],
        ["a count with a long body", 2, 2 * LEAF_BYTES + 1],
    ])("reject %s", (_label, count, bodyBytes) => {
        const packet = new Uint8Array(7 + bodyBytes);
        const view = new DataView(packet.buffer);
        view.setUint8(0, 3);
        view.setUint32(1, 0);
        view.setUint16(5, count);
        expect(decodePacket(packet)).toBeNull();
    });

    it("reject a truncated header", () => {
        expect(decodePacket(Uint8Array.from([3, 0, 0, 0, 0, 0]))).toBeNull();
    });
});

describe("packet authentication", () => {
    const raw = Uint8Array.from({ length: 32 }, (_, i) => i);
    const packet = new Uint8Array([2, 0, 0, 0, 3, 0, 2, 0, 0, 0, 5, 0, 9]);

    it("round-trips a packet in its direction", async () => {
        const macKey = await deriveMacKey(raw);
        const wire = await sealPacket(macKey, 1, 5, packet);
        expect(wire.length).toBe(packet.length + MAC_TRAILER_BYTES);
        expect(await openPacket(macKey, 1, wire)).toEqual({
            seq: 5,
            packet,
        });
    });

    it("rejects a flipped tag bit", async () => {
        const macKey = await deriveMacKey(raw);
        const wire = await sealPacket(macKey, 2, 0, packet);
        wire[wire.length - 1] ^= 1;
        expect(await openPacket(macKey, 2, wire)).toBeNull();
    });

    it("rejects a flipped packet byte", async () => {
        const macKey = await deriveMacKey(raw);
        const wire = await sealPacket(macKey, 2, 0, packet);
        wire[3] ^= 0x40;
        expect(await openPacket(macKey, 2, wire)).toBeNull();
    });

    it("rejects a flipped sequence byte", async () => {
        const macKey = await deriveMacKey(raw);
        const wire = await sealPacket(macKey, 2, 0, packet);
        wire[packet.length + 7] ^= 1;
        expect(await openPacket(macKey, 2, wire)).toBeNull();
    });

    it("rejects the wrong direction", async () => {
        const macKey = await deriveMacKey(raw);
        const wire = await sealPacket(macKey, 1, 0, packet);
        expect(await openPacket(macKey, 2, wire)).toBeNull();
    });

    it("rejects another key", async () => {
        const wire = await sealPacket(await deriveMacKey(raw), 1, 0, packet);
        const other = await deriveMacKey(new Uint8Array(32));
        expect(await openPacket(other, 1, wire)).toBeNull();
    });

    it("rejects input of 24 bytes or less", async () => {
        const macKey = await deriveMacKey(raw);
        expect(await openPacket(macKey, 1, new Uint8Array(24))).toBeNull();
        expect(await openPacket(macKey, 1, new Uint8Array(0))).toBeNull();
    });
});

describe("to-device acknowledgements", () => {
    it("parse a good one", () => {
        expect(parseAckContent({ contiguous: 2, have: [4] })).toEqual({
            contiguous: 2,
            have: [4],
        });
    });

    it.each([
        [null],
        [{ contiguous: -1, have: [] }],
        [{ contiguous: 1.5, have: [] }],
        [{ contiguous: 1 }],
        [{ contiguous: 1, have: ["2"] }],
    ])("reject %j", (content) => {
        expect(parseAckContent(content)).toBeNull();
    });
});

describe("formatTransferBytes", () => {
    it.each([
        [0, "0 B"],
        [1023, "1023 B"],
        [1536, "1.5 KB"],
        [5 * 1024 ** 3, "5.0 GB"],
    ])("formats %d", (bytes, text) => {
        expect(formatTransferBytes(bytes)).toBe(text);
    });
});
