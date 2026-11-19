import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { crc32, encodeApng, type ApngFrame } from "./apng";

interface ParsedChunk {
    type: string;
    data: Uint8Array;
    crcOk: boolean;
}

function parseChunks(png: Uint8Array): ParsedChunk[] {
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    const chunks: ParsedChunk[] = [];
    let offset = 8;
    while (offset < png.byteLength) {
        const length = view.getUint32(offset);
        const type = String.fromCharCode(
            ...png.subarray(offset + 4, offset + 8),
        );
        const data = png.subarray(offset + 8, offset + 8 + length);
        const stored = view.getUint32(offset + 8 + length);
        const body = png.subarray(offset + 4, offset + 8 + length);
        chunks.push({ type, data, crcOk: crc32(body) === stored });
        offset += 12 + length;
    }
    return chunks;
}

const RED = [255, 0, 0, 255];
const BLUE = [0, 0, 255, 255];
const GREEN = [0, 255, 0, 255];

function frame(pixels: number[][], delayMs: number): ApngFrame {
    return {
        width: 2,
        height: 2,
        delayMs,
        rgba: new Uint8Array(pixels.flat()),
    };
}

describe("crc32", () => {
    it("matches the standard check value", () => {
        expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    });
});

describe("encodeApng", () => {
    it("writes a PNG signature, animation chunks and valid CRCs", async () => {
        const png = await encodeApng([
            frame([RED, RED, RED, RED], 100),
            frame([RED, RED, RED, BLUE], 250),
        ]);

        expect(Array.from(png.subarray(0, 8))).toEqual([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ]);

        const chunks = parseChunks(png);
        const types = chunks.map((c) => c.type);
        expect(types[0]).toBe("IHDR");
        expect(types).toContain("acTL");
        expect(types.filter((t) => t === "fcTL")).toHaveLength(2);
        expect(types.filter((t) => t === "IDAT")).toHaveLength(1);
        expect(types.filter((t) => t === "fdAT")).toHaveLength(1);
        expect(types[types.length - 1]).toBe("IEND");
        expect(chunks.every((c) => c.crcOk)).toBe(true);
    });

    it("declares two frames and an infinite loop in acTL", async () => {
        const png = await encodeApng([
            frame([RED, RED, RED, RED], 100),
            frame([GREEN, GREEN, GREEN, GREEN], 100),
        ]);
        const acTL = parseChunks(png).find((c) => c.type === "acTL");
        const view = new DataView(acTL!.data.buffer, acTL!.data.byteOffset);
        expect(view.getUint32(0)).toBe(2);
        expect(view.getUint32(4)).toBe(0);
    });

    it("stores a delta rectangle for the changed pixel and inflates the IDAT", async () => {
        const png = await encodeApng([
            frame([RED, RED, RED, RED], 100),
            frame([RED, RED, RED, BLUE], 250),
        ]);
        const chunks = parseChunks(png);

        const idat = chunks.find((c) => c.type === "IDAT")!;
        // Two rows of (filter byte + 2 RGBA pixels).
        expect(inflateSync(idat.data).length).toBe(2 * (1 + 2 * 4));

        const fcTLs = chunks.filter((c) => c.type === "fcTL");
        const second = new DataView(
            fcTLs[1].data.buffer,
            fcTLs[1].data.byteOffset,
        );
        expect(second.getUint32(0)).toBe(1); // sequence number, shared with fdAT
        expect(second.getUint32(4)).toBe(1); // width of changed box
        expect(second.getUint32(8)).toBe(1); // height of changed box
        expect(second.getUint32(12)).toBe(1); // x offset
        expect(second.getUint32(16)).toBe(1); // y offset
        expect(second.getUint16(20)).toBe(250); // delay numerator
        expect(second.getUint16(22)).toBe(1000); // delay denominator

        const fdAT = chunks.find((c) => c.type === "fdAT")!;
        const fdView = new DataView(fdAT.data.buffer, fdAT.data.byteOffset);
        expect(fdView.getUint32(0)).toBe(2); // sequence number
        expect(inflateSync(fdAT.data.subarray(4)).length).toBe(1 + 4);
    });

    it("keeps the frame count for identical frames with a 1x1 control", async () => {
        const png = await encodeApng([
            frame([RED, RED, RED, RED], 100),
            frame([RED, RED, RED, RED], 100),
        ]);
        const chunks = parseChunks(png);
        expect(chunks.filter((c) => c.type === "fcTL")).toHaveLength(2);
        const fcTL = chunks.filter((c) => c.type === "fcTL")[1];
        const view = new DataView(fcTL.data.buffer, fcTL.data.byteOffset);
        expect(view.getUint32(4)).toBe(1);
        expect(view.getUint32(8)).toBe(1);
    });

    it("rejects empty input and mismatched frames", async () => {
        await expect(encodeApng([])).rejects.toThrow();
        const small = {
            width: 1,
            height: 1,
            delayMs: 10,
            rgba: new Uint8Array(4),
        };
        await expect(
            encodeApng([frame([RED, RED, RED, RED], 10), small]),
        ).rejects.toThrow();
    });
});
