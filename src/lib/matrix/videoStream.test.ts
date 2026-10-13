import { describe, it, expect } from "vitest";
import { isMp3 } from "./videoStream";

describe("isMp3", () => {
    it("recognises an ID3v2-tagged file", () => {
        expect(isMp3(new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00]))).toBe(
            true,
        );
    });

    it("recognises a bare MPEG audio frame", () => {
        // 0xFF 0xFB: MPEG-1 Layer III, no CRC
        expect(isMp3(new Uint8Array([0xff, 0xfb, 0x90, 0x00]))).toBe(true);
        // 0xFF 0xF3: MPEG-2 Layer III
        expect(isMp3(new Uint8Array([0xff, 0xf3, 0x90, 0x00]))).toBe(true);
    });

    it("rejects the reserved layer value", () => {
        // 0xFF 0xF9 has layer bits 00 (reserved): not an audio frame
        expect(isMp3(new Uint8Array([0xff, 0xf9, 0x90, 0x00]))).toBe(false);
    });

    it("rejects other containers and short input", () => {
        // MP4 ftyp, WebM EBML, Ogg
        expect(
            isMp3(new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70])),
        ).toBe(false);
        expect(isMp3(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]))).toBe(false);
        expect(isMp3(new Uint8Array([0x4f, 0x67, 0x67, 0x53]))).toBe(false);
        expect(isMp3(new Uint8Array([0xff, 0xfb]))).toBe(false);
        expect(isMp3(new Uint8Array([]))).toBe(false);
    });
});
