import { describe, expect, it } from "vitest";
import {
    BLOCK_SIZE,
    FILE_OFFER_EVENT,
    MAX_FILE_SIZE,
    PART_SIZE,
    base64UrlToBytes,
    blockCount,
    blockLength,
    buildFileOffer,
    bytesToBase64,
    bytesToBase64Url,
    decodePacket,
    encodeAckPacket,
    encodeDataPackets,
    formatTransferBytes,
    generateTransferKey,
    isFileOfferEventType,
    openBlock,
    parseAckContent,
    parseFileOffer,
    safeFileName,
    sealBlock,
    sealedLength,
    transferIdentity,
    transferRoomAlias,
} from "./fileTransfer";

const offer = {
    transferId: "t1",
    name: "big.iso",
    size: 5_000_000,
    mimetype: "application/octet-stream",
    senderDevice: "DEV",
    expiresTs: 1234,
};

describe("offers", () => {
    it("round-trips", () => {
        expect(parseFileOffer(buildFileOffer(offer))).toEqual(offer);
    });

    it("recognises only its own event type", () => {
        expect(isFileOfferEventType(FILE_OFFER_EVENT)).toBe(true);
        expect(isFileOfferEventType("m.room.message")).toBe(false);
    });

    it.each([
        ["a newer version", { version: 2 }],
        ["a negative size", { size: -1 }],
        ["a fractional size", { size: 1.5 }],
        ["a size past the limit", { size: MAX_FILE_SIZE + 1 }],
        ["an empty name", { name: "" }],
        ["no sender device", { sender_device: undefined }],
        ["no transfer id", { transfer_id: "" }],
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

describe("names", () => {
    it("builds lk-jwt-service's identity", () => {
        expect(transferIdentity("@a:b", "DEV")).toBe("@a:b:DEV");
    });

    it("keeps the Matrix room in the LiveKit room's name", () => {
        expect(transferRoomAlias("!r:b", "abc")).toBe("!r:b|zam-transfer-abc");
    });

    it.each([
        ["../../etc/passwd", "passwd"],
        ["C:\\Windows\\evil.exe", "evil.exe"],
        ['a<b>c:"d|e?f*g.txt', "a_b_c__d_e_f_g.txt"],
        ["..", "download"],
        ["   ", "download"],
        ["\u0000\u0001", "__"],
        ["photo.png", "photo.png"],
    ])("cleans %j", (name, expected) => {
        expect(safeFileName(name)).toBe(expected);
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
